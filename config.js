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
    purchaseOrders: "Purchase Orders",
  },

  // Column schema for each raw table, used by the Data Console (Admin) page
  // to render generic add/edit/delete forms. "key" must match the sheet's
  // actual header text exactly.
  DATA_CONSOLE_TABLES: [
    {
      id: "inventory",
      label: "Inventory",
      sheet: "Inventory",
      keyColumn: "Material ID",
      columns: [
        { key: "Material ID", label: "Material ID", type: "text", required: true },
        { key: "Material Name", label: "Material Name", type: "text" },
        { key: "Current Stock", label: "Current Stock", type: "number" },
        { key: "Safety Stock", label: "Safety Stock", type: "number" },
        { key: "Reorder Point", label: "Reorder Point", type: "number" },
        { key: "Batch Number", label: "Batch Number", type: "text" },
        { key: "Manufacturing Date", label: "Manufacturing Date", type: "date" },
        { key: "Expiry Date", label: "Expiry Date", type: "date" },
      ],
    },
    {
      id: "products",
      label: "Products",
      sheet: "Products",
      keyColumn: "Product ID",
      columns: [
        { key: "Product ID", label: "Product ID", type: "text", required: true },
        { key: "Product Name", label: "Product Name", type: "text" },
        { key: "Category", label: "Category", type: "text" },
        { key: "Dosage Form", label: "Dosage Form", type: "text" },
      ],
    },
    {
      id: "materials",
      label: "Materials",
      sheet: "Materials",
      keyColumn: "Material ID",
      columns: [
        { key: "Material ID", label: "Material ID", type: "text", required: true },
        { key: "Material Name", label: "Material Name", type: "text" },
        { key: "Category", label: "Category", type: "text" },
        { key: "Unit", label: "Unit", type: "text" },
        { key: "Shelf Life (Days)", label: "Shelf Life (Days)", type: "number" },
        { key: "Criticality", label: "Criticality", type: "select", options: ["HIGH", "MEDIUM", "LOW"] },
      ],
    },
    {
      id: "bom",
      label: "Bill of Materials",
      sheet: "Bill of Materials",
      keyColumn: "Product ID",
      columns: [
        { key: "Product ID", label: "Product ID", type: "text", required: true },
        { key: "Product Name", label: "Product Name", type: "text" },
        { key: "Material ID", label: "Material ID", type: "text" },
        { key: "Material Name", label: "Material Name", type: "text" },
        { key: "Quantity per Batch", label: "Quantity per Batch", type: "number" },
        { key: "Unit", label: "Unit", type: "text" },
      ],
    },
    {
      id: "suppliers",
      label: "Supplier Catalog",
      sheet: "Supplier Catalog",
      keyColumn: "Supplier ID",
      columns: [
        { key: "Supplier ID", label: "Supplier ID", type: "text", required: true },
        { key: "Supplier Name", label: "Supplier Name", type: "text" },
        { key: "Material ID", label: "Material ID", type: "text" },
        { key: "Material Name", label: "Material Name", type: "text" },
        { key: "Unit Price (INR)", label: "Unit Price (INR)", type: "number" },
        { key: "Lead Time (Days)", label: "Lead Time (Days)", type: "number" },
        { key: "MOQ", label: "MOQ", type: "number" },
        { key: "Quality Score", label: "Quality Score", type: "number" },
        { key: "Reliability Score", label: "Reliability Score", type: "number" },
        { key: "Availability", label: "Availability", type: "select", options: ["Available", "Unavailable"] },
      ],
    },
    {
      id: "consumption",
      label: "Consumption History",
      sheet: "Consumption History",
      keyColumn: "Record ID",
      columns: [
        { key: "Record ID", label: "Record ID", type: "text", required: true },
        { key: "Material ID", label: "Material ID", type: "text" },
        { key: "Material Name", label: "Material Name", type: "text" },
        { key: "Date", label: "Date", type: "date" },
        { key: "Quantity Consumed", label: "Quantity Consumed", type: "number" },
      ],
    },
    {
      id: "purchaseOrders",
      label: "Purchase Orders",
      sheet: "Purchase Orders",
      keyColumn: "PO Number",
      columns: [
        { key: "PO Number", label: "PO Number", type: "text", required: true },
        { key: "Supplier ID", label: "Supplier ID", type: "text" },
        { key: "Supplier Name", label: "Supplier Name", type: "text" },
        { key: "Material ID", label: "Material ID", type: "text" },
        { key: "Material Name", label: "Material Name", type: "text" },
        { key: "Quantity", label: "Quantity", type: "number" },
        { key: "Unit", label: "Unit", type: "text" },
        { key: "Lead Time (Days)", label: "Lead Time (Days)", type: "number" },
        { key: "Expected Date", label: "Expected Date", type: "date" },
        {
          key: "Status",
          label: "Status",
          type: "select",
          options: ["Pending", "Approved", "Received", "Cancelled"],
        },
        { key: "Created Date", label: "Created Date", type: "date" },
      ],
    },
  ],

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
    APPS_SCRIPT_URL: "", // paste your Apps Script /exec URL here after deploying
    API_KEY: "7214d243207dd500bdc8177de95a28a75f7deca5",
  },
};
