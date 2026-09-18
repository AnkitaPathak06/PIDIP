(function () {
  window.Pages = window.Pages || {};
  const Pages = window.Pages;

  let lastActiveTabId = null; // persists across re-renders triggered by App.refresh()

  Pages.dataconsole = function (main, model) {
    const tables = CONFIG.DATA_CONSOLE_TABLES;
    let activeId = tables.some((t) => t.id === lastActiveTabId) ? lastActiveTabId : tables[0].id;

    main.innerHTML = `
      <div class="page">
        <p class="page-subtitle">${
          WriteAPI.isConfigured()
            ? "Admin console for full create, edit and delete access across every raw table behind PIDIP. Changes write straight back to the Google Sheet."
            : "Browse every raw table behind PIDIP. This view is read-only — edit values directly in the Google Sheet and they'll appear here on refresh."
        }</p>
        <div class="panel">
          <div class="tab-strip" id="console-tabs">
            ${tables.map((t) => `<button class="tab-btn" data-tab="${t.id}">${Fmt.escapeHtml(t.label)}</button>`).join("")}
          </div>
          <div id="console-table-host"></div>
        </div>
      </div>
    `;

    const tabStrip = document.getElementById("console-tabs");
    const host = document.getElementById("console-table-host");

    function renderActiveTab() {
      tabStrip.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === activeId);
      });
      const tableConfig = tables.find((t) => t.id === activeId);
      const rawKey = Object.keys(CONFIG.SHEETS).find((k) => CONFIG.SHEETS[k] === tableConfig.sheet);
      const rows = (model.raw && model.raw[rawKey]) || [];

      const tableHost = document.createElement("div");
      host.innerHTML = "";
      host.appendChild(tableHost);
      Crud.renderTable(tableHost, tableConfig, rows);
    }

    tabStrip.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeId = btn.dataset.tab;
        lastActiveTabId = activeId;
        renderActiveTab();
      });
    });

    renderActiveTab();
  };
})();
