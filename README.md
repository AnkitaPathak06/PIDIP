# PIDIP Prototype (Static, Google Sheets–backed, locally editable)

A static, GitHub Pages–hostable rebuild of PIDIP (Procurement & Inventory
Decision Intelligence Platform). It reads live data from a Google Sheet, and
lets any visitor make edits that are fully functional and recalculate the
whole app in real time — but those edits live **only in that visitor's own
browser** and are never sent anywhere. No backend, no API keys, no Apps
Script, no security exposure of any kind.

## How editing works (read this first)

- The app fetches live data from your Google Sheet on load (read-only,
  completely safe — this part never changes anything).
- When a visitor edits Inventory, adds a Purchase Order, adds/edits/deletes
  a row in the Data Console, or logs consumption, that change is saved to
  their own browser's `localStorage` — not to the Google Sheet, not to a
  server, not visible to any other visitor.
- Every graph, KPI, table, and forecast recalculates for real using that
  visitor's edited data, so it behaves like a fully functional app.
- Refreshing the page re-fetches the live sheet and re-applies that same
  visitor's local edits on top of it, so their changes persist across
  reloads on that device.
- A "Clear my changes" button (appears in the top bar once they've made any
  edits) wipes their local edits and returns to the live sheet data.
- **Your actual Google Sheet is never modified by anyone visiting the
  site.** To change the real data, edit the Sheet directly.

This means there is genuinely nothing to deploy, secure, or configure
beyond pointing the site at your Sheet — no write-back endpoint of any kind
exists.

## How it works internally

- `gsheets.js` fetches each tab via the public gviz JSON endpoint (sheet
  must be shared "Anyone with the link → Viewer") and tags every row with a
  stable internal `_rowKey`.
- `session.js` (`SessionStore`) holds each visitor's local edits/additions/
  deletions in `localStorage`, keyed by `_rowKey`, and merges them on top of
  freshly-fetched live rows.
- `write.js` (`WriteAPI`) exposes the same `updateRow` / `appendRow` /
  `deleteRow` / `createPO` functions every page already calls — internally
  they just talk to `SessionStore` now.
- `engine.js` computes everything PIDIP shows (inventory health, stockout
  risk, procurement recommendations + priority, supplier scoring, consumption
  forecasting, supplier insights, turnover) from whatever data — live or
  locally-edited — is currently active.
- `crud.js` is a generic, schema-driven table (search, pagination, add/edit/
  delete) reused by the Data Console.
- `pages/*.js` render each of the seven views: Dashboard, Inventory,
  Procurement, Suppliers, Forecasting, **Data Console**, Settings.

### Why `_rowKey` instead of "natural" columns like Supplier ID

Three of the seven tables don't actually have a column that's unique per
row — Supplier Catalog (a supplier appears once per material it supplies),
Bill of Materials (a product appears once per material it needs), and
Consumption History (no ID column at all). Editing or deleting by, say,
"Supplier ID" would incorrectly match *every* row for that supplier. Every
row gets a `_rowKey` (`SheetName#index`) at fetch time instead, so edits and
deletes always target the exact row a visitor clicked — verified in testing
against your real data.

## Pages

- **Dashboard** — KPIs, near-expiry table, procurement recommendations,
  supplier status donut + insights, Open Purchase Orders / Inventory
  Turnover.
- **Inventory** — inline editing of Current Stock / Safety Stock / Reorder
  Point, paginated 10/page.
- **Procurement** — purchase requests with Priority, a "Generate PO" button
  per row, an Open Purchase Orders table, and a recommendations panel.
- **Suppliers** — filterable (Supplier / Availability / Supplier Type),
  sortable, paginated catalog.
- **Forecasting** — trend chart, projected consumption, earliest
  replenishment date, searchable/paginated consumption history, and a
  "Log Consumption" quick-add form.
- **Data Console** (Admin) — full create/edit/delete across all seven raw
  tables (Products, Materials, Bill of Materials, Suppliers, Inventory,
  Consumption History, Purchase Orders).
- **Settings** — business rules (thresholds, buffers, supplier scoring
  weights, forecast window) — saved to this browser only (unrelated to the
  data-edit overlay above; this was true from the very first version).

## Setup

1. Make sure your Google Sheet is shared as **"Anyone with the link →
   Viewer."**
2. If your Sheet ID differs from the one already in `config.js`, update
   `CONFIG.SHEET_ID`.
3. That's it. No other setup, no deployment step, no keys.

Run locally with `python3 -m http.server 8000`, or push to GitHub and turn
on **Settings → Pages → Deploy from branch → main**.

## Known approximations (disclosed on purpose)

- **Supplier scoring** uses a transparent, configurable weighted formula.
  Validated against real data — it independently reproduces the exact
  supplier insight figures from the original app (e.g. Apex Pharma
  Resources Ltd's 98 reliability score and 3-day lead time).
- **Inventory Turnover** is estimated as annualized consumption value ÷
  current inventory value — a reasonable approximation, not a reproduction
  of an undocumented internal calculation.
- **Supplier Type** (Primary / Emergency / Both / Eligible) is computed live
  from the current scoring model, since the original data has no such
  column.

## If you ever want edits to actually change the real Sheet

That's a different, bigger feature (a real write-back endpoint, e.g. via
Google Apps Script) with real security trade-offs to weigh — it was
deliberately left out of this build in favor of the safe, zero-setup,
per-visitor local editing described above.
