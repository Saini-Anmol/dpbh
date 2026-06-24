// DigiCom content script — hybrid detection.
// Stage 1: fast regex heuristics (immediate highlighting)
// Stage 2: ML classification via DistilBERT for remaining text (async, ~50-150ms/batch)

// Pure detection logic lives in detection.js (loaded first; testable in isolation).
const { SEVERITY_MAP, classifyHeuristic, looksLikeUIText, hashText, isBenignUIText, scorePattern } =
  DigiComDetection;

const TIER_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const TIER_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const ML_BATCH_SIZE = 24;
const ML_BATCH_DELAY_MS = 50;
const ML_MAX_CANDIDATES = 400; // hard cap on text snippets sent to the model per page
const MUTATION_DEBOUNCE_MS = 400; // coalesce DOM-change bursts before re-scanning

// User settings (loaded from chrome.storage via the shared settings module).
// Starts at defaults so detection logic is always safe to call before load resolves.
let settings = DigiComSettings.DEFAULTS;

function isCategoryEnabled(category) {
  // Categories without an explicit toggle (none today) default to enabled.
  return settings.categories[category] !== false;
}

const state = {
  byCategory: {},
  cursor: {},
  nextId: 0,
  seenTextHashes: new Set(),
};

// -----  DOM helpers  -----
function isIgnorableNode(el) {
  if (!el) return true;
  const tag = el.tagName;
  if (!tag) return true;
  if (["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG", "CANVAS"].includes(tag)) return true;
  if (el.closest("[data-digicom-highlighted]")) return true;
  if (el.closest("[data-digicom-ui]")) return true; // our own on-page panel
  return false;
}

// -----  DOM scanning & highlighting  -----
function collectTextNodes(root = document.body) {
  if (!root) return [];
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (isIgnorableNode(node.parentElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

function applyHighlight(node, category, severity, source, confidence) {
  if (!isCategoryEnabled(category)) return;
  const parent = node.parentElement;
  if (!parent || parent.dataset.digicomHighlighted) return;
  if (!document.body.contains(node)) return;

  const { score, tier } = scorePattern(category, confidence);
  const id = `digicom-${state.nextId++}`;
  const wrap = document.createElement("mark");
  wrap.id = id;
  wrap.className = `digicom-highlight digicom-sev-${severity} digicom-tier-${tier}`;
  wrap.dataset.digicomCategory = category;
  wrap.dataset.digicomSource = source;
  wrap.dataset.digicomHighlighted = "true";
  wrap.title = `DigiCom: ${category} · risk ${score}/10 (${TIER_LABEL[tier]}) · ${source}`;
  wrap.textContent = node.nodeValue;
  parent.replaceChild(wrap, node);

  if (!state.byCategory[category]) {
    state.byCategory[category] = [];
    state.cursor[category] = 0;
  }
  state.byCategory[category].push({
    id,
    severity,
    score,
    tier,
    text: (node.nodeValue || "").trim(),
  });
}

function getCounts() {
  const counts = {};
  for (const [cat, arr] of Object.entries(state.byCategory)) counts[cat] = arr.length;
  return counts;
}

function notifyCounts() {
  chrome.runtime.sendMessage({ type: "DIGICOM_DETECTION", counts: getCounts() }).catch(() => {});
  updatePanel();
}

// -----  On-page summary panel  -----
const SEV_ORDER = { high: 0, moderate: 1, low: 2 };
let panelDismissed = false;
let panelTimer = null;
let panelView = { mode: "list" }; // "list" = categories, or { mode: "detail", category }

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
function truncate(s, n) {
  s = (s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Throttle re-renders: detections arrive in bursts; rebuilding the panel every time is wasteful.
function updatePanel() {
  if (panelTimer) return;
  panelTimer = setTimeout(() => {
    panelTimer = null;
    renderPanel();
  }, 250);
}

function removePanel() {
  document.getElementById("digicom-panel")?.remove();
}

function ensurePanel() {
  let panel = document.getElementById("digicom-panel");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "digicom-panel";
  panel.dataset.digicomUi = "true";
  panel.innerHTML = `
    <div class="digicom-panel-head" data-digicom-head>
      <span class="digicom-panel-logo">🛡</span>
      <span class="digicom-panel-title">DigiCom</span>
      <span class="digicom-panel-total" data-digicom-total>0</span>
      <button class="digicom-panel-btn" data-digicom-min title="Minimize">–</button>
      <button class="digicom-panel-btn" data-digicom-close title="Hide for now">×</button>
    </div>
    <div class="digicom-panel-sub" data-digicom-sub></div>
    <div class="digicom-panel-body" data-digicom-body></div>`;
  (document.body || document.documentElement).appendChild(panel);

  panel.querySelector("[data-digicom-min]").addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("digicom-collapsed");
  });
  panel.querySelector("[data-digicom-close]").addEventListener("click", (e) => {
    e.stopPropagation();
    panelDismissed = true;
    removePanel();
  });
  panel.querySelector("[data-digicom-head]").addEventListener("click", () => {
    panel.classList.remove("digicom-collapsed");
  });
  return panel;
}

function worstTierOf(list) {
  let t = "low";
  for (const e of list || []) if (TIER_ORDER[e.tier] < TIER_ORDER[t]) t = e.tier;
  return t;
}
function pageRisk() {
  let tier = "low";
  let max = 0;
  for (const list of Object.values(state.byCategory))
    for (const e of list) {
      if (TIER_ORDER[e.tier] < TIER_ORDER[tier]) tier = e.tier;
      if ((e.score || 0) > max) max = e.score;
    }
  return { tier, max };
}
function isAnalyzing() {
  return running && (mlQueue.length > 0 || !!mlFlushTimer);
}

function renderPanel() {
  if (panelDismissed || !running) return removePanel();
  const counts = getCounts();
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  if (!total) {
    panelView = { mode: "list" };
    return removePanel();
  }

  const panel = ensurePanel();
  panel.querySelector("[data-digicom-total]").textContent = total;
  const sub = panel.querySelector("[data-digicom-sub]");
  const body = panel.querySelector("[data-digicom-body]");
  const analyzing = isAnalyzing() ? `<span class="digicom-panel-analyzing">analyzing…</span>` : "";

  const detailList = panelView.mode === "detail" ? state.byCategory[panelView.category] : null;

  if (detailList && detailList.length) {
    // ----- detail view: every occurrence of one category (score + click to jump) -----
    const cat = panelView.category;
    const worst = worstTierOf(detailList);
    sub.innerHTML = `<button class="digicom-panel-back" data-digicom-back>‹ all</button>
      <span class="digicom-panel-badge digicom-tbadge-${worst}">${TIER_LABEL[worst]}</span>
      <span class="digicom-panel-heading">${escapeHtml(cat)} · ${detailList.length}</span>${analyzing}`;
    body.innerHTML = detailList
      .map(
        (e) =>
          `<button class="digicom-panel-item digicom-tl-${e.tier}" data-digicom-id="${e.id}"
                   title="Risk ${e.score}/10 · ${TIER_LABEL[e.tier]}">
            <span class="digicom-panel-score digicom-tbadge-${e.tier}">${e.score}</span>
            <span class="digicom-panel-text">${escapeHtml(truncate(e.text, 90))}</span>
          </button>`
      )
      .join("");
    sub.querySelector("[data-digicom-back]").addEventListener("click", () => {
      panelView = { mode: "list" };
      renderPanel();
    });
    body.querySelectorAll("[data-digicom-id]").forEach((it) => {
      it.addEventListener("click", () => jumpToId(it.dataset.digicomId));
    });
    return;
  }

  // ----- list view: categories ranked by risk tier, click to expand -----
  panelView = { mode: "list" };
  const risk = pageRisk();
  sub.innerHTML =
    `<span class="digicom-panel-risk digicom-ttext-${risk.tier}">Page risk: ${TIER_LABEL[risk.tier]} · ${risk.max}/10</span>` +
    analyzing;
  const entries = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([cat, n]) => [cat, n, worstTierOf(state.byCategory[cat])])
    .sort((a, b) =>
      TIER_ORDER[a[2]] !== TIER_ORDER[b[2]] ? TIER_ORDER[a[2]] - TIER_ORDER[b[2]] : b[1] - a[1]
    );
  body.innerHTML = entries
    .map(
      ([cat, n, tier]) =>
        `<button class="digicom-panel-row digicom-tl-${tier}" data-digicom-cat="${cat}">
          <span class="digicom-panel-dot digicom-tdot-${tier}"></span>
          <span class="digicom-panel-cat">${cat}</span>
          <span class="digicom-panel-badge digicom-tbadge-${tier}">${TIER_LABEL[tier]}</span>
          <span class="digicom-panel-count">${n}</span>
          <span class="digicom-panel-arrow">›</span>
        </button>`
    )
    .join("");
  body.querySelectorAll("[data-digicom-cat]").forEach((row) => {
    row.addEventListener("click", () => {
      panelView = { mode: "detail", category: row.dataset.digicomCat };
      renderPanel();
    });
  });
}

// The currently "active" highlight (persistent sparkling-yellow border until another is picked).
let activeMark = null;

function setActive(el) {
  if (activeMark && activeMark !== el) activeMark.classList.remove("digicom-active");
  activeMark = el;
  el.classList.add("digicom-active");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // brief attention pulse on top of the persistent border
  el.classList.remove("digicom-focus");
  void el.offsetWidth;
  el.classList.add("digicom-focus");
  setTimeout(() => el.classList.remove("digicom-focus"), 2000);
}

// Drop highlights whose element vanished (dynamic pages re-render and remove our <mark>s),
// so panel counts/lists stay accurate and clicks don't silently no-op.
function pruneDeadHighlights() {
  let changed = false;
  for (const cat of Object.keys(state.byCategory)) {
    const kept = state.byCategory[cat].filter((e) => {
      const el = document.getElementById(e.id);
      return el && el.isConnected;
    });
    if (kept.length !== state.byCategory[cat].length) changed = true;
    if (kept.length) state.byCategory[cat] = kept;
    else {
      delete state.byCategory[cat];
      delete state.cursor[cat];
    }
  }
  return changed;
}

// Jump to one specific highlight by id (used by the per-category list in the panel).
function jumpToId(id) {
  const el = document.getElementById(id);
  if (el && el.isConnected) {
    setActive(el);
    return { ok: true };
  }
  // Stale entry: the element is gone. Prune, refresh the panel, and fall back to another
  // live occurrence of the same category so the click still does something useful.
  const cat = (Object.entries(state.byCategory).find(([, list]) => list.some((e) => e.id === id)) ||
    [])[0];
  pruneDeadHighlights();
  notifyCounts();
  if (cat && state.byCategory[cat]?.length) return jumpToNext(cat);
  return { ok: false };
}

// Cycle to the next live occurrence of a category (used by the popup).
function jumpToNext(category) {
  const list = state.byCategory[category];
  if (!list || !list.length) return { ok: false };
  let attempts = list.length;
  while (attempts-- > 0) {
    const idx = state.cursor[category] % list.length;
    state.cursor[category] = (idx + 1) % list.length;
    const el = document.getElementById(list[idx].id);
    if (el && el.isConnected) {
      setActive(el);
      return { ok: true, index: idx + 1, total: list.length };
    }
  }
  return { ok: false };
}

// -----  Stage 1: heuristic pass  -----
function runHeuristicPass(root = document.body) {
  const nodes = collectTextNodes(root);
  const mlCandidates = [];

  for (const node of nodes) {
    // Skip common benign e-commerce labels ("Contact us", "Cancellation & Returns", …)
    // so neither stage flags them as dark patterns.
    if (isBenignUIText(node.nodeValue)) continue;
    const heuristic = classifyHeuristic(node.nodeValue);
    if (heuristic) {
      // Heuristic matches are explicit patterns → treat as high-confidence (0.9).
      applyHighlight(node, heuristic.category, heuristic.severity, "heuristic", 0.9);
      continue;
    }
    if (!looksLikeUIText(node.nodeValue)) continue;
    const hash = hashText(node.nodeValue);
    if (state.seenTextHashes.has(hash)) continue;
    state.seenTextHashes.add(hash);
    mlCandidates.push(node);
  }

  if (nodes.length) notifyCounts();
  return mlCandidates;
}

// -----  Stage 2: ML pass (async, batched)  -----
const mlQueue = [];
let mlFlushTimer = null;
let mlProcessedCount = 0;

function enqueueForML(nodes) {
  // Cap total ML work per page so heavy/infinite-scroll sites can't flood the queue
  // (each classification runs a 194 MB model — unbounded work freezes the experience).
  for (const n of nodes) {
    if (mlQueue.length + mlProcessedCount >= ML_MAX_CANDIDATES) break;
    mlQueue.push(n);
  }
  if (!mlFlushTimer && mlQueue.length) {
    mlFlushTimer = setTimeout(flushMLQueue, ML_BATCH_DELAY_MS);
  }
}

async function flushMLQueue() {
  mlFlushTimer = null;
  while (mlQueue.length) {
    const batchNodes = mlQueue.splice(0, ML_BATCH_SIZE).filter((n) => document.body.contains(n));
    mlProcessedCount += batchNodes.length;
    if (!batchNodes.length) continue;
    const texts = batchNodes.map((n) => n.nodeValue.trim());
    try {
      const resp = await chrome.runtime.sendMessage({ type: "DIGICOM_CLASSIFY", texts });
      if (!resp?.ok) continue;
      let newHighlights = 0;
      resp.results.forEach((r, i) => {
        if (!r) return;
        if (r.label === "Not Dark Pattern") return;
        if (r.score < settings.threshold) return;
        const node = batchNodes[i];
        const severity = SEVERITY_MAP[r.label] || "low";
        applyHighlight(node, r.label, severity, "ml", r.score);
        newHighlights++;
      });
      if (newHighlights) notifyCounts();
    } catch {
      // silently drop — ML may not be ready yet or offscreen doc gone
    }
    // small breath between batches to keep the page responsive
    await new Promise((r) => setTimeout(r, 0));
  }
}

// -----  Wiring  -----
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "DIGICOM_GET_COUNTS") {
    sendResponse({ counts: getCounts() });
    return true;
  }
  if (msg?.type === "DIGICOM_JUMP_NEXT") {
    sendResponse(jumpToNext(msg.category));
    return true;
  }
  return false;
});

// -----  Un-highlighting (for live settings changes)  -----
function unwrapHighlight(el) {
  if (!el || !el.parentNode) return;
  el.replaceWith(document.createTextNode(el.textContent));
}

function clearCategory(category) {
  document
    .querySelectorAll(`mark.digicom-highlight[data-digicom-category="${CSS.escape(category)}"]`)
    .forEach(unwrapHighlight);
  delete state.byCategory[category];
  delete state.cursor[category];
  notifyCounts();
}

function clearAllHighlights() {
  document.querySelectorAll("mark.digicom-highlight").forEach(unwrapHighlight);
  state.byCategory = {};
  state.cursor = {};
  state.seenTextHashes = new Set();
  notifyCounts();
}

// -----  Lifecycle  -----
// Observe DOM changes (timers, lazy-loaded cards, carousels). Only active while running.
// Bursts of mutations are COALESCED and scanned once per debounce window — scanning
// synchronously on every mutation freezes heavy/dynamic sites (e.g. marketplaces).
const pendingRoots = new Set();
let scanTimer = null;

function flushPendingScan() {
  scanTimer = null;
  const roots = [...pendingRoots].filter((n) => n.isConnected);
  pendingRoots.clear();
  if (!roots.length) return;
  const newCandidates = [];
  for (const root of roots) newCandidates.push(...runHeuristicPass(root));
  if (newCandidates.length) enqueueForML(newCandidates);
}

const observer = new MutationObserver((mutations) => {
  let added = false;
  for (const m of mutations) {
    m.addedNodes.forEach((n) => {
      if (n.nodeType === Node.ELEMENT_NODE && !isIgnorableNode(n)) {
        pendingRoots.add(n);
        added = true;
      }
    });
  }
  if (added && !scanTimer) scanTimer = setTimeout(flushPendingScan, MUTATION_DEBOUNCE_MS);
});

let running = false;

function start() {
  if (running) return;
  running = true;
  panelDismissed = false;
  chrome.runtime.sendMessage({ type: "DIGICOM_WARMUP" }).catch(() => {});
  enqueueForML(runHeuristicPass());
  observer.observe(document.body, { childList: true, subtree: true });
}

function stop() {
  if (!running) return;
  running = false;
  observer.disconnect();
  clearTimeout(scanTimer);
  scanTimer = null;
  pendingRoots.clear();
  clearAllHighlights();
}

// Re-scan text that was previously skipped (e.g. threshold lowered or category re-enabled).
// Already-highlighted nodes are skipped by collectTextNodes, so this won't duplicate work.
function rescan() {
  state.seenTextHashes = new Set();
  mlProcessedCount = 0; // allow the capped budget to re-fill for the fresh pass
  enqueueForML(runHeuristicPass());
}

function handleSettingsChange(next, prev) {
  const host = location.hostname;
  const wasActive = DigiComSettings.isActive(prev, host);
  settings = next;
  const nowActive = DigiComSettings.isActive(next, host);

  if (!nowActive) return stop();
  if (!wasActive && nowActive) return start();

  // Both active: apply category + threshold deltas without a full reload.
  for (const cat of DigiComSettings.CATEGORIES) {
    if (prev.categories[cat] && !next.categories[cat]) clearCategory(cat);
  }
  const categoryReEnabled = DigiComSettings.CATEGORIES.some(
    (c) => !prev.categories[c] && next.categories[c]
  );
  if (categoryReEnabled || next.threshold < prev.threshold) rescan();
}

(async function init() {
  settings = await DigiComSettings.load();
  DigiComSettings.onChange(handleSettingsChange);
  if (DigiComSettings.isActive(settings, location.hostname)) start();
})();
