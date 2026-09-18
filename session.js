// ---------------------------------------------------------------------------
// Every "edit" a visitor makes lives ONLY in their own browser (localStorage).
// It is layered on top of the live Google Sheet data at render time and is
// never sent to Google, never sent to any server, and never seen by anyone
// else. Refreshing the page re-fetches the real sheet and re-applies this
// visitor's own local overlay on top of it.
// ---------------------------------------------------------------------------

const SessionStore = (() => {
  const STORAGE_KEY = "pidip_session_overlay_v1";

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("Could not read local session changes, starting fresh.", e);
      return {};
    }
  }

  function saveAll(all) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function getSheetOverlay(sheetName) {
    const all = loadAll();
    return all[sheetName] || { edits: {}, additions: [], deletions: [] };
  }

  function setSheetOverlay(sheetName, overlay) {
    const all = loadAll();
    all[sheetName] = overlay;
    saveAll(all);
  }

  // rowKey is always the row's internal `_rowKey`, never a "business" column.
  function updateRow(sheetName, rowKey, fields) {
    const overlay = getSheetOverlay(sheetName);
    const additionIdx = overlay.additions.findIndex((a) => a._rowKey === rowKey);
    if (additionIdx !== -1) {
      overlay.additions[additionIdx] = { ...overlay.additions[additionIdx], ...fields };
    } else {
      overlay.edits[rowKey] = { ...(overlay.edits[rowKey] || {}), ...fields };
    }
    setSheetOverlay(sheetName, overlay);
  }

  function appendRow(sheetName, fields) {
    const overlay = getSheetOverlay(sheetName);
    const rowKey = `${sheetName}#local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const row = { ...fields, _rowKey: rowKey };
    overlay.additions.push(row);
    setSheetOverlay(sheetName, overlay);
    return row;
  }

  function deleteRow(sheetName, rowKey) {
    const overlay = getSheetOverlay(sheetName);
    overlay.additions = overlay.additions.filter((a) => a._rowKey !== rowKey);
    if (!overlay.deletions.includes(rowKey)) overlay.deletions.push(rowKey);
    delete overlay.edits[rowKey];
    setSheetOverlay(sheetName, overlay);
  }

  // Merge this visitor's local overlay on top of freshly-fetched live rows.
  function applyOverlay(sheetName, liveRows) {
    const overlay = getSheetOverlay(sheetName);
    const deletionSet = new Set(overlay.deletions);
    const merged = liveRows
      .filter((row) => !deletionSet.has(row._rowKey))
      .map((row) => (overlay.edits[row._rowKey] ? { ...row, ...overlay.edits[row._rowKey] } : row));
    return [...merged, ...overlay.additions];
  }

  function resetAll() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function hasAnyChanges() {
    const all = loadAll();
    return Object.values(all).some(
      (o) => Object.keys(o.edits || {}).length > 0 || (o.additions || []).length > 0 || (o.deletions || []).length > 0
    );
  }

  return { getSheetOverlay, updateRow, appendRow, deleteRow, applyOverlay, resetAll, hasAnyChanges };
})();
