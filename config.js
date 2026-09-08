// ---------------------------------------------------------------------------
// PIDIP prototype — global configuration
// ---------------------------------------------------------------------------
// SHEET_ID is the Google Sheet that acts as PIDIP's "database".
// The sheet must be shared as "Anyone with the link -> Viewer" for the
// gviz endpoint below to work from a static site (no API key needed).
// ---------------------------------------------------------------------------

const CONFIG = {
  SHEET_ID: "1c0Y6l1460VoFQtiTQ70nFekFMeM87dEVjMKOBlYkzDQ",

  // Exact tab names in the Google Sheet
  SHEETS: {
    products: "Products",
    materials: "Materials",
    bom: "Bill of Materials",
    suppliers: "Supplier Catalog",
    inventory: "Inventory",
    consumption: "Consumption History",
  },

  // Defaults for the configurable Business Rules (Settings page).
  // These are overridden by whatever the user has saved in localStorage.
  DEFAULT_RULES: {
    nearExpiryDays: 30, // "Near Expiry Threshold"
    criticalExpiryDays: 7, // "Critical Expiry Threshold"
    safetyStockBufferPct: 20, // "Safety Stock Buffer"
    inventoryHealthThresholdPct: 90, // "Inventory Health Threshold"
    reorderPointBufferPct: 10, // "Reorder Point Buffer"
    emergencyLeadTimeDays: 5, // "Emergency Supplier Lead Time"
    procurementQtyMultiplier: 2, // "Default Procurement Quantity Multiplier"
    supplierWeights: {
      // "Supplier Scoring" — must total 100
      reliability: 40,
      quality: 30,
      price: 20,
      leadTime: 10,
    },
    forecastWindowDays: 90, // "Forecast Window"
  },

  RULES_STORAGE_KEY: "pidip_business_rules_v1",
  REFRESH_INTERVAL_MS: 5 * 60 * 1000, // auto refetch sheet every 5 min

  // Write-back endpoint (optional). Leave APPS_SCRIPT_URL blank to run
  // fully read-only. See apps-script/Code.gs + README for setup.
  // NOTE: API_KEY is visible to anyone viewing the site's source — it is a
  // basic deterrent, not real security. See README's security note.
  WRITE_API: {
    APPS_SCRIPT_URL: "", // e.g. "https://script.google.com/macros/s/XXXX/exec"
    API_KEY: "", // must match API_KEY in apps-script/Code.gs
  },
};
