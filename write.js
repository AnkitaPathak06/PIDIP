// ---------------------------------------------------------------------------
// Talks to the Google Apps Script Web App deployed from apps-script/Code.gs.
// Uses a text/plain content-type on purpose: it keeps the POST request a
// CORS "simple request" so the browser doesn't need a preflight OPTIONS
// call, which Apps Script web apps don't handle well.
// ---------------------------------------------------------------------------

const WriteAPI = (() => {
  function isConfigured() {
    return Boolean(CONFIG.WRITE_API.APPS_SCRIPT_URL);
  }

  async function call(action, sheet, payload = {}) {
    if (!isConfigured()) {
      throw new Error(
        "Write-back isn't set up yet. Deploy apps-script/Code.gs and add the URL in js/config.js (see README)."
      );
    }
    const body = JSON.stringify({
      apiKey: CONFIG.WRITE_API.API_KEY,
      action,
      sheet,
      ...payload,
    });

    const res = await fetch(CONFIG.WRITE_API.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });

    if (!res.ok) {
      throw new Error(`Write request failed (HTTP ${res.status}).`);
    }
    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || "Write failed.");
    }
    return json;
  }

  return {
    isConfigured,
    updateRow: (sheet, keyColumn, keyValue, fields) =>
      call("update", sheet, { keyColumn, keyValue, fields }),
    appendRow: (sheet, fields) => call("append", sheet, { fields }),
    deleteRow: (sheet, keyColumn, keyValue) => call("delete", sheet, { keyColumn, keyValue }),
    createPO: (fields) => call("createPO", CONFIG.SHEETS.purchaseOrders, { fields }),
  };
})();
