(function () {
  window.Crud = window.Crud || {};

  Crud.renderTable = function (container, tableConfig, rows) {
    const state = { search: "", page: 1, pageSize: 10 };

    function filtered() {
      if (!state.search) return rows;
      const q = state.search.toLowerCase();
      return rows.filter((r) =>
        Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))
      );
    }

    function fieldId(key) {
      return `field-${tableConfig.id}-${key.replace(/\W+/g, "_")}`;
    }

    function formatCell(value, type) {
      if (value === null || value === undefined || value === "") return "—";
      if (type === "date") return Fmt.date(value);
      if (type === "number") {
        const n = Number(value);
        return Fmt.num(n, Number.isInteger(n) ? 0 : 2);
      }
      return Fmt.escapeHtml(String(value));
    }

    function renderField(col, value) {
      const id = fieldId(col.key);
      if (col.type === "select") {
        const opts = col.options
          .map((o) => `<option value="${o}" ${o === value ? "selected" : ""}>${o}</option>`)
          .join("");
        return `<div class="field">
          <label for="${id}">${Fmt.escapeHtml(col.label)}${col.required ? " *" : ""}</label>
          <select id="${id}" class="select-input">${opts}</select>
        </div>`;
      }
      if (col.type === "date") {
        const val = Fmt.localDateStr(value);
        return `<div class="field">
          <label for="${id}">${Fmt.escapeHtml(col.label)}${col.required ? " *" : ""}</label>
          <input id="${id}" type="date" value="${val}" />
        </div>`;
      }
      if (col.type === "number") {
        return `<div class="field">
          <label for="${id}">${Fmt.escapeHtml(col.label)}${col.required ? " *" : ""}</label>
          <input id="${id}" type="number" step="0.01" value="${value ?? ""}" />
        </div>`;
      }
      return `<div class="field">
        <label for="${id}">${Fmt.escapeHtml(col.label)}${col.required ? " *" : ""}</label>
        <input id="${id}" type="text" value="${Fmt.escapeHtml(value ?? "")}" />
      </div>`;
    }

    function openModal(existingRow) {
      const isEdit = Boolean(existingRow);
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal">
          <h3>${isEdit ? "Edit" : "Add"} ${Fmt.escapeHtml(tableConfig.label)} Record</h3>
          <div class="modal-fields">
            ${tableConfig.columns
              .map((c) => renderField(c, existingRow ? existingRow[c.key] : ""))
              .join("")}
          </div>
          <div class="modal-actions">
            <button class="btn" data-action="cancel">Cancel</button>
            <button class="btn btn-primary" data-action="save">${isEdit ? "Save Changes" : "Add Record"}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });
      overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => overlay.remove());

      overlay.querySelector('[data-action="save"]').addEventListener("click", async () => {
        const fields = {};
        tableConfig.columns.forEach((c) => {
          const el = overlay.querySelector("#" + fieldId(c.key));
          if (el) fields[c.key] = el.value;
        });

        const missing = tableConfig.columns.find((c) => c.required && !fields[c.key]);
        if (missing) {
          Fmt.toast(`${missing.label} is required.`, "error");
          return;
        }

        const saveBtn = overlay.querySelector('[data-action="save"]');
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving…";
        try {
          if (isEdit) {
            await WriteAPI.updateRow(
              tableConfig.sheet,
              tableConfig.keyColumn,
              existingRow[tableConfig.keyColumn],
              fields
            );
          } else {
            await WriteAPI.appendRow(tableConfig.sheet, fields);
          }
          Fmt.toast(isEdit ? "Record updated." : "Record added.", "success");
          overlay.remove();
          await App.refresh();
        } catch (err) {
          console.error(err);
          Fmt.toast(err.message || "Save failed.", "error");
          saveBtn.disabled = false;
          saveBtn.textContent = isEdit ? "Save Changes" : "Add Record";
        }
      });
    }

    function render() {
      const data = filtered();
      const totalPages = Math.max(1, Math.ceil(data.length / state.pageSize));
      state.page = Math.min(state.page, totalPages);
      const pageRows = data.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);

      container.innerHTML = `
        <div class="table-toolbar crud-toolbar">
          <input class="search-input" id="crud-search" placeholder="Search ${Fmt.escapeHtml(tableConfig.label)}..." value="${Fmt.escapeHtml(state.search)}" />
          <button class="btn btn-primary" id="crud-add">+ Add Record</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>${tableConfig.columns.map((c) => `<th>${Fmt.escapeHtml(c.label)}</th>`).join("")}<th></th></tr></thead>
            <tbody>
              ${
                pageRows.length === 0
                  ? `<tr><td colspan="${tableConfig.columns.length + 1}" class="empty-state">No records${state.search ? " match your search" : ""}.</td></tr>`
                  : pageRows
                      .map(
                        (row) => `
                <tr>
                  ${tableConfig.columns.map((c) => `<td>${formatCell(row[c.key], c.type)}</td>`).join("")}
                  <td class="row-actions">
                    <button class="btn btn-sm" data-action="edit" data-key="${Fmt.escapeHtml(row[tableConfig.keyColumn])}">Edit</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-key="${Fmt.escapeHtml(row[tableConfig.keyColumn])}">Delete</button>
                  </td>
                </tr>`
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <span>${data.length} record${data.length === 1 ? "" : "s"}</span>
          <div class="pagination-controls">
            <button class="btn btn-sm" id="crud-prev" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
            <span>Page ${state.page} of ${totalPages}</span>
            <button class="btn btn-sm" id="crud-next" ${state.page >= totalPages ? "disabled" : ""}>Next</button>
          </div>
        </div>`;

      container.querySelector("#crud-search").addEventListener("input", (e) => {
        state.search = e.target.value;
        state.page = 1;
        render();
      });
      container.querySelector("#crud-add").addEventListener("click", () => openModal(null));

      container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
        btn.addEventListener("click", () => {
          const row = rows.find((r) => String(r[tableConfig.keyColumn]) === btn.dataset.key);
          openModal(row);
        });
      });
      container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener("click", async () => {
          const key = btn.dataset.key;
          if (!confirm(`Delete this ${tableConfig.label} record (${key})? This can't be undone.`)) return;
          try {
            await WriteAPI.deleteRow(tableConfig.sheet, tableConfig.keyColumn, key);
            Fmt.toast("Record deleted.", "success");
            await App.refresh();
          } catch (err) {
            console.error(err);
            Fmt.toast(err.message || "Delete failed.", "error");
          }
        });
      });

      const prevBtn = container.querySelector("#crud-prev");
      const nextBtn = container.querySelector("#crud-next");
      if (prevBtn)
        prevBtn.addEventListener("click", () => {
          state.page--;
          render();
        });
      if (nextBtn)
        nextBtn.addEventListener("click", () => {
          state.page++;
          render();
        });
    }

    render();
  };
})();
