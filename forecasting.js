(function () {
  window.Pages = window.Pages || {};
  const Pages = window.Pages;

Pages.forecasting = function (main, model) {
  const materials = model.materials.filter((m) => m.forecast.recordCount > 0);
  let selectedId = (materials[0] && materials[0].materialId) || null;

  main.innerHTML = `
    <div class="page">
      <p class="page-subtitle">Material-level consumption trend, linear-trend projection and stockout risk, calculated live from recorded consumption history.</p>

      <div class="panel">
        <label class="field-label" for="material-select">Material</label>
        <select id="material-select" class="select-input">
          ${materials
            .map((m) => `<option value="${m.materialId}">${Fmt.escapeHtml(m.materialName)} (${m.materialId})</option>`)
            .join("")}
        </select>
        <div id="forecast-detail"></div>
      </div>
    </div>
  `;

  const select = document.getElementById("material-select");
  const detail = document.getElementById("forecast-detail");

  function renderDetail(materialId) {
    const m = model.materials.find((x) => x.materialId === materialId);
    if (!m) {
      detail.innerHTML = `<div class="empty-state">No consumption history recorded for this material.</div>`;
      return;
    }
    const f = m.forecast;

    detail.innerHTML = `
      <div class="forecast-meta">
        Average consumption per record: <strong>${Fmt.num(f.avgDailyConsumption, 2)} ${Fmt.escapeHtml(m.unit)}</strong>
        &nbsp;·&nbsp; Forecast confidence: <strong>${f.confidence}</strong>
        &nbsp;·&nbsp; Observed window: <strong>${f.observedWindowDays} days</strong>
      </div>

      ${
        m.emergencySupplier && f.daysOfInventoryRemaining !== null && f.daysOfInventoryRemaining <= m.emergencySupplier.leadTimeDays
          ? `<div class="callout callout-warning">
              <strong>Primary supplier may not replenish before projected stockout.</strong>
              Emergency supplier recommended: ${Fmt.escapeHtml(m.emergencySupplier.supplierName)} (${m.emergencySupplier.leadTimeDays} day lead time).
            </div>`
          : ""
      }
      ${
        m.needsProcurement
          ? `<div class="callout callout-info">
              <strong>Procurement action recommended.</strong>
              ${Fmt.escapeHtml(m.materialName)} is at or below its reorder point (${Fmt.num(m.reorderPoint)}).
            </div>`
          : ""
      }

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Average Consumption / Record</div>
          <div class="kpi-value">${Fmt.num(f.avgDailyConsumption, 2)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Days of Inventory Remaining</div>
          <div class="kpi-value">${f.daysOfInventoryRemaining === null ? "—" : f.daysOfInventoryRemaining < 1 ? "< 1 day" : f.daysOfInventoryRemaining + " days"}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Predicted Stockout Date</div>
          <div class="kpi-value-sm">${f.predictedStockoutDate ? Fmt.date(f.predictedStockoutDate) : "—"}</div>
        </div>
      </div>

      <div class="grid-2col grid-2col-uneven">
        <div class="panel panel-flat">
          <h3>Historical Consumption Trend</h3>
          <canvas id="forecast-chart" height="220"></canvas>
        </div>
        <div class="panel panel-flat">
          <h3>Predicted Consumption</h3>
          <p class="panel-sub">Linear trend projection over recorded consumption.</p>
          <table class="kv-table">
            <tr><td>Next 30 records</td><td><strong>${Fmt.num(f.next30, 1)} ${Fmt.escapeHtml(m.unit)}</strong></td></tr>
            <tr><td>Next 60 records</td><td><strong>${Fmt.num(f.next60, 1)} ${Fmt.escapeHtml(m.unit)}</strong></td></tr>
            <tr><td>Next 90 records</td><td><strong>${Fmt.num(f.next90, 1)} ${Fmt.escapeHtml(m.unit)}</strong></td></tr>
            <tr><td>Current stock</td><td>${Fmt.num(m.currentStock)}</td></tr>
            <tr><td>Reorder point</td><td>${Fmt.num(m.reorderPoint)}</td></tr>
            <tr><td>Safety stock</td><td>${Fmt.num(m.safetyStock)}</td></tr>
            <tr><td>Earliest replenishment</td><td>${f.earliestReplenishmentDate ? Fmt.date(f.earliestReplenishmentDate) : "—"}</td></tr>
          </table>
        </div>
      </div>

      <div class="panel">
        <h3>Consumption History</h3>
        <div class="table-toolbar">
          <input id="history-search" class="search-input" type="text" placeholder="Search consumption records..." />
        </div>
        <div class="table-wrap">
          <table id="history-table">
            <thead><tr><th>Record ID</th><th>Date</th><th>Quantity Consumed</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="pagination">
          <span id="history-count"></span>
          <div class="pagination-controls">
            <button class="btn btn-sm" id="history-prev">Previous</button>
            <span id="history-page-label"></span>
            <button class="btn btn-sm" id="history-next">Next</button>
          </div>
        </div>

        ${
          WriteAPI.isConfigured()
            ? `<div class="log-consumption">
                <h3 style="margin-top:20px;">Log Consumption</h3>
                <div class="inline-form">
                  <div class="field">
                    <label for="log-date">Date</label>
                    <input id="log-date" type="date" value="${Fmt.localDateStr(new Date())}" />
                  </div>
                  <div class="field">
                    <label for="log-qty">Quantity Consumed</label>
                    <input id="log-qty" type="number" step="0.01" placeholder="0" />
                  </div>
                  <button id="log-consumption-btn" class="btn btn-primary">Add record</button>
                </div>
              </div>`
            : `<div class="write-disabled-note">Deploy apps-script/Code.gs and set the URL in js/config.js to log new consumption records from here.</div>`
        }
      </div>
    `;

    if (WriteAPI.isConfigured()) {
      document.getElementById("log-consumption-btn").addEventListener("click", async () => {
        const btn = document.getElementById("log-consumption-btn");
        const dateVal = document.getElementById("log-date").value;
        const qtyVal = Number(document.getElementById("log-qty").value);
        if (!dateVal || !qtyVal) {
          Fmt.toast("Enter a date and a quantity first.", "error");
          return;
        }
        const [y, mo, d] = dateVal.split("-").map(Number);
        const existingIds = (model.raw.consumption || [])
          .map((r) => Number(r["Record ID"]))
          .filter((n) => !isNaN(n));
        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        btn.disabled = true;
        btn.textContent = "Saving…";
        try {
          await WriteAPI.appendRow(CONFIG.SHEETS.consumption, {
            "Record ID": nextId,
            Date: new Date(y, mo - 1, d).toLocaleDateString("en-US"),
            "Material ID": m.materialId,
            "Material Name": m.materialName,
            "Quantity Consumed": qtyVal,
          });
          Fmt.toast("Consumption record added.", "success");
          await App.refresh();
        } catch (err) {
          console.error(err);
          Fmt.toast(err.message || "Could not add record.", "error");
          btn.disabled = false;
          btn.textContent = "Add record";
        }
      });
    }

    const historyState = { search: "", page: 1, pageSize: 10 };

    function renderHistoryTable() {
      let rows = f.history;
      if (historyState.search) {
        const q = historyState.search.toLowerCase();
        rows = rows.filter(
          (h) => String(h.recordId ?? "").toLowerCase().includes(q) || Fmt.date(h.date).toLowerCase().includes(q)
        );
      }
      rows = [...rows].reverse(); // most recent first
      const totalPages = Math.max(1, Math.ceil(rows.length / historyState.pageSize));
      historyState.page = Math.min(historyState.page, totalPages);
      const pageRows = rows.slice(
        (historyState.page - 1) * historyState.pageSize,
        historyState.page * historyState.pageSize
      );

      document.querySelector("#history-table tbody").innerHTML =
        pageRows.length === 0
          ? `<tr><td colspan="3" class="empty-state">No consumption records match your search.</td></tr>`
          : pageRows
              .map((h) => `<tr><td>${Fmt.escapeHtml(h.recordId)}</td><td>${Fmt.date(h.date)}</td><td>${Fmt.num(h.qty, 1)}</td></tr>`)
              .join("");

      document.getElementById("history-count").textContent = `${rows.length} record${rows.length === 1 ? "" : "s"}`;
      document.getElementById("history-page-label").textContent = `Page ${historyState.page} of ${totalPages}`;
      document.getElementById("history-prev").disabled = historyState.page <= 1;
      document.getElementById("history-next").disabled = historyState.page >= totalPages;
    }

    document.getElementById("history-search").addEventListener("input", (e) => {
      historyState.search = e.target.value;
      historyState.page = 1;
      renderHistoryTable();
    });
    document.getElementById("history-prev").addEventListener("click", () => {
      historyState.page--;
      renderHistoryTable();
    });
    document.getElementById("history-next").addEventListener("click", () => {
      historyState.page++;
      renderHistoryTable();
    });
    renderHistoryTable();

    const ctx = document.getElementById("forecast-chart");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: f.history.map((h) => Fmt.date(h.date)),
        datasets: [
          {
            label: `${m.materialName} consumption`,
            data: f.history.map((h) => h.qty),
            borderColor: "#2f6fed",
            backgroundColor: "rgba(47,111,237,0.08)",
            tension: 0.3,
            fill: true,
            pointRadius: 2,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { maxTicksLimit: 6 } } },
      },
    });
  }

  if (selectedId) {
    select.value = selectedId;
    renderDetail(selectedId);
  } else {
    detail.innerHTML = `<div class="empty-state">No materials have recorded consumption history yet.</div>`;
  }

  select.addEventListener("change", (e) => renderDetail(e.target.value));
};
})();
