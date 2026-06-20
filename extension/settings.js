// Shared settings module. Classic script (no ES import) so it can be reused by the
// content script, popup, and options page alike. Attaches an API to globalThis.
//
// Loaded BEFORE content.js in the content_scripts list and via <script> in the
// popup/options pages, so `globalThis.DigiComSettings` is always available first.

(function () {
  const CATEGORIES = [
    "Forced Action",
    "Misdirection",
    "Obstruction",
    "Scarcity",
    "Sneaking",
    "Social Proof",
    "Urgency",
  ];

  const THRESHOLD_MIN = 0.5;
  const THRESHOLD_MAX = 0.95;
  const KEY = "digicomSettings";

  const DEFAULTS = {
    enabled: true,
    threshold: 0.7,
    categories: Object.fromEntries(CATEGORIES.map((c) => [c, true])),
    disabledSites: [],
  };

  function clampThreshold(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return DEFAULTS.threshold;
    return Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, n));
  }

  // Merge stored (possibly partial / stale) settings onto defaults defensively.
  function normalize(stored) {
    const out = structuredClone(DEFAULTS);
    if (stored && typeof stored === "object") {
      if (typeof stored.enabled === "boolean") out.enabled = stored.enabled;
      out.threshold = clampThreshold(stored.threshold);
      if (stored.categories && typeof stored.categories === "object") {
        for (const c of CATEGORIES) {
          if (typeof stored.categories[c] === "boolean") out.categories[c] = stored.categories[c];
        }
      }
      if (Array.isArray(stored.disabledSites)) {
        out.disabledSites = [
          ...new Set(stored.disabledSites.filter((h) => typeof h === "string" && h.trim())),
        ];
      }
    }
    return out;
  }

  async function load() {
    try {
      const got = await chrome.storage.sync.get(KEY);
      return normalize(got[KEY]);
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  async function save(settings) {
    await chrome.storage.sync.set({ [KEY]: normalize(settings) });
  }

  function onChange(cb) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes[KEY]) return;
      cb(normalize(changes[KEY].newValue), normalize(changes[KEY].oldValue));
    });
  }

  function isSiteDisabled(settings, hostname) {
    return !!hostname && settings.disabledSites.includes(hostname);
  }

  // The extension is "active" on a page when globally enabled and the site isn't excluded.
  function isActive(settings, hostname) {
    return settings.enabled && !isSiteDisabled(settings, hostname);
  }

  globalThis.DigiComSettings = {
    CATEGORIES,
    THRESHOLD_MIN,
    THRESHOLD_MAX,
    KEY,
    DEFAULTS,
    normalize,
    clampThreshold,
    load,
    save,
    onChange,
    isSiteDisabled,
    isActive,
  };
})();
