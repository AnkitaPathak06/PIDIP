// ---------------------------------------------------------------------------
// Turns the six raw sheet tabs into the same derived signals PIDIP shows:
// inventory health, stockout risk, near-expiry flags, procurement
// recommendations, supplier scoring/primary+emergency picks, and a simple
// consumption forecast.
// ---------------------------------------------------------------------------

const Engine = (() => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  function daysBetween(a, b) {
    return Math.round((b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)) / MS_PER_DAY);
  }

  function groupBy(rows, key) {
    const map = new Map();
    rows.forEach((row) => {
      const k = row[key];
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(row);
    });
    return map;
  }

  // Simple linear regression over (index, value) pairs -> {slope, intercept}
  function linearRegression(points) {
    const n = points.length;
    if (n === 0) return { slope: 0, intercept: 0 };
    if (n === 1) return { slope: 0, intercept: points[0].y };

    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;
    points.forEach((p) => {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
    });
    const denom = n * sumXX - sumX * sumX;
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const intercept = sumY / n - slope * (sumX / n);
    return { slope, intercept };
  }

  function scoreSuppliers(supplierRows, weights) {
    if (supplierRows.length === 0) return [];
    const prices = supplierRows.map((s) => Number(s["Unit Price (INR)"]) || 0);
    const leadTimes = supplierRows.map((s) => Number(s["Lead Time (Days)"]) || 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minLead = Math.min(...leadTimes);
    const maxLead = Math.max(...leadTimes);

    const wTotal =
      weights.reliability + weights.quality + weights.price + weights.leadTime || 100;

    return supplierRows
      .map((s) => {
        const price = Number(s["Unit Price (INR)"]) || 0;
        const lead = Number(s["Lead Time (Days)"]) || 0;
        const reliability = Number(s["Reliability Score"]) || 0;
        const quality = Number(s["Quality Score"]) || 0;

        const priceScore =
          maxPrice === minPrice ? 100 : ((maxPrice - price) / (maxPrice - minPrice)) * 100;
        const leadScore =
          maxLead === minLead ? 100 : ((maxLead - lead) / (maxLead - minLead)) * 100;

        const weighted =
          (reliability * weights.reliability +
            quality * weights.quality +
            priceScore * weights.price +
            leadScore * weights.leadTime) /
          wTotal;

        return {
          supplierId: s["Supplier ID"],
          supplierName: s["Supplier Name"],
          unitPrice: price,
          leadTimeDays: lead,
          moq: Number(s["MOQ"]) || 0,
          qualityScore: quality,
          reliabilityScore: reliability,
          availability: s["Availability"],
          score: Math.round(weighted * 10) / 10,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  function forecastForMaterial(consumptionRows, rules, today) {
    const sorted = [...consumptionRows].sort((a, b) => a.Date - b.Date);
    if (sorted.length === 0) {
      return {
        avgDailyConsumption: 0,
        confidence: "Low",
        observedWindowDays: 0,
        history: [],
        next30: 0,
        next60: 0,
        next90: 0,
        daysOfInventoryRemaining: null,
        predictedStockoutDate: null,
      };
    }

    const qtys = sorted.map((r) => Number(r["Quantity Consumed"]) || 0);
    const avgDailyConsumption = qtys.reduce((a, b) => a + b, 0) / qtys.length;

    const points = sorted.map((r, i) => ({ x: i, y: Number(r["Quantity Consumed"]) || 0 }));
    const { slope, intercept } = linearRegression(points);

    function projectSum(days) {
      let total = 0;
      for (let d = 0; d < days; d++) {
        const x = points.length + d;
        const val = Math.max(0, slope * x + intercept);
        total += val;
      }
      return Math.round(total * 10) / 10;
    }

    const firstDate = sorted[0].Date;
    const lastDate = sorted[sorted.length - 1].Date;
    const observedWindowDays = daysBetween(new Date(firstDate), new Date(lastDate)) + 1;

    const confidence =
      sorted.length >= 21 ? "High" : sorted.length >= 10 ? "Medium" : "Low";

    return {
      avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
      confidence,
      observedWindowDays,
      history: sorted.map((r) => ({
        recordId: r["Record ID"],
        date: r.Date,
        qty: Number(r["Quantity Consumed"]) || 0,
      })),
      next30: projectSum(30),
      next60: projectSum(60),
      next90: projectSum(90),
      slope,
      intercept,
      recordCount: sorted.length,
    };
  }

  // Main entry point: raw sheet data + current rules -> full derived model
  function buildModel(raw, rules) {
    const today = new Date();

    const materialsById = new Map(raw.materials.map((m) => [m["Material ID"], m]));
    const inventoryById = new Map(raw.inventory.map((i) => [i["Material ID"], i]));
    const suppliersByMaterial = groupBy(raw.suppliers, "Material ID");
    const consumptionByMaterial = groupBy(raw.consumption, "Material ID");

    const materials = Array.from(materialsById.values()).map((mat) => {
      const materialId = mat["Material ID"];
      const inv = inventoryById.get(materialId) || {};

      const currentStock = Number(inv["Current Stock"]) || 0;
      const safetyStock = Number(inv["Safety Stock"]) || 0;
      const reorderPoint = Number(inv["Reorder Point"]) || 0;
      const expiryDate = inv["Expiry Date"] ? new Date(inv["Expiry Date"]) : null;

      const daysToExpiry = expiryDate ? daysBetween(new Date(today), new Date(expiryDate)) : null;
      const isNearExpiry = daysToExpiry !== null && daysToExpiry <= rules.nearExpiryDays;
      const isCriticalExpiry =
        daysToExpiry !== null && daysToExpiry <= rules.criticalExpiryDays;

      const belowSafetyStock = currentStock < safetyStock;
      const needsProcurement = currentStock <= reorderPoint;

      const recommendedQty = needsProcurement
        ? Math.max(0, Math.round(safetyStock * rules.procurementQtyMultiplier - currentStock))
        : 0;

      const supplierRows = suppliersByMaterial.get(materialId) || [];
      const scoredSuppliers = scoreSuppliers(supplierRows, rules.supplierWeights);
      const availableSuppliers = scoredSuppliers.filter((s) => s.availability === "Available");
      const primarySupplier = availableSuppliers[0] || scoredSuppliers[0] || null;
      const emergencySupplier =
        (availableSuppliers[1] || scoredSuppliers.find((s) => s !== primarySupplier)) || null;

      const consumptionRows = consumptionByMaterial.get(materialId) || [];
      const forecast = forecastForMaterial(consumptionRows, rules, today);

      let predictedStockoutDate = null;
      if (forecast.avgDailyConsumption > 0) {
        const daysRemaining = currentStock / forecast.avgDailyConsumption;
        predictedStockoutDate = new Date(today.getTime() + daysRemaining * MS_PER_DAY);
        forecast.daysOfInventoryRemaining = Math.floor(daysRemaining);
      } else {
        forecast.daysOfInventoryRemaining = null;
      }
      forecast.predictedStockoutDate = predictedStockoutDate;

      const replenishmentLeadTime = primarySupplier
        ? primarySupplier.leadTimeDays
        : emergencySupplier
        ? emergencySupplier.leadTimeDays + rules.emergencyLeadTimeDays
        : null;
      forecast.earliestReplenishmentDate =
        replenishmentLeadTime !== null
          ? new Date(today.getTime() + replenishmentLeadTime * MS_PER_DAY)
          : null;

      let priority = null;
      if (needsProcurement) {
        const criticalStock = reorderPoint > 0 && currentStock <= reorderPoint * 0.5;
        const urgentForecast =
          forecast.daysOfInventoryRemaining !== null && forecast.daysOfInventoryRemaining <= 7;
        priority = criticalStock || urgentForecast ? "High" : "Medium";
      }

      return {
        materialId,
        materialName: mat["Material Name"],
        category: mat["Category"],
        unit: mat["Unit"],
        shelfLifeDays: mat["Shelf Life (Days)"],
        criticality: mat["Criticality"],

        currentStock,
        safetyStock,
        reorderPoint,
        batchNumber: inv["Batch Number"],
        mfgDate: inv["Manufacturing Date"] ? new Date(inv["Manufacturing Date"]) : null,
        expiryDate,
        daysToExpiry,
        isNearExpiry,
        isCriticalExpiry,
        belowSafetyStock,
        needsProcurement,
        recommendedQty,
        priority,

        suppliers: scoredSuppliers,
        primarySupplier,
        emergencySupplier,

        forecast,
      };
    });

    // Supplier catalog view: one row per supplier-material pairing, with the
    // computed score attached, for the Suppliers page table.
    const supplierCatalog = raw.suppliers.map((s) => {
      const mat = materialsById.get(s["Material ID"]);
      const rowsForMaterial = suppliersByMaterial.get(s["Material ID"]) || [];
      const scored = scoreSuppliers(rowsForMaterial, rules.supplierWeights);
      const match = scored.find((sc) => sc.supplierId === s["Supplier ID"]);
      return {
        supplierId: s["Supplier ID"],
        supplierName: s["Supplier Name"],
        materialId: s["Material ID"],
        materialName: s["Material Name"] || (mat ? mat["Material Name"] : ""),
        unitPrice: Number(s["Unit Price (INR)"]) || 0,
        leadTimeDays: Number(s["Lead Time (Days)"]) || 0,
        moq: Number(s["MOQ"]) || 0,
        qualityScore: Number(s["Quality Score"]) || 0,
        reliabilityScore: Number(s["Reliability Score"]) || 0,
        availability: s["Availability"],
        score: match ? match.score : null,
      };
    });

    // Executive summary aggregates
    const totalMaterials = materials.length;
    const healthyCount = materials.filter((m) => !m.belowSafetyStock).length;
    const inventoryHealthPct =
      totalMaterials === 0 ? 100 : Math.round((healthyCount / totalMaterials) * 1000) / 10;

    const materialsRequiringProcurement = materials.filter((m) => m.needsProcurement);
    const nearExpiryMaterials = materials.filter((m) => m.isNearExpiry);

    const uniqueSuppliers = new Set(raw.suppliers.map((s) => s["Supplier ID"]));
    const totalProducts = raw.products.length;

    // Rough total inventory value = current stock x average unit price across suppliers
    let totalInventoryValue = 0;
    materials.forEach((m) => {
      if (m.suppliers.length > 0) {
        const avgPrice =
          m.suppliers.reduce((sum, s) => sum + s.unitPrice, 0) / m.suppliers.length;
        totalInventoryValue += m.currentStock * avgPrice;
      }
    });

    const suppliersRequiringAttention = new Set(
      raw.suppliers
        .filter((s) => Number(s["Reliability Score"]) < 80 || s["Availability"] !== "Available")
        .map((s) => s["Supplier ID"])
    ).size;

    const materialsWithEmergencyCoverage = materials.filter((m) => m.emergencySupplier).length;

    // Purchase Orders (optional 7th tab — auto-created by Code.gs on first write)
    const purchaseOrders = (raw.purchaseOrders || []).map((po) => ({
      poNumber: po["PO Number"],
      supplierId: po["Supplier ID"],
      supplierName: po["Supplier Name"],
      materialId: po["Material ID"],
      materialName: po["Material Name"],
      quantity: Number(po["Quantity"]) || 0,
      unit: po["Unit"],
      leadTimeDays: Number(po["Lead Time (Days)"]) || 0,
      expectedDate: po["Expected Date"] ? new Date(po["Expected Date"]) : null,
      status: po["Status"] || "Pending",
      createdDate: po["Created Date"] ? new Date(po["Created Date"]) : null,
    }));
    const openPurchaseOrders = purchaseOrders.filter(
      (po) => po.status === "Pending" || po.status === "Approved"
    );

    // Supplier insight callouts, reused by both the Dashboard and Suppliers page
    const bestReliability = [...supplierCatalog].sort((a, b) => b.reliabilityScore - a.reliabilityScore)[0];
    const bestLeadTime = [...supplierCatalog].sort((a, b) => a.leadTimeDays - b.leadTimeDays)[0];
    const bestMoq = [...supplierCatalog].sort((a, b) => a.moq - b.moq)[0];
    const supplierInsights = {
      highestReliability: bestReliability
        ? { name: bestReliability.supplierName, value: bestReliability.reliabilityScore }
        : null,
      fastestLeadTime: bestLeadTime
        ? { name: bestLeadTime.supplierName, value: bestLeadTime.leadTimeDays }
        : null,
      lowestMoq: bestMoq ? { name: bestMoq.supplierName, value: bestMoq.moq } : null,
      requiringAttention: suppliersRequiringAttention,
      emergencyCoverage: `${materialsWithEmergencyCoverage}/${totalMaterials}`,
    };

    // Inventory turnover ≈ annualized consumption value / current inventory value.
    // This formula isn't documented anywhere in the original project report, so
    // it's a reasonable, transparent approximation rather than a reproduction
    // of an unknown internal calculation.
    let annualConsumptionValue = 0;
    materials.forEach((m) => {
      if (m.suppliers.length > 0 && m.forecast.avgDailyConsumption > 0) {
        const avgPrice = m.suppliers.reduce((sum, s) => sum + s.unitPrice, 0) / m.suppliers.length;
        annualConsumptionValue += m.forecast.avgDailyConsumption * 365 * avgPrice;
      }
    });
    const inventoryTurnover =
      totalInventoryValue > 0 ? Math.round((annualConsumptionValue / totalInventoryValue) * 100) / 100 : 0;

    return {
      today,
      rules,
      raw,
      materials,
      supplierCatalog,
      products: raw.products,
      bom: raw.bom,
      purchaseOrders,
      openPurchaseOrders,
      supplierInsights,
      summary: {
        totalProducts,
        totalMaterials,
        activeSuppliers: uniqueSuppliers.size,
        inventoryHealthPct,
        materialsRequiringProcurement: materialsRequiringProcurement.length,
        nearExpiryCount: nearExpiryMaterials.length,
        totalInventoryValue: Math.round(totalInventoryValue),
        suppliersRequiringAttention,
        emergencyCoverage: `${materialsWithEmergencyCoverage}/${totalMaterials}`,
        openPurchaseOrders: openPurchaseOrders.length,
        inventoryTurnover,
      },
      materialsRequiringProcurement,
      nearExpiryMaterials,
    };
  }

  return { buildModel };
})();
