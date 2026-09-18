(function () {
  window.Pages = window.Pages || {};
  const Pages = window.Pages;

  Pages.suppliers = function (main, model) {
    // Supplier Type isn't a raw column — derive it from how this supplier is
    // actually being used for that material in the current scoring model.
    const catalog = model.supplierCatalog.map((s) => {
      const mat = model.materials.find((m) => m.materialId === s.materialId);
      let type = "—";
      if (mat) {
        const isPrimary = mat.primarySupplier && mat.primarySupplier.supplierId === s.supplierId;
        const isEmergency = mat.emergencySupplier && mat.emergencySupplier.supplierId === s.supplierId;
        if (isPrimary && isEmergency) type = "Both";
        else if (isPrimary) type = "Primary";
        else if (isEmergency) type = "Emergency";
        else type = s.availability === "Available" ? "Eligible" : "Unavailable";
      }
      return { ...s, supplierType: type };
    });

    const insights = model.supplierInsights;
    const supplierNames = [...new Set(catalog.map((s) => s.supplierName))].sort();
    const supplierTypes = [...new Set(catalog.map((s) => s.supplierType))].sort();

    const state = { search: "", supplier: "", availability: "", type: "", sortKey: null, sortDir: 1, page: 1, pageSize: 10 };

    main.innerHTML = `
      <div class="page">
        <p class="page-subtitle">Supplier catalog entries, calculated live from the supplier catalog table with search, filtering and column sorting.</p>

        <div class="kpi-grid kpi-grid-5">
          <div class="kpi-card">
            <div class="kpi-label">Highest Reliability</div>
            <div class="kpi-value-sm">${insights.highestReliability ? Fmt.escapeHtml(insights.highestReliability.name) : "—"}</div>
            <div class="kpi-foot">${insights.highestReliability ? insights.highestReliability.value + " score" : ""}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Fastest Lead Time</div>
            <div class="kpi-value-sm">${insights.fastestLeadTime ? Fmt.escapeHtml(insights.fastestLeadTime.name) : "—"}</div>
            <div class="kpi-foot">${insights.fastestLeadTime ? insights.fastestLeadTime.value + " days" : ""}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Lowest MOQ</div>
            <div class="kpi-value-sm">${insights.lowestMoq ? Fmt.escapeHtml(insights.lowestMoq.name) : "—"}</div>
            <div class="kpi-foot">${insights.lowestMoq ? "MOQ " + insights.lowestMoq.value : ""}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Requiring Attention</div>
            <div class="kpi-value">${insights.requiringAttention}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Emergency Coverage</div>
            <div class="kpi-value-sm">${insights.emergencyCoverage}</div>
          </div>
        </div>

        <div class="panel">
          <div class="table-toolbar sup-toolbar">
            <input id="sup-search" class="search-input" type="text" placeholder="Search suppliers or materials..." />
            <select id="sup-filter-supplier" class="select-input select-inline">
              <option value="">Supplier</option>
              ${supplierNames.map((n) => `<option value="${Fmt.escapeHtml(n)}">${Fmt.escapeHtml(n)}</option>`).join("")}
            </select>
            <select id="sup-filter-availability" class="select-input select-inline">
              <option value="">Availability</option>
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
            </select>
            <select id="sup-filter-type" class="select-input select-inline">
              <option value="">Supplier Type</option>
              ${supplierTypes.map((t) => `<option value="${Fmt.escapeHtml(t)}">${Fmt.escapeHtml(t)}</option>`).join("")}
            </select>
          </div>
          <div class="table-wrap">
            <table id="sup-table">
              <thead>
                <tr>
                  ${sortableHeader("supplierName", "Supplier")}
                  ${sortableHeader("materialName", "Material")}
                  ${sortableHeader("supplierType", "Supplier Type")}
                  ${sortableHeader("unitPrice", "Unit Price")}
                  ${sortableHeader("leadTimeDays", "Lead Time")}
                  ${sortableHeader("moq", "MOQ")}
                  ${sortableHeader("qualityScore", "Quality")}
                  ${sortableHeader("reliabilityScore", "Reliability")}
                  ${sortableHeader("availability", "Availability")}
                  ${sortableHeader("score", "Score")}
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="pagination">
            <span id="sup-count"></span>
            <div class="pagination-controls">
              <button class="btn btn-sm" id="sup-prev">Previous</button>
              <span id="sup-page-label"></span>
              <button class="btn btn-sm" id="sup-next">Next</button>
            </div>
          </div>
        </div>
      </div>
    `;

    function sortableHeader(key, label) {
      return `<th class="sortable-th" data-sort="${key}">${label} <span class="sort-arrow">${state.sortKey === key ? (state.sortDir === 1 ? "▲" : "▼") : ""}</span></th>`;
    }

    function applyFiltersAndSort() {
      let rows = catalog.filter((s) => {
        if (state.search) {
          const q = state.search.toLowerCase();
          if (
            !s.supplierName.toLowerCase().includes(q) &&
            !s.materialName.toLowerCase().includes(q) &&
            !s.materialId.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        if (state.supplier && s.supplierName !== state.supplier) return false;
        if (state.availability && s.availability !== state.availability) return false;
        if (state.type && s.supplierType !== state.type) return false;
        return true;
      });

      if (state.sortKey) {
        rows = [...rows].sort((a, b) => {
          const va = a[state.sortKey];
          const vb = b[state.sortKey];
          if (typeof va === "number" && typeof vb === "number") return (va - vb) * state.sortDir;
          return String(va ?? "").localeCompare(String(vb ?? "")) * state.sortDir;
        });
      }
      return rows;
    }

    function renderRows() {
      const allRows = applyFiltersAndSort();
      const totalPages = Math.max(1, Math.ceil(allRows.length / state.pageSize));
      state.page = Math.min(state.page, totalPages);
      const rows = allRows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);

      const tbody = document.querySelector("#sup-table tbody");
      if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-state">No suppliers match your filters.</td></tr>`;
      } else {
        tbody.innerHTML = rows
          .map(
            (s) => `
        <tr>
          <td>${Fmt.escapeHtml(s.supplierName)}</td>
          <td>${Fmt.escapeHtml(s.materialName)}</td>
          <td>${Fmt.escapeHtml(s.supplierType)}</td>
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

      document.getElementById("sup-count").textContent = `${allRows.length} record${allRows.length === 1 ? "" : "s"}`;
      document.getElementById("sup-page-label").textContent = `Page ${state.page} of ${totalPages}`;
      document.getElementById("sup-prev").disabled = state.page <= 1;
      document.getElementById("sup-next").disabled = state.page >= totalPages;
    }

    document.getElementById("sup-search").addEventListener("input", (e) => {
      state.search = e.target.value;
      state.page = 1;
      renderRows();
    });
    document.getElementById("sup-filter-supplier").addEventListener("change", (e) => {
      state.supplier = e.target.value;
      state.page = 1;
      renderRows();
    });
    document.getElementById("sup-filter-availability").addEventListener("change", (e) => {
      state.availability = e.target.value;
      state.page = 1;
      renderRows();
    });
    document.getElementById("sup-filter-type").addEventListener("change", (e) => {
      state.type = e.target.value;
      state.page = 1;
      renderRows();
    });
    document.getElementById("sup-prev").addEventListener("click", () => {
      state.page--;
      renderRows();
    });
    document.getElementById("sup-next").addEventListener("click", () => {
      state.page++;
      renderRows();
    });
    document.querySelectorAll(".sortable-th").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir *= -1;
        } else {
          state.sortKey = key;
          state.sortDir = 1;
        }
        document.querySelectorAll(".sortable-th .sort-arrow").forEach((el) => (el.textContent = ""));
        th.querySelector(".sort-arrow").textContent = state.sortDir === 1 ? "▲" : "▼";
        renderRows();
      });
    });

    renderRows();
  };
})();
