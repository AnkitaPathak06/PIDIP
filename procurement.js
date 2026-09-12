(function () {
  window.Pages = window.Pages || {};
  const Pages = window.Pages;

  Pages.procurement = function (main, model) {
    const list = model.materialsRequiringProcurement;
    const writeEnabled = WriteAPI.isConfigured();

    const totalSpend = list.reduce((sum, m) => {
      const price = m.primarySupplier ? m.primarySupplier.unitPrice : 0;
      return sum + price * m.recommendedQty;
    }, 0);

    const highestPriority = [...list].sort((a, b) => {
      const gapA = a.reorderPoint - a.currentStock;
      const gapB = b.reorderPoint - b.currentStock;
      return gapB - gapA;
    })[0];

    // Earliest stockout across all materials with a forecast
    const withStockout = model.materials.filter((m) => m.forecast.predictedStockoutDate);
    const earliestStockout = withStockout.sort(
      (a, b) => a.forecast.predictedStockoutDate - b.forecast.predictedStockoutDate
    )[0];

    const shortestLead = list
      .filter((m) => m.primarySupplier)
      .sort((a, b) => a.primarySupplier.leadTimeDays - b.primarySupplier.leadTimeDays)[0];

    const highestRisk = highestPriority;

    main.innerHTML = `
      <div class="page">
        <p class="page-subtitle">Purchase requests, generated purchase orders and sourcing recommendations, calculated live from inventory, supplier and consumption data.</p>

        ${
          list.length > 0
            ? `<div class="callout callout-warning">
                <strong>${list.length} material(s) require procurement.</strong>
                Estimated spend ${Fmt.inr(totalSpend)}${
                highestPriority ? `. Highest priority: ${Fmt.escapeHtml(highestPriority.materialName)}.` : ""
              }
              </div>`
            : `<div class="callout callout-ok"><strong>No materials currently require procurement.</strong></div>`
        }

        <div class="grid-2col grid-2col-uneven">
          <div>
            <div class="panel">
              <h3>Purchase Requests</h3>
              <p class="panel-sub">Materials at or below their reorder point (${list.length} open).</p>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th><th>Current Stock</th><th>Reorder Point</th><th>Recommended Qty</th>
                      <th>Primary Supplier</th><th>Emergency Supplier</th><th>Reason</th><th>Priority</th>
                      ${writeEnabled ? "<th></th>" : ""}
                    </tr>
                  </thead>
                  <tbody id="purchase-requests-body">
                    ${renderRequestRows(list, writeEnabled)}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="panel">
              <h3>Open Purchase Orders</h3>
              <p class="panel-sub">Generated from recommendations for review — stored in the Purchase Orders tab.</p>
              ${renderOpenPOTable(model.openPurchaseOrders)}
            </div>
          </div>

          <div class="panel">
            <h3>Procurement Recommendations</h3>
            <p class="panel-sub">Sourcing signals derived from current stock levels, recorded consumption and the qualified supplier catalog.</p>
            <ul class="insights-list">
              <li><span>Total Purchase Recommendations</span><strong>${list.length}</strong></li>
              <li><span>Estimated Procurement Cost</span><strong>${Fmt.inr(totalSpend)}</strong></li>
              <li><span>Earliest Stockout Date</span><strong>${earliestStockout ? Fmt.date(earliestStockout.forecast.predictedStockoutDate) : "—"}${earliestStockout ? `<div class="insight-sub">${Fmt.escapeHtml(earliestStockout.materialName)}</div>` : ""}</strong></li>
              <li><span>Shortest Lead Time Supplier</span><strong>${shortestLead && shortestLead.primarySupplier ? Fmt.escapeHtml(shortestLead.primarySupplier.supplierName) : "—"}${shortestLead ? `<div class="insight-sub">${shortestLead.primarySupplier.leadTimeDays} day lead time</div>` : ""}</strong></li>
              <li><span>Highest Risk Material</span><strong>${highestRisk ? Fmt.escapeHtml(highestRisk.materialName) : "—"}${highestRisk ? `<div class="insight-sub">Below safety stock</div>` : ""}</strong></li>
            </ul>
          </div>
        </div>
      </div>
    `;

    if (writeEnabled) wireGenerateButtons(model);
  };

  function renderRequestRows(list, writeEnabled) {
    const colCount = writeEnabled ? 8 : 7;
    if (list.length === 0) {
      return `<tr><td colspan="${colCount}" class="empty-state">Nothing to show — all materials are above their reorder point.</td></tr>`;
    }
    return list
      .map(
        (m) => `
      <tr data-material-id="${Fmt.escapeHtml(m.materialId)}">
        <td><div class="cell-title">${Fmt.escapeHtml(m.materialName)}</div><div class="cell-sub">${Fmt.escapeHtml(m.materialId)}</div></td>
        <td>${Fmt.num(m.currentStock)} ${Fmt.escapeHtml(m.unit)}</td>
        <td>${Fmt.num(m.reorderPoint)}</td>
        <td><strong>${Fmt.num(m.recommendedQty)}</strong></td>
        <td>${m.primarySupplier ? Fmt.escapeHtml(m.primarySupplier.supplierName) : "—"}</td>
        <td>${m.emergencySupplier ? Fmt.escapeHtml(m.emergencySupplier.supplierName) : "—"}</td>
        <td>${reasonFor(m)}</td>
        <td>${priorityBadge(m.priority)}</td>
        ${writeEnabled ? `<td><button class="btn btn-sm btn-primary" data-action="generate-po">Generate PO</button></td>` : ""}
      </tr>`
      )
      .join("");
  }

  function renderOpenPOTable(pos) {
    if (!pos || pos.length === 0) {
      return `<div class="empty-state">No open purchase orders. Generate one from a purchase request above, or add one directly in the Data Console.</div>`;
    }
    const rows = pos
      .map(
        (po) => `
      <tr>
        <td>${Fmt.escapeHtml(po.poNumber)}</td>
        <td>${Fmt.escapeHtml(po.supplierName)}</td>
        <td>${Fmt.escapeHtml(po.materialName)}</td>
        <td>${Fmt.num(po.quantity)} ${Fmt.escapeHtml(po.unit)}</td>
        <td>${po.leadTimeDays} d</td>
        <td>${Fmt.date(po.expectedDate)}</td>
        <td><span class="badge ${po.status === "Approved" ? "badge-green" : "badge-amber"}">${Fmt.escapeHtml(po.status)}</span></td>
      </tr>`
      )
      .join("");
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>PO Number</th><th>Supplier</th><th>Material</th><th>Quantity</th><th>Lead Time</th><th>Expected</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function reasonFor(m) {
    if (m.forecast.daysOfInventoryRemaining !== null && m.forecast.daysOfInventoryRemaining <= 14) {
      return "Fastest replenishment needed";
    }
    if (m.primarySupplier && m.primarySupplier.reliabilityScore >= 90) {
      return "Highest reliability supplier available";
    }
    return "Below reorder point";
  }

  function priorityBadge(priority) {
    if (!priority) return "—";
    const cls = priority === "High" ? "badge-red" : "badge-amber";
    return `<span class="badge ${cls}">${priority}</span>`;
  }

  function wireGenerateButtons(model) {
    const body = document.getElementById("purchase-requests-body");
    if (!body) return;
    body.addEventListener("click", async (e) => {
      const btn = e.target.closest('[data-action="generate-po"]');
      if (!btn) return;
      const tr = btn.closest("tr");
      const materialId = tr.dataset.materialId;
      const m = model.materials.find((x) => x.materialId === materialId);
      if (!m || !m.primarySupplier) {
        Fmt.toast("No primary supplier available for this material.", "error");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Generating…";
      try {
        const expected = new Date(Date.now() + m.primarySupplier.leadTimeDays * 24 * 60 * 60 * 1000);
        await WriteAPI.createPO({
          "Supplier ID": m.primarySupplier.supplierId,
          "Supplier Name": m.primarySupplier.supplierName,
          "Material ID": m.materialId,
          "Material Name": m.materialName,
          Quantity: m.recommendedQty,
          Unit: m.unit,
          "Lead Time (Days)": m.primarySupplier.leadTimeDays,
          "Expected Date": Fmt.localDateStr(expected),
          Status: "Pending",
        });
        Fmt.toast(`Purchase order generated for ${m.materialName}.`, "success");
        await App.refresh();
      } catch (err) {
        console.error(err);
        Fmt.toast(err.message || "Could not generate PO.", "error");
        btn.disabled = false;
        btn.textContent = "Generate PO";
      }
    });
  }
})();
