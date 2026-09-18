// ---------------------------------------------------------------------------
// Same public API every page already calls (updateRow / appendRow /
// deleteRow / createPO), but every write now lands in this visitor's own
// browser only (via SessionStore), never on a server, never in the real
// Google Sheet, never visible to anyone else.
// ---------------------------------------------------------------------------

const WriteAPI = (() => {
  function isConfigured() {
    return true; // local session edits always work — no setup required
  }

  function currentRows(sheetName) {
    const state = App.getState();
    const rawKey = Object.keys(CONFIG.SHEETS).find((k) => CONFIG.SHEETS[k] === sheetName);
    return (state.raw && state.raw[rawKey]) || [];
  }

  function resolveRowKey(sheetName, keyColumn, keyValue) {
    if (keyColumn === "_rowKey") return keyValue;
    const rows = currentRows(sheetName);
    const match = rows.find((r) => String(r[keyColumn]) === String(keyValue));
    return match ? match._rowKey : null;
  }

  async function updateRow(sheetName, keyColumn, keyValue, fields) {
    const rowKey = resolveRowKey(sheetName, keyColumn, keyValue);
    if (!rowKey) {
      throw new Error(`Couldn't find that record (${keyColumn} = ${keyValue}) to update.`);
    }
    SessionStore.updateRow(sheetName, rowKey, fields);
  }

  async function appendRow(sheetName, fields) {
    SessionStore.appendRow(sheetName, fields);
  }

  async function deleteRow(sheetName, keyColumn, keyValue) {
    const rowKey = resolveRowKey(sheetName, keyColumn, keyValue);
    if (!rowKey) {
      throw new Error(`Couldn't find that record (${keyColumn} = ${keyValue}) to delete.`);
    }
    SessionStore.deleteRow(sheetName, rowKey);
  }

  async function createPO(fields) {
    const sheetName = CONFIG.SHEETS.purchaseOrders;
    const existing = currentRows(sheetName);
    const seq = existing.length + 1;
    const year = new Date().getFullYear();
    const poNumber = `PO-${year}-${String(seq).padStart(4, "0")}`;

    const row = SessionStore.appendRow(sheetName, {
      ...fields,
      "PO Number": poNumber,
      "Created Date": fields["Created Date"] || Fmt.localDateStr(new Date()),
      Status: fields["Status"] || "Pending",
    });
    return { poNumber, row };
  }

  return { isConfigured, updateRow, appendRow, deleteRow, createPO };
})();
