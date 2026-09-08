(function () {
  window.Pages = window.Pages || {};
  const Pages = window.Pages;

Pages.dashboard = function (main, model) {
  const { summary, materialsRequiringProcurement, nearExpiryMaterials, supplierCatalog } = model;

  const healthy = new Set();
  const delayed = new Set();
  const critical = new Set();
  supplierCatalog.forEach((s) => {
    if (s.availability !== "Available") critical.add(s.supplierId);
    else if (s.reliabilityScore < 90) delayed.add(s.supplierId);
    else healthy.add(s.supplierId);
  });
  // a supplier only counts once, in its worst bucket
  delayed.forEach((id) => healthy.delete(id));
  critical.forEach((id) => {
    healthy.delete(id);
    delayed.delete(id);
  });

  main.innerHTML = `
    <div class="page">
      <p class="page-subtitle">Consolidated procurement and inventory decision view, calculated live from Google Sheets data.</p>

      <div class="summary-strip">
        <ul>
          <li>Inventory health is at <strong>${summary.inventoryHealthPct}%</strong> of materials above safety stock.</li>
          <li><strong>${summary.nearExpiryCount}</strong> inventory batch(es) near expiry within the configured window.</li>
          <li><strong>${summary.activeSuppliers}</strong> active suppliers across ${summary.totalMaterials} materials and ${summary.totalProducts} products.</li>
        </ul>
        <ul>
          <li><strong>${summary.materialsRequiringProcurement}</strong> materials require procurement action.</li>
          <li>Total inventory value stands at <strong>${Fmt.inr(summary.totalInventoryValue)}</strong>.</li>
          <li><strong>${summary.suppliersRequiringAttention}</strong> suppliers flagged for attention.</li>
        </ul>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Inventory Value</div>
          <div class="kpi-value">${Fmt.inr(summary.totalInventoryValue)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Inventory Health</div>
          <div class="kpi-value">${summary.inventoryHealthPct}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Materials Requiring Procurement</div>
          <div class="kpi-value">${summary.materialsRequiringProcurement}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Materials Near Expiry</div>
          <div class="kpi-value">${summary.nearExpiryCount}</div>
        </div>
      </div>

      <div class="grid-2col">
        <div class="panel">
          <h3>Near Expiry Materials</h3>
          <p class="panel-sub">Batches expiring within the configured near-expiry window.</p>
          ${renderNearExpiryTable(nearExpiryMaterials, model.rules)}
        </div>
      </div>

      <div class="grid-2col grid-2col-uneven">
        <div class="panel">
          <h3>Procurement Recommendations</h3>
          <p class="panel-sub">Materials at or below their reorder point.</p>
          ${renderProcurementTable(materialsRequiringProcurement)}
        </div>
        <div class="panel">
          <h3>Supplier Status</h3>
          <p class="panel-sub">Distribution across the catalog.</p>
          <canvas id="supplier-donut" height="220"></canvas>
          <ul class="legend-list">
            <li><span class="dot dot-green"></span>Healthy Suppliers <strong>${healthy.size}</strong></li>
            <li><span class="dot dot-amber"></span>Delayed Suppliers <strong>${delayed.size}</strong></li>
            <li><span class="dot dot-red"></span>Critical Suppliers <strong>${critical.size}</strong></li>
          </ul>
        </div>
      </div>

      <div class="quick-kpis">
        <div><strong>${summary.totalProducts}</strong><span>Total Products</span></div>
        <div><strong>${summary.totalMaterials}</strong><span>Total Materials</span></div>
        <div><strong>${summary.activeSuppliers}</strong><span>Active Suppliers</span></div>
        <div><strong>${summary.emergencyCoverage}</strong><span>Emergency Coverage</span></div>
      </div>
    </div>
  `;

  const ctx = document.getElementById("supplier-donut");
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Healthy", "Delayed", "Critical"],
      datasets: [
        {
          data: [healthy.size, delayed.size, critical.size],
          backgroundColor: ["#1fb473", "#f5a623", "#e5484d"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: "70%",
      plugins: { legend: { display: false } },
    },
  });
};

function renderNearExpiryTable(materials, rules) {
  if (materials.length === 0) {
    return `<div class="empty-state">No materials are within the ${rules.nearExpiryDays}-day near-expiry window.</div>`;
  }
  const rows = materials
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
    .map(
      (m) => `
      <tr>
        <td>${Fmt.escapeHtml(m.materialName)}</td>
        <td>${Fmt.escapeHtml(m.batchNumber)}</td>
        <td>${Fmt.num(m.currentStock)} ${Fmt.escapeHtml(m.unit)}</td>
        <td>${Fmt.date(m.expiryDate)}</td>
        <td>${Fmt.daysLabel(m.daysToExpiry)}</td>
        <td>${statusBadge(m.isCriticalExpiry ? "Critical" : "Warning")}</td>
      </tr>`
    )
    .join("");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Material</th><th>Batch</th><th>Current Stock</th><th>Expiry Date</th><th>Days Remaining</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderProcurementTable(materials) {
  if (materials.length === 0) {
    return `<div class="empty-state">No materials are currently at or below their reorder point.</div>`;
  }
  const rows = materials
    .map(
      (m) => `
      <tr>
        <td>${Fmt.escapeHtml(m.materialName)}</td>
        <td>${Fmt.num(m.currentStock)}</td>
        <td>${Fmt.num(m.safetyStock)}</td>
        <td><strong>${Fmt.num(m.recommendedQty)}</strong></td>
        <td>${m.primarySupplier ? Fmt.escapeHtml(m.primarySupplier.supplierName) : "—"}</td>
        <td>${m.emergencySupplier ? Fmt.escapeHtml(m.emergencySupplier.supplierName) : "—"}</td>
      </tr>`
    )
    .join("");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Material</th><th>Current Stock</th><th>Safety Stock</th><th>Recommended Qty</th><th>Primary Supplier</th><th>Emergency</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function statusBadge(status) {
  const cls = status === "Critical" ? "badge badge-red" : "badge badge-amber";
  return `<span class="${cls}">${status}</span>`;
}
})();
