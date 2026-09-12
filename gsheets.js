// ---------------------------------------------------------------------------
// Reads tabs from the public Google Sheet using the gviz JSON endpoint.
// No API key or backend required — the sheet just needs to be shared as
// "Anyone with the link -> Viewer".
// ---------------------------------------------------------------------------

const GSheets = (() => {
  function buildUrl(sheetName) {
    const base = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq`;
    const params = new URLSearchParams({
      tqx: "out:json",
      sheet: sheetName,
    });
    return `${base}?${params.toString()}`;
  }

  // gviz wraps its JSON in `google.visualization.Query.setResponse({...});`
  function unwrap(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("Unexpected response from Google Sheets.");
    }
    return JSON.parse(text.slice(start, end + 1));
  }

  // gviz represents dates as the literal string `Date(yyyy,m,d)` (month is 0-indexed)
  function coerceCellValue(cell) {
    if (!cell) return null;
    const v = cell.v;
    if (typeof v === "string" && v.startsWith("Date(")) {
      const parts = v
        .slice(5, -1)
        .split(",")
        .map((n) => parseInt(n, 10));
      const [y, m, d] = parts;
      return new Date(y, m, d);
    }
    return v;
  }

  async function fetchSheet(sheetName) {
    const res = await fetch(buildUrl(sheetName), { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to load tab "${sheetName}" (HTTP ${res.status}).`);
    }
    const text = await res.text();
    const json = unwrap(text);

    const cols = json.table.cols.map((c, i) => {
      const label = (c.label || c.id || `col${i}`).trim();
      return label;
    });

    const rows = (json.table.rows || []).map((r) => {
      const obj = {};
      cols.forEach((label, i) => {
        obj[label] = coerceCellValue(r.c[i]);
      });
      return obj;
    });

    // drop fully blank rows
    return rows.filter((row) =>
      Object.values(row).some((v) => v !== null && v !== "" && v !== undefined)
    );
  }

  async function fetchAll() {
    const entries = Object.entries(CONFIG.SHEETS);
    const results = await Promise.all(
      entries.map(([key, sheetName]) =>
        fetchSheet(sheetName).catch((err) => {
          console.warn(`Tab "${sheetName}" could not be loaded (may not exist yet):`, err.message);
          return [];
        })
      )
    );
    const data = {};
    entries.forEach(([key], i) => {
      data[key] = results[i];
    });
    return data;
  }

  return { fetchSheet, fetchAll };
})();
