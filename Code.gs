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

const SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE"; // same as CONFIG.SHEET_ID in js/config.js
const API_KEY = "PASTE_A_LONG_RANDOM_STRING_HERE"; // must match CONFIG.WRITE_API.API_KEY

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.apiKey !== API_KEY) {
      return jsonResponse({ ok: false, error: "Unauthorized." });
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(body.sheet);
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
