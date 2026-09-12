# PIDIP Prototype (Static, Google Sheets–backed)

A static, GitHub Pages–hostable rebuild of PIDIP (Procurement & Inventory
Decision Intelligence Platform), reading and writing live data from a Google
Sheet instead of a Supabase backend. No build step, no server, no API keys —
this build assumes an **Admin** user with full read/write access (there is no
login screen or read-only mode).

## How it works

- `gsheets.js` fetches each tab of your Google Sheet using the public
  **gviz JSON endpoint** — no API key needed, just "Anyone with the link →
  Viewer" sharing.
- `engine.js` takes the raw tabs and computes everything PIDIP shows:
  inventory health, stockout risk, near-expiry flags, procurement
  recommendations + priority, supplier scoring, a linear-trend consumption
  forecast, supplier insight callouts, and an inventory turnover estimate.
- `rules.js` persists the configurable Business Rules (Settings page) in the
  browser's `localStorage`.
- `write.js` + `apps-script/Code.gs` handle all writes back to the sheet —
  see "Write-back" below.
- `crud.js` is a generic, schema-driven table (search, pagination, add/edit/
  delete) reused everywhere admin editing happens.
- `pages/*.js` render each of the seven views: Dashboard, Inventory,
  Procurement, Suppliers, Forecasting, **Data Console**, Settings.

## Pages

- **Dashboard** — KPIs, near-expiry table, procurement recommendations,
  supplier status donut + insights, and the quick KPI strip (now including
  Open Purchase Orders and Inventory Turnover).
- **Inventory** — quick inline editing of Current Stock / Safety Stock /
  Reorder Point per material.
- **Procurement** — purchase requests with a Priority column and a
  **"Generate PO"** button per row (creates a real row in the Purchase
  Orders tab), an Open Purchase Orders table, and a recommendations summary
  panel (estimated cost, earliest stockout, shortest lead time, highest risk).
- **Suppliers** — filterable (Supplier / Availability / Supplier Type) and
  sortable catalog table, plus insight KPI cards.
- **Forecasting** — trend chart, projected consumption, earliest
  replenishment date, and a searchable/paginated consumption history with a
  quick "Log Consumption" form.
- **Data Console** (Admin) — full create/edit/delete access across **all
  seven** raw tables (Products, Materials, Bill of Materials, Suppliers,
  Inventory, Consumption History, Purchase Orders), each with search and
  pagination. This is the one place to add brand-new Products, Materials, or
  Suppliers — the other pages are decision-support views, not raw editors.
- **Settings** — configurable business rules (thresholds, buffers, supplier
  scoring weights, forecast window).

## 1. Set up the Google Sheet

Six tabs already exist with the right columns (Products, Materials, Bill of
Materials, Supplier Catalog, Inventory, Consumption History). A **7th tab,
Purchase Orders, is optional** — if it doesn't exist yet, the Apps Script
endpoint creates it automatically (with the right headers) the first time
anything writes to it, so you don't have to add it by hand.

Purchase Orders columns (for reference, or if you want to pre-create it
yourself): PO Number, Supplier ID, Supplier Name, Material ID, Material
Name, Quantity, Unit, Lead Time (Days), Expected Date, Status, Created Date.

Make sure sharing is set to **"Anyone with the link → Viewer."**

## 2. Deploy the write-back endpoint (required for all editing, including the Data Console)

1. Open your Sheet → **Extensions → Apps Script**.
2. Replace the contents with `Code.gs` from this repo.
3. Set `SHEET_ID` and a long random `API_KEY` at the top.
4. **Deploy → New deployment → Web app** (Execute as: Me, Access: Anyone).
5. Copy the `/exec` URL.

If you already had an older version of this script deployed, you need to
**redeploy** (Deploy → Manage deployments → Edit → New version) since the
write-back logic changed to support Purchase Orders and generic table edits.

## 3. Point the site at it

In `config.js`:

```js
WRITE_API: {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
  API_KEY: "the-same-long-random-string-you-set-in-Code.gs",
},
```

Without this, every page falls back cleanly to read-only with a note — the
Data Console, Inventory editing, Log Consumption and Generate PO all require
it.

## 4. Run it locally / deploy to GitHub Pages

```bash
python3 -m http.server 8000   # local test
```

Push to GitHub, then **Settings → Pages → Deploy from branch → main**.

## Customizing

- **Business rules** are editable from the Settings page — no code changes.
- **Adding a new raw table's worth of CRUD** — add an entry to
  `CONFIG.DATA_CONSOLE_TABLES` in `config.js` (sheet name, key column, and
  column list with types) and it appears as a new tab in the Data Console
  automatically, no new page code required.
- **Styling** lives in CSS variables at the top of `styles.css`.

## Known approximations (disclosed on purpose)

- **Supplier scoring** uses a transparent, configurable weighted formula.
  Validated against your real data — it independently reproduces the exact
  supplier insight figures from the original app (e.g. Apex Pharma
  Resources Ltd's 98 reliability score and 3-day lead time), but a specific
  material's primary/emergency pick may occasionally differ since the
  original app's internal formula isn't documented anywhere.
- **Inventory Turnover** is estimated as annualized consumption value ÷
  current inventory value — a reasonable approximation, not a reproduction
  of an undocumented internal calculation.
- **Supplier Type** (Primary / Emergency / Both / Eligible) is computed live
  from the current scoring model rather than stored in the sheet, since the
  original data doesn't have that column.

## Write-back and Data Console

`Code.gs` exposes four actions, all usable against any tab: `update`,
`append`, `delete`, and `createPO` (auto-generates a sequential PO number).
`crud.js` wraps these into a full add/edit/delete UI reused by the Data
Console. Both Inventory quick-editing and the Forecasting "Log Consumption"
form use the same underlying `write.js` calls.

### ⚠️ Security note

This is a static site with no server, so `API_KEY` is visible to anyone who
views the page source — it deters casual/accidental writes, not a
determined attacker. That's an acceptable trade-off for a portfolio
prototype over fictional pharma data; don't reuse this pattern for a sheet
with real sensitive data without adding proper authentication.
