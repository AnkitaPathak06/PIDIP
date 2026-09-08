// ---------------------------------------------------------------------------
// App bootstrap: fetches the Google Sheet once, builds the derived model,
// then hands off to a tiny hash router that swaps page content in/out of
// a single shared shell (sidebar + topbar).
// ---------------------------------------------------------------------------

const App = (() => {
  let state = {
    raw: null,
    model: null,
    lastRefreshed: null,
    loadError: null,
  };

  const ROUTES = {
    dashboard: { title: "Executive Decision Dashboard", render: Pages.dashboard },
    inventory: { title: "Inventory", render: Pages.inventory },
    procurement: { title: "Procurement", render: Pages.procurement },
    suppliers: { title: "Suppliers", render: Pages.suppliers },
    forecasting: { title: "Demand Forecasting", render: Pages.forecasting },
    settings: { title: "Business Rules Configuration", render: Pages.settings },
  };

  function currentRoute() {
    const hash = (location.hash || "#/dashboard").replace(/^#\//, "");
    return ROUTES[hash] ? hash : "dashboard";
  }

  function setActiveNav(routeKey) {
    document.querySelectorAll(".nav-link").forEach((a) => {
      a.classList.toggle("active", a.dataset.route === routeKey);
    });
  }

  function renderShellChrome(routeKey) {
    const route = ROUTES[routeKey];
    document.getElementById("page-title").textContent = route.title;
    document.title = `PIDIP — ${route.title}`;
    setActiveNav(routeKey);
  }

  function renderRoute() {
    const routeKey = currentRoute();
    renderShellChrome(routeKey);
    const main = document.getElementById("main-content");

    if (state.loadError) {
      main.innerHTML = `
        <div class="error-banner">
          <strong>Couldn't load data from the Google Sheet.</strong>
          <div>${Fmt.escapeHtml(state.loadError)}</div>
          <div class="error-hint">Check that the sheet is shared as "Anyone with the link – Viewer" and that the tab names in js/config.js match your sheet exactly.</div>
          <button id="retry-btn" class="btn btn-primary" style="margin-top:12px;">Retry</button>
        </div>`;
      document.getElementById("retry-btn").addEventListener("click", init);
      return;
    }

    if (!state.model) {
      main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading live data from Google Sheets…</p></div>`;
      return;
    }

    ROUTES[routeKey].render(main, state.model, {
      refresh: init,
      goTo: (r) => (location.hash = `#/${r}`),
    });
  }

  function updateRefreshStamp() {
    const el = document.getElementById("last-refresh");
    if (!el) return;
    el.textContent = state.lastRefreshed
      ? state.lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "—";
  }

  async function init() {
    state.loadError = null;
    state.model = null;
    renderRoute();
    try {
      const raw = await GSheets.fetchAll();
      state.raw = raw;
      const rules = Rules.load();
      state.model = Engine.buildModel(raw, rules);
      state.lastRefreshed = new Date();
      updateRefreshStamp();
    } catch (e) {
      console.error(e);
      state.loadError = e.message || "Unknown error.";
    }
    renderRoute();
  }

  function rebuildModelFromCurrentData(newRules) {
    if (!state.raw) return;
    state.model = Engine.buildModel(state.raw, newRules);
    renderRoute();
  }

  function start() {
    window.addEventListener("hashchange", renderRoute);
    document.getElementById("refresh-btn").addEventListener("click", init);
    init();
    setInterval(init, CONFIG.REFRESH_INTERVAL_MS);
  }

  return { start, rebuildModelFromCurrentData, refresh: init, getState: () => state };
})();

document.addEventListener("DOMContentLoaded", App.start);
