# PIDIP Prototype (Static, Google Sheets–backed)

A static, GitHub Pages–hostable rebuild of PIDIP (Procurement & Inventory Decision
Intelligence Platform), reading live data from a Google Sheet instead of a
Supabase backend. No build step, no server, no API keys.

## How it works

- `js/gsheets.js` fetches each tab of your Google Sheet using the public
  **gviz JSON endpoint** (`.../gviz/tq?tqx=out:json&sheet=<TabName>`). This
  works with zero setup as long as the sheet is shared as
  **"Anyone with the link → Viewer."**
- `js/engine.js` takes the six raw tabs and computes everything PIDIP shows:
  inventory health, stockout risk, near-expiry flags, procurement
  recommendations, supplier scoring, and a linear-trend consumption forecast.
- `js/rules.js` persists the configurable Business Rules (Settings page) in
  the browser's `localStorage` — there's no backend to write to, so rules are
  per-device. See "Adding write-back" below if you want that to change.
- Everything else (`js/pages/*.js`) renders one screen each: Dashboard,
  Inventory, Procurement, Suppliers, Forecasting, Settings — matching the six
  views in your original report.

## 1. Set up the Google Sheet

Your sheet already has the right six tabs and columns:

| Tab | Required columns |
|---|---|
| Products | Product ID, Product Name, Category, Dosage Form |
| Materials | Material ID, Material Name, Category, Unit, Shelf Life (Days), Criticality |
| Bill of Materials | Product ID, Product Name, Material ID, Material Name, Quantity per Batch, Unit |
| Supplier Catalog | Supplier ID, Supplier Name, Material ID, Material Name, Unit Price (INR), Lead Time (Days), MOQ, Quality Score, Reliability Score, Availability |
| Inventory | Material ID, Material Name, Current Stock, Safety Stock, Reorder Point, Batch Number, Manufacturing Date, Expiry Date |
| Consumption History | Date, Material ID, Material Name, Quantity Consumed |

Make sure sharing is set to **"Anyone with the link → Viewer"** (File → Share
→ General access). This is required for the site to read it — no Google
sign-in happens on your visitors' end.

If you use a different Sheet ID or rename tabs, update `js/config.js`:

```js
SHEET_ID: "your-sheet-id-here",
SHEETS: { products: "Products", materials: "Materials", ... }
```

## 2. Run it locally

Because the browser fetches from `docs.google.com`, opening `index.html`
directly with `file://` will usually work, but if you hit CORS/security
issues in your browser, serve it locally instead:

```bash
cd pidip
python3 -m http.server 8000
# then open http://localhost:8000
```

## 3. Deploy to GitHub Pages

```bash
cd pidip
git init
git add .
git commit -m "PIDIP static prototype"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Deploy from branch → main → / (root)**.
Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

## Customizing

- **Business rules** (near-expiry window, safety stock buffer, procurement
  quantity multiplier, supplier scoring weights, forecast horizon) are all
  editable from the Settings page in the running app — no code changes
  needed. Changing them instantly recalculates the Dashboard, Procurement,
  Suppliers and Forecasting views.
- **Styling** lives entirely in `css/styles.css` using CSS variables at the
  top of the file (`--sidebar-bg`, `--blue`, `--green`, etc.) if you want to
  re-theme it.
- **Refresh interval**: the app re-fetches the sheet every 5 minutes
  automatically (`CONFIG.REFRESH_INTERVAL_MS`), plus a manual "Refresh"
  button in the top bar.

## Known differences from the original Lovable/Supabase build

- **Supplier scoring** here uses a transparent, configurable weighted formula
  (reliability, quality, normalized price, normalized lead time). The
  original app's exact internal scoring logic wasn't documented outside the
  report, so a primary/emergency supplier pick may occasionally differ from
  the original screenshots for a given material. Adjust the weights on the
  Settings page to tune this.
- **Inventory turnover ratio** and a couple of other summary metrics in the
  original dashboard depend on calculations not fully specified in the
  project report; this build computes total inventory value from current
  stock × average supplier price, and leaves turnover out rather than guess
  at an unstated formula.
- **Editing data**: this build is read-only against the sheet by design — you
  edit inventory/consumption/supplier rows directly in Google Sheets, and the
  site reflects it on next refresh. If you want in-app editing that writes
  back to the sheet, add a small Google Apps Script Web App (see below).

## Write-back: editing from the UI (already wired up)

This build ships with a working write-back layer, so you don't need to write
the Apps Script yourself — just deploy it and point the site at it.

### 1. Deploy the Apps Script Web App

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Delete the placeholder code and paste in the contents of
   `apps-script/Code.gs` from this repo.
3. At the top of the script, set:
   - `SHEET_ID` — same value as `CONFIG.SHEET_ID` in `js/config.js`.
   - `API_KEY` — make up a long random string (e.g. generate one at
     `openssl rand -hex 24` or any password generator). This isn't real
     security (see the note below) but stops casual/accidental writes.
4. Click **Deploy → New deployment → type: Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click Deploy, authorize the script when prompted, and copy the **Web app
   URL** it gives you (ends in `/exec`).

### 2. Point the site at it

In `js/config.js`, fill in:

```js
WRITE_API: {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
  API_KEY: "the-same-long-random-string-you-set-in-Code.gs",
},
```

Redeploy/push the change. That's it — two things unlock automatically:

- **Inventory page**: an "Edit" button per row lets you update Current
  Stock, Safety Stock and Reorder Point, saved straight back to the
  `Inventory` tab.
- **Forecasting page**: a "Log Consumption" form appends a new row to the
  `Consumption History` tab for the selected material.

Both call `App.refresh()` after a successful save, so the whole prototype
(dashboard, procurement, forecasts) recalculates immediately from the
updated sheet — no page reload needed.

If `WRITE_API.APPS_SCRIPT_URL` is left blank, both pages fall back cleanly to
read-only mode with a note explaining how to enable editing.

### Extending it

`apps-script/Code.gs` exposes three generic actions any page can call via
`js/write.js` — `WriteAPI.updateRow(sheet, keyColumn, keyValue, fields)`,
`WriteAPI.appendRow(sheet, fields)`, and `WriteAPI.deleteRow(sheet, keyColumn, keyValue)`.
They work against **any** tab, not just Inventory/Consumption History, so
you can wire up editing on the Suppliers or Products pages the same way if
you want.

### ⚠️ Security note

This is a static site with no server, so `API_KEY` lives in plain JavaScript
that anyone can view via "View Source." It stops accidental/casual misuse of
the endpoint, but a determined person could still find and reuse the key
since it's shipped to the browser. That's an acceptable trade-off for a
portfolio prototype backed by sample/fictional data — don't reuse this
pattern for a sheet with real sensitive data without adding proper
authentication (e.g. Google OAuth sign-in checked server-side, or restricting
the Apps Script deployment to specific accounts instead of "Anyone").
