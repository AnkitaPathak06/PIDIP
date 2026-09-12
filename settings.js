(function () {
  window.Pages = window.Pages || {};
  const Pages = window.Pages;

Pages.settings = function (main, model) {
  const r = structuredClone(model.rules);

  main.innerHTML = `
    <div class="page">
      <p class="page-subtitle">Configure inventory thresholds, procurement buffers, supplier scoring weights and forecast settings. Changes recalculate the whole prototype immediately.</p>

      <div class="panel">
        <h3>Inventory Rules</h3>
        <p class="panel-sub">Expiry windows and inventory health target.</p>
        <div class="field-grid">
          ${numberField("near-expiry", "Near Expiry Threshold", r.nearExpiryDays, "days")}
          ${numberField("critical-expiry", "Critical Expiry Threshold", r.criticalExpiryDays, "days")}
          ${numberField("safety-buffer", "Safety Stock Buffer", r.safetyStockBufferPct, "%")}
          ${numberField("health-threshold", "Inventory Health Threshold", r.inventoryHealthThresholdPct, "%")}
        </div>
      </div>

      <div class="panel">
        <h3>Procurement Rules</h3>
        <p class="panel-sub">Reorder buffers, emergency lead time and default order sizing.</p>
        <div class="field-grid">
          ${numberField("reorder-buffer", "Reorder Point Buffer", r.reorderPointBufferPct, "%")}
          ${numberField("emergency-lead", "Emergency Supplier Lead Time", r.emergencyLeadTimeDays, "days")}
          ${numberField("qty-multiplier", "Procurement Quantity Multiplier", r.procurementQtyMultiplier, "× safety stock", 0.1)}
        </div>
      </div>

      <div class="panel">
        <h3>Supplier Scoring</h3>
        <p class="panel-sub">Ranking weights used to compare qualified suppliers. Must total 100%.</p>
        <div class="field-grid">
          ${sliderField("w-reliability", "Reliability Weight", r.supplierWeights.reliability)}
          ${sliderField("w-quality", "Quality Weight", r.supplierWeights.quality)}
          ${sliderField("w-price", "Unit Price Weight", r.supplierWeights.price)}
          ${sliderField("w-leadtime", "Lead Time Weight", r.supplierWeights.leadTime)}
        </div>
        <div id="weight-total-msg" class="weight-total"></div>
      </div>

      <div class="panel">
        <h3>Forecast Settings</h3>
        <p class="panel-sub">Projection horizon and forecasting method.</p>
        <div class="field-grid">
          ${numberField("forecast-window", "Forecast Window", r.forecastWindowDays, "days")}
          <div class="field">
            <label>Forecast Method</label>
            <div class="field-with-suffix">
              <input type="text" value="Linear Trend (Moving Average)" disabled />
              <span>Read only</span>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-actions">
        <button id="reset-btn" class="btn btn-secondary">Reset to Default</button>
        <button id="save-btn" class="btn btn-primary">Save Configuration</button>
      </div>
      <div id="save-msg" class="save-msg"></div>
    </div>
  `;

  function readWeights() {
    return {
      reliability: Number(document.getElementById("w-reliability").value),
      quality: Number(document.getElementById("w-quality").value),
      price: Number(document.getElementById("w-price").value),
      leadTime: Number(document.getElementById("w-leadtime").value),
    };
  }

  function updateWeightTotal() {
    const w = readWeights();
    const total = w.reliability + w.quality + w.price + w.leadTime;
    const msgEl = document.getElementById("weight-total-msg");
    msgEl.textContent = total === 100 ? "Weights are balanced. 100%" : `Weights total ${total}% — should be 100%.`;
    msgEl.className = "weight-total " + (total === 100 ? "weight-ok" : "weight-warn");
  }

  ["w-reliability", "w-quality", "w-price", "w-leadtime"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (e) => {
      document.getElementById(id + "-val").textContent = e.target.value + "%";
      updateWeightTotal();
    });
  });
  updateWeightTotal();

  document.getElementById("save-btn").addEventListener("click", () => {
    const newRules = {
      nearExpiryDays: Number(document.getElementById("near-expiry").value),
      criticalExpiryDays: Number(document.getElementById("critical-expiry").value),
      safetyStockBufferPct: Number(document.getElementById("safety-buffer").value),
      inventoryHealthThresholdPct: Number(document.getElementById("health-threshold").value),
      reorderPointBufferPct: Number(document.getElementById("reorder-buffer").value),
      emergencyLeadTimeDays: Number(document.getElementById("emergency-lead").value),
      procurementQtyMultiplier: Number(document.getElementById("qty-multiplier").value),
      supplierWeights: readWeights(),
      forecastWindowDays: Number(document.getElementById("forecast-window").value),
    };
    Rules.save(newRules);
    App.rebuildModelFromCurrentData(newRules);
    const msg = document.getElementById("save-msg");
    if (msg) {
      msg.textContent = "Saved — dashboard, procurement and supplier views now reflect these rules.";
    }
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    const defaults = Rules.reset();
    App.rebuildModelFromCurrentData(defaults);
  });
};

function numberField(id, label, value, suffix, step = 1) {
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <div class="field-with-suffix">
        <input id="${id}" type="number" step="${step}" value="${value}" />
        <span>${suffix}</span>
      </div>
    </div>`;
}

function sliderField(id, label, value) {
  return `
    <div class="field">
      <label for="${id}">${label} <span id="${id}-val">${value}%</span></label>
      <input id="${id}" type="range" min="0" max="100" step="1" value="${value}" />
    </div>`;
}
})();
