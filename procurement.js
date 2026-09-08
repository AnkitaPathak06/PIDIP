(function () {
  window.Pages = window.Pages || {};
  const Pages = window.Pages;

Pages.procurement = function (main, model) {
  const list = model.materialsRequiringProcurement;
  const totalSpend = list.reduce((sum, m) => {
    const price = m.primarySupplier ? m.primarySupplier.unitPrice : 0;
    return sum + price * m.recommendedQty;
  }, 0);

  const highestPriority = [...list].sort((a, b) => {
    const gapA = a.reorderPoint - a.currentStock;
    const gapB = b.reorderPoint - b.currentStock;
    return gapB - gapA;
  })[0];

  main.innerHTML = `
    <div class="page">
      <p class="page-subtitle">Purchase requests and sourcing recommendations, calculated live from inventory, supplier and consumption data.</p>

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

      <div class="panel">
        <h3>Purchase Requests</h3>
        <p class="panel-sub">Materials at or below their reorder point (${list.length} open).</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Material</th><th>Current Stock</th><th>Reorder Point</th><th>Recommended Qty</th>
                <th>Primary Supplier</th><th>Emergency Supplier</th><th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${
                list.length === 0
                  ? `<tr><td colspan="7" class="empty-state">Nothing to show — all materials are above their reorder point.</td></tr>`
                  : list
                      .map(
                        (m) => `
                <tr>
                  <td><div class="cell-title">${Fmt.escapeHtml(m.materialName)}</div><div class="cell-sub">${Fmt.escapeHtml(m.materialId)}</div></td>
                  <td>${Fmt.num(m.currentStock)} ${Fmt.escapeHtml(m.unit)}</td>
                  <td>${Fmt.num(m.reorderPoint)}</td>
                  <td><strong>${Fmt.num(m.recommendedQty)}</strong></td>
                  <td>${m.primarySupplier ? Fmt.escapeHtml(m.primarySupplier.supplierName) : "—"}</td>
                  <td>${m.emergencySupplier ? Fmt.escapeHtml(m.emergencySupplier.supplierName) : "—"}</td>
                  <td>${reasonFor(m)}</td>
                </tr>`
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
};

function reasonFor(m) {
  if (m.forecast.daysOfInventoryRemaining !== null && m.forecast.daysOfInventoryRemaining <= 14) {
    return "Fastest replenishment needed";
  }
  if (m.primarySupplier && m.primarySupplier.reliabilityScore >= 90) {
    return "Highest reliability supplier available";
  }
  return "Below reorder point";
}
})();
