/**
 * PIDIP write-back endpoint.
 *
 * Deploy this as a Web App (Extensions -> Apps Script, paste this file,
 * then Deploy -> New deployment -> Web app -> Execute as: Me,
 * Who has access: Anyone).
 *
 * IMPORTANT SECURITY NOTE:
 * This is a static prototype with no server, so API_KEY below is NOT a real
 * secret — anyone who views your site's JS source can read it. It only
 * stops casual/accidental writes, not a determined attacker. Do not use
 * this pattern for real production or sensitive data. See the README for
 * more robust alternatives (OAuth, a proper backend, restricting the
 * deployment, etc.) if this ever needs to be more than a portfolio demo.
 */

const SHEET_ID = "1c0Y6l1460VoFQtiTQ70nFekFMeM87dEVjMKOBlYkzDQ"; // same as CONFIG.SHEET_ID in js/config.js
const API_KEY = "7214d243207dd500bdc8177de95a28a75f7deca5"; // must match CONFIG.WRITE_API.API_KEY

// Header row used if a referenced sheet doesn't exist yet (e.g. Purchase
// Orders won't exist in an older copy of the sheet — this creates it with
// the right columns automatically on first write).
const SHEET_TEMPLATES = {
  "Purchase Orders": [
    "PO Number",
    "Supplier ID",
    "Supplier Name",
    "Material ID",
    "Material Name",
    "Quantity",
    "Unit",
    "Lead Time (Days)",
    "Expected Date",
    "Status",
    "Created Date",
  ],
};

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.apiKey !== API_KEY) {
      return jsonResponse({ ok: false, error: "Unauthorized." });
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getOrCreateSheet_(ss, body.sheet);
    if (!sheet) {
      return jsonResponse({ ok: false, error: "Unknown sheet: " + body.sheet });
    }

    let result;
    switch (body.action) {
      case "update":
        result = updateRow(sheet, body.keyColumn, body.keyValue, body.fields || {});
        break;
      case "append":
        result = appendRow(sheet, body.fields || {});
        break;
      case "delete":
        result = deleteRow(sheet, body.keyColumn, body.keyValue);
        break;
      case "createPO":
        result = createPurchaseOrder(sheet, body.fields || {});
        break;
      default:
        result = { ok: false, error: "Unknown action: " + body.action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  return jsonResponse({ ok: true, message: "PIDIP write-back endpoint is running." });
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  if (!SHEET_TEMPLATES[name]) return null;
  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, SHEET_TEMPLATES[name].length).setValues([SHEET_TEMPLATES[name]]);
  sheet.setFrozenRows(1);
  return sheet;
}

function createPurchaseOrder(sheet, fields) {
  const headers = getHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  const seq = lastRow < 1 ? 1 : lastRow; // header row counts as 0 POs so far
  const year = new Date().getFullYear();
  const poNumber = `PO-${year}-${String(seq).padStart(4, "0")}`;

  const finalFields = Object.assign({}, fields, {
    "PO Number": poNumber,
    "Created Date": fields["Created Date"] || new Date().toLocaleDateString("en-US"),
    Status: fields["Status"] || "Pending",
  });

  const row = headers.map((h) =>
    Object.prototype.hasOwnProperty.call(finalFields, h) ? finalFields[h] : ""
  );
  sheet.appendRow(row);
  return { ok: true, poNumber, appendedRow: sheet.getLastRow() };
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function updateRow(sheet, keyColumn, keyValue, fields) {
  const headers = getHeaders_(sheet);
  const keyIdx = headers.indexOf(keyColumn);
  if (keyIdx === -1) return { ok: false, error: "Key column not found: " + keyColumn };

  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][keyIdx]) === String(keyValue)) {
      Object.keys(fields).forEach((col) => {
        const idx = headers.indexOf(col);
        if (idx !== -1) sheet.getRange(r + 1, idx + 1).setValue(fields[col]);
      });
      return { ok: true, updatedRow: r + 1 };
    }
  }
  return { ok: false, error: `No row found where ${keyColumn} = ${keyValue}` };
}

function appendRow(sheet, fields) {
  const headers = getHeaders_(sheet);
  const row = headers.map((h) => (Object.prototype.hasOwnProperty.call(fields, h) ? fields[h] : ""));
  sheet.appendRow(row);
  return { ok: true, appendedRow: sheet.getLastRow() };
}

function deleteRow(sheet, keyColumn, keyValue) {
  const headers = getHeaders_(sheet);
  const keyIdx = headers.indexOf(keyColumn);
  if (keyIdx === -1) return { ok: false, error: "Key column not found: " + keyColumn };

  const data = sheet.getDataRange().getValues();
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][keyIdx]) === String(keyValue)) {
      sheet.deleteRow(r + 1);
      return { ok: true, deletedRow: r + 1 };
    }
  }
  return { ok: false, error: `No row found where ${keyColumn} = ${keyValue}` };
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
