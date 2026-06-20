const SEVERITY = {
  "Forced Action": "high",
  Obstruction: "high",
  Sneaking: "high",
  Urgency: "moderate",
  Scarcity: "moderate",
  Misdirection: "moderate",
  "Social Proof": "low",
};

const ML_LABELS = {
  idle: "ML: idle",
  loading: "ML: loading…",
  ready: "ML: active",
  error: "ML: failed",
};

let activeTabId = null;
let activeHost = null;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// ----- per-site enable toggle -----
async function initSiteToggle() {
  const toggle = document.getElementById("site-active");
  const hostEl = document.getElementById("site-host");
  const tab = await getActiveTab();
  activeHost = hostnameOf(tab?.url);

  const settings = await globalThis.DigiComSettings.load();

  if (!activeHost) {
    hostEl.textContent = "Unavailable on this page";
    toggle.checked = false;
    toggle.disabled = true;
    return;
  }

  hostEl.textContent = activeHost;
  toggle.checked = globalThis.DigiComSettings.isActive(settings, activeHost);

  toggle.addEventListener("change", async () => {
    const current = await globalThis.DigiComSettings.load();
    const set = new Set(current.disabledSites);
    if (toggle.checked) set.delete(activeHost);
    else set.add(activeHost);
    current.disabledSites = [...set];
    await globalThis.DigiComSettings.save(current);
  });
}

document.getElementById("open-options")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Single source of truth for the version: the manifest.
const versionEl = document.getElementById("version");
if (versionEl) versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

async function fetchCounts() {
  const tab = await getActiveTab();
  if (!tab?.id) return { counts: {} };
  activeTabId = tab.id;
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "DIGICOM_GET_COUNTS" });
    return { counts: resp?.counts || {} };
  } catch {
    return { counts: {} };
  }
}

async function fetchMLStatus() {
  try {
    return await chrome.runtime.sendMessage({ type: "DIGICOM_GET_ML_STATUS" });
  } catch {
    return { status: "idle" };
  }
}

function renderEmpty(listEl, hintEl) {
  hintEl.style.display = "none";
  listEl.innerHTML = `
    <div class="empty">
      <div class="big">✨</div>
      <div>No dark patterns detected on this page yet.</div>
    </div>`;
}

function renderMode(mlStatus) {
  const el = document.getElementById("mode");
  if (!el) return;
  const status = mlStatus?.status || "idle";
  el.textContent = ML_LABELS[status] || "ML: idle";
  el.dataset.mlStatus = status;
}

function render({ counts }, mlStatus) {
  renderMode(mlStatus);

  const totalEl = document.getElementById("total");
  const listEl = document.getElementById("list");
  const hintEl = document.getElementById("hint");

  const entries = Object.entries(counts).sort((a, b) => {
    const sa = SEVERITY[a[0]] || "low";
    const sb = SEVERITY[b[0]] || "low";
    const order = { high: 0, moderate: 1, low: 2 };
    if (order[sa] !== order[sb]) return order[sa] - order[sb];
    return b[1] - a[1];
  });

  const total = entries.reduce((s, [, n]) => s + n, 0);
  totalEl.textContent = total;

  if (!total) {
    renderEmpty(listEl, hintEl);
    return;
  }

  hintEl.style.display = "block";
  listEl.innerHTML = entries
    .map(([cat, n]) => {
      const sev = SEVERITY[cat] || "low";
      return `
        <div class="row sev-${sev}" data-category="${cat}">
          <span class="dot sev-${sev}"></span>
          <span class="cat-name">${cat}</span>
          <span class="count-pill">${n}</span>
          <span class="arrow">→</span>
        </div>`;
    })
    .join("");

  listEl.querySelectorAll(".row").forEach((row) => {
    row.addEventListener("click", () => jumpToCategory(row.dataset.category));
  });
}

async function jumpToCategory(category) {
  if (!activeTabId) return;
  const statusEl = document.getElementById("status");
  try {
    const resp = await chrome.tabs.sendMessage(activeTabId, {
      type: "DIGICOM_JUMP_NEXT",
      category,
    });
    if (resp?.ok) {
      statusEl.textContent = `${category}: ${resp.index}/${resp.total}`;
      setTimeout(() => window.close(), 120);
    } else {
      statusEl.textContent = "Not found";
    }
  } catch {
    statusEl.textContent = "Tab unreachable";
  }
}

async function refresh() {
  const [counts, mlStatus] = await Promise.all([fetchCounts(), fetchMLStatus()]);
  render(counts, mlStatus);
}

refresh();
initSiteToggle();
// Poll briefly so the badge flips from "loading" → "active" without reopening.
const pollInterval = setInterval(refresh, 1500);
window.addEventListener("unload", () => clearInterval(pollInterval));
