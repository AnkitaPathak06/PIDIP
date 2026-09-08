const Pages = window.Pages || {};

Pages.suppliers = function (main, model) {
  const catalog = model.supplierCatalog;

  const byReliability = [...catalog].sort((a, b) => b.reliabilityScore - a.reliabilityScore)[0];
  const byLeadTime = [...catalog].sort((a, b) => a.leadTimeDays - b.leadTimeDays)[0];
  const byMoq = [...catalog].sort((a, b) => a.moq - b.moq)[0];
  const flagged = new Set(
    catalog
      .filter((s) => s.reliabilityScore < 80 || s.availability !== "Available")
      .map((s) => s.supplierId)
  ).size;

  main.innerHTML = `
    <div class="page">
      <p class="page-subtitle">Supplier catalog, calculated live with configurable scoring weights.</p>

      <div class="kpi-grid kpi-grid-5">
        <div class="kpi-card">
          <div class="kpi-label">Highest Reliability</div>
          <div class="kpi-value-sm">${byReliability ? Fmt.escapeHtml(byReliability.supplierName) : "—"}</div>
          <div class="kpi-foot">${byReliability ? byReliability.reliabilityScore + " score" : ""}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Fastest Lead Time</div>
          <div class="kpi-value-sm">${byLeadTime ? Fmt.escapeHtml(byLeadTime.supplierName) : "—"}</div>
          <div class="kpi-foot">${byLeadTime ? byLeadTime.leadTimeDays + " days" : ""}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Lowest MOQ</div>
          <div class="kpi-value-sm">${byMoq ? Fmt.escapeHtml(byMoq.supplierName) : "—"}</div>
          <div class="kpi-foot">${byMoq ? "MOQ " + byMoq.moq : ""}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Requiring Attention</div>
          <div class="kpi-value">${flagged}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Emergency Coverage</div>
          <div class="kpi-value-sm">${model.summary.emergencyCoverage}</div>
        </div>
      </div>

      <div class="panel">
        <div class="table-toolbar">
          <input id="sup-search" class="search-input" type="text" placeholder="Search suppliers or materials..." />
        </div>
        <div class="table-wrap">
          <table id="sup-table">
            <thead>
              <tr>
                <th>Supplier</th><th>Material</th><th>Unit Price</th><th>Lead Time</th><th>MOQ</th>
                <th>Quality</th><th>Reliability</th><th>Availability</th><th>Score</th>
              </tr>
            </thead>
            <tbody>${renderRows(catalog)}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById("sup-search").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = catalog.filter(
      (s) =>
        s.supplierName.toLowerCase().includes(q) ||
        s.materialName.toLowerCase().includes(q) ||
        s.materialId.toLowerCase().includes(q)
    );
    document.querySelector("#sup-table tbody").innerHTML = renderRows(filtered);
  });
};

function renderRows(catalog) {
  if (catalog.length === 0) {
    return `<tr><td colspan="9" class="empty-state">No suppliers match your search.</td></tr>`;
  }
  return catalog
    .map(
      (s) => `
      <tr>
        <td>${Fmt.escapeHtml(s.supplierName)}</td>
        <td>${Fmt.escapeHtml(s.materialName)}</td>
        <td>${Fmt.inr(s.unitPrice)}</td>
        <td>${s.leadTimeDays} d</td>
        <td>${Fmt.num(s.moq)}</td>
        <td>${s.qualityScore}</td>
        <td>${s.reliabilityScore}</td>
        <td><span class="badge ${s.availability === "Available" ? "badge-green" : "badge-red"}">${Fmt.escapeHtml(s.availability)}</span></td>
        <td><strong>${s.score ?? "—"}</strong></td>
      </tr>`
    )
    .join("");
}

window.Pages = Pages;
