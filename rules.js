// ---------------------------------------------------------------------------
// Business rules are the configurable thresholds shown on the Settings page.
// Since this is a static site with no backend, rules are persisted in the
// browser's localStorage (per-device). Swap this for a small Apps Script
// endpoint later if you want rules shared across devices/users.
// ---------------------------------------------------------------------------

const Rules = (() => {
  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.RULES_STORAGE_KEY);
      if (!raw) return structuredClone(CONFIG.DEFAULT_RULES);
      const parsed = JSON.parse(raw);
      // shallow-merge with defaults so new fields introduced later don't break old saves
      return {
        ...structuredClone(CONFIG.DEFAULT_RULES),
        ...parsed,
        supplierWeights: {
          ...CONFIG.DEFAULT_RULES.supplierWeights,
          ...(parsed.supplierWeights || {}),
        },
      };
    } catch (e) {
      console.warn("Could not read saved business rules, using defaults.", e);
      return structuredClone(CONFIG.DEFAULT_RULES);
    }
  }

  function save(rules) {
    localStorage.setItem(CONFIG.RULES_STORAGE_KEY, JSON.stringify(rules));
  }

  function reset() {
    localStorage.removeItem(CONFIG.RULES_STORAGE_KEY);
    return structuredClone(CONFIG.DEFAULT_RULES);
  }

  return { load, save, reset };
})();
