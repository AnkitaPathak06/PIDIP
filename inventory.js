(function () {
  window.Pages = window.Pages || {};
  const Pages = window.Pages;

Pages.inventory = function (main, model) {
  const writeEnabled = WriteAPI.isConfigured();
  const state = { search: "", page: 1, pageSize: 10 };

  main.innerHTML = `
    <div class="page">
      <p class="page-subtitle">Current stock position against safety stock and reorder point for every material.</p>
      <div class="panel">
        <div class="table-toolbar">
          <input id="inv-search" class="search-input" type="text" placeholder="Search materials..." />
        </div>
        <div class="table-wrap">
          <table id="inv-table">
            <thead>
              <tr>
                <th>Material</th><th>Category</th><th>Current Stock</th><th>Safety Stock</th>
                <th>Reorder Point</th><th>Batch</th><th>Expiry Date</th><th>Status</th>
                ${writeEnabled ? "<th></th>" : ""}
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="pagination">
          <span id="inv-count"></span>
          <div class="pagination-controls">
            <button class="btn btn-sm" id="inv-prev">Previous</button>
            <span id="inv-page-label"></span>
            <button class="btn btn-sm" id="inv-next">Next</button>
          </div>
        </div>
        ${
          writeEnabled
            ? ""
            : `<div class="write-disabled-note">This is a read-only view of live data. To change values, edit the Google Sheet directly — changes appear here on refresh.</div>`
        }
      </div>
    </div>
  `;

  function filtered() {
    if (!state.search) return model.materials;
    const q = state.search.toLowerCase();
    return model.materials.filter(
      (m) =>
        m.materialName.toLowerCase().includes(q) ||
        m.materialId.toLowerCase().includes(q) ||
        (m.category || "").toLowerCase().includes(q)
    );
  }

  function renderPage() {
    const rows = filtered();
    const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);
    const pageRows = rows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);

    document.querySelector("#inv-table tbody").innerHTML = renderRows(pageRows, writeEnabled);
    document.getElementById("inv-count").textContent = `${rows.length} material${rows.length === 1 ? "" : "s"}`;
    document.getElementById("inv-page-label").textContent = `Page ${state.page} of ${totalPages}`;
    document.getElementById("inv-prev").disabled = state.page <= 1;
    document.getElementById("inv-next").disabled = state.page >= totalPages;

    if (writeEnabled) wireEditing(model);
  }

  document.getElementById("inv-search").addEventListener("input", (e) => {
    state.search = e.target.value;
    state.page = 1;
    renderPage();
  });
  document.getElementById("inv-prev").addEventListener("click", () => {
    state.page--;
    renderPage();
  });
  document.getElementById("inv-next").addEventListener("click", () => {
    state.page++;
    renderPage();
  });

  renderPage();
};

function renderRows(materials, writeEnabled) {
  const colCount = writeEnabled ? 9 : 8;
  if (materials.length === 0) {
    return `<tr><td colspan="${colCount}" class="empty-state">No materials match your search.</td></tr>`;
  }
  return materials
    .map((m) => {
      let status = "Healthy";
      let cls = "badge-green";
      if (m.needsProcurement) {
        status = "Stockout Risk";
        cls = "badge-red";
      } else if (m.belowSafetyStock) {
        status = "Below Safety Stock";
        cls = "badge-amber";
      }
      return `
      <tr data-material-id="${Fmt.escapeHtml(m.materialId)}">
        <td>
          <div class="cell-title">${Fmt.escapeHtml(m.materialName)}</div>
          <div class="cell-sub">${Fmt.escapeHtml(m.materialId)}</div>
        </td>
        <td>${Fmt.escapeHtml(m.category)}</td>
        <td class="td-current-stock">${Fmt.num(m.currentStock)} ${Fmt.escapeHtml(m.unit)}</td>
        <td class="td-safety-stock">${Fmt.num(m.safetyStock)}</td>
        <td class="td-reorder-point">${Fmt.num(m.reorderPoint)}</td>
        <td>${Fmt.escapeHtml(m.batchNumber)}</td>
        <td>${Fmt.date(m.expiryDate)}${m.isNearExpiry ? " <span class='badge badge-amber badge-inline'>Near expiry</span>" : ""}</td>
        <td><span class="badge ${cls}">${status}</span></td>
        ${writeEnabled ? `<td><button class="btn btn-sm edit-btn" data-action="edit">Edit</button></td>` : ""}
      </tr>`;
    })
    .join("");
}

function wireEditing(model) {
  const tbody = document.querySelector("#inv-table tbody");

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const tr = btn.closest("tr");
    const materialId = tr.dataset.materialId;
    const material = model.materials.find((m) => m.materialId === materialId);

    if (btn.dataset.action === "edit") {
      enterEditMode(tr, material);
    } else if (btn.dataset.action === "cancel") {
      tr.outerHTML = renderRows([material], true);
    } else if (btn.dataset.action === "save") {
      await saveEdit(tr, material);
    }
  });
}

function enterEditMode(tr, m) {
  tr.querySelector(".td-current-stock").innerHTML = `<input class="row-input" id="edit-current-stock" type="number" step="0.01" value="${m.currentStock}" />`;
  tr.querySelector(".td-safety-stock").innerHTML = `<input class="row-input" id="edit-safety-stock" type="number" step="0.01" value="${m.safetyStock}" />`;
  tr.querySelector(".td-reorder-point").innerHTML = `<input class="row-input" id="edit-reorder-point" type="number" step="0.01" value="${m.reorderPoint}" />`;
  const lastCell = tr.lastElementChild;
  lastCell.innerHTML = `
    <div class="row-actions">
      <button class="btn btn-primary btn-sm" data-action="save">Save</button>
      <button class="btn btn-sm" data-action="cancel">Cancel</button>
    </div>`;
}

async function saveEdit(tr, material) {
  const currentStock = Number(tr.querySelector("#edit-current-stock").value);
  const safetyStock = Number(tr.querySelector("#edit-safety-stock").value);
  const reorderPoint = Number(tr.querySelector("#edit-reorder-point").value);

  const saveBtn = tr.querySelector('[data-action="save"]');
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    await WriteAPI.updateRow(CONFIG.SHEETS.inventory, "Material ID", material.materialId, {
      "Current Stock": currentStock,
      "Safety Stock": safetyStock,
      "Reorder Point": reorderPoint,
    });
    Fmt.toast(`${material.materialName} updated.`, "success");
    await App.refresh(); // re-fetch sheet + recompute + re-render current page
  } catch (err) {
    console.error(err);
    Fmt.toast(err.message || "Save failed.", "error");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
}
})();
