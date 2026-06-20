// Options page logic. Reads/writes the shared settings object; every change is persisted
// immediately to chrome.storage.sync, which the content scripts react to live.

const { CATEGORIES, THRESHOLD_MIN, THRESHOLD_MAX, DEFAULTS, load, save, normalize } =
  globalThis.DigiComSettings;

const SEVERITY = {
  "Forced Action": "high",
  Obstruction: "high",
  Sneaking: "high",
  Urgency: "moderate",
  Scarcity: "moderate",
  Misdirection: "moderate",
  "Social Proof": "low",
};

const el = {
  enabled: document.getElementById("enabled"),
  threshold: document.getElementById("threshold"),
  thresholdVal: document.getElementById("threshold-val"),
  categories: document.getElementById("categories"),
  siteInput: document.getElementById("site-input"),
  siteAddBtn: document.getElementById("site-add-btn"),
  siteList: document.getElementById("site-list"),
  reset: document.getElementById("reset"),
  saved: document.getElementById("saved"),
  detailCard: document.getElementById("detail-card"),
  categoryCard: document.getElementById("category-card"),
};

let settings = structuredClone(DEFAULTS);
let savedTimer = null;

function flashSaved() {
  el.saved.classList.add("show");
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => el.saved.classList.remove("show"), 1200);
}

async function persist() {
  settings = normalize(settings);
  await save(settings);
  flashSaved();
}

function pct(threshold) {
  return `${Math.round(threshold * 100)}%`;
}

function renderCategories() {
  el.categories.innerHTML = "";
  for (const cat of CATEGORIES) {
    const sev = SEVERITY[cat] || "low";
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div>
        <div class="label"><span class="dot ${sev}"></span>${cat}</div>
        <div class="sub">Severity: ${sev}</div>
      </div>
      <label class="switch">
        <input type="checkbox" data-cat="${cat}" ${settings.categories[cat] ? "checked" : ""} />
        <span class="slider"></span>
      </label>`;
    el.categories.appendChild(row);
  }
  el.categories.querySelectorAll("input[data-cat]").forEach((input) => {
    input.addEventListener("change", () => {
      settings.categories[input.dataset.cat] = input.checked;
      persist();
    });
  });
}

function renderSites() {
  el.siteList.innerHTML = "";
  if (!settings.disabledSites.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No sites disabled.";
    el.siteList.appendChild(li);
    return;
  }
  for (const host of settings.disabledSites) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = host;
    const btn = document.createElement("button");
    btn.className = "danger";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      settings.disabledSites = settings.disabledSites.filter((h) => h !== host);
      persist();
      renderSites();
    });
    li.append(span, btn);
    el.siteList.appendChild(li);
  }
}

// Normalize user input ("https://www.Example.com/path") down to a bare hostname.
function parseHostname(raw) {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.toLowerCase();
  } catch {
    return (
      value
        .toLowerCase()
        .replace(/^www\./, "")
        .split("/")[0] || null
    );
  }
}

function addSite() {
  const host = parseHostname(el.siteInput.value);
  if (!host) return;
  if (!settings.disabledSites.includes(host)) {
    settings.disabledSites.push(host);
    settings.disabledSites.sort();
    persist();
    renderSites();
  }
  el.siteInput.value = "";
  el.siteInput.focus();
}

function reflectEnabledState() {
  const disabled = !settings.enabled;
  el.detailCard.setAttribute("aria-disabled", String(disabled));
  el.categoryCard.setAttribute("aria-disabled", String(disabled));
}

function renderAll() {
  el.enabled.checked = settings.enabled;
  el.threshold.min = String(Math.round(THRESHOLD_MIN * 100));
  el.threshold.max = String(Math.round(THRESHOLD_MAX * 100));
  el.threshold.value = String(Math.round(settings.threshold * 100));
  el.thresholdVal.textContent = pct(settings.threshold);
  renderCategories();
  renderSites();
  reflectEnabledState();
}

// ----- wiring -----
el.enabled.addEventListener("change", () => {
  settings.enabled = el.enabled.checked;
  reflectEnabledState();
  persist();
});

el.threshold.addEventListener("input", () => {
  settings.threshold = Number(el.threshold.value) / 100;
  el.thresholdVal.textContent = pct(settings.threshold);
});
el.threshold.addEventListener("change", persist);

el.siteAddBtn.addEventListener("click", addSite);
el.siteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite();
});

el.reset.addEventListener("click", async () => {
  settings = structuredClone(DEFAULTS);
  renderAll();
  await persist();
});

(async function initOptions() {
  settings = await load();
  renderAll();
})();
