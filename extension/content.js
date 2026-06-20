// DigiCom content script — hybrid detection.
// Stage 1: fast regex heuristics (immediate highlighting)
// Stage 2: ML classification via DistilBERT for remaining text (async, ~50-150ms/batch)

// Pure detection logic lives in detection.js (loaded first; testable in isolation).
const { SEVERITY_MAP, classifyHeuristic, looksLikeUIText, hashText } = DigiComDetection;

const ML_BATCH_SIZE = 24;
const ML_BATCH_DELAY_MS = 50;

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

function applyHighlight(node, category, severity, source) {
  if (!isCategoryEnabled(category)) return;
  const parent = node.parentElement;
  if (!parent || parent.dataset.digicomHighlighted) return;
  if (!document.body.contains(node)) return;

  const id = `digicom-${state.nextId++}`;
  const wrap = document.createElement("mark");
  wrap.id = id;
  wrap.className = `digicom-highlight digicom-sev-${severity}`;
  wrap.dataset.digicomCategory = category;
  wrap.dataset.digicomSource = source;
  wrap.dataset.digicomHighlighted = "true";
  wrap.title = `DigiCom: ${category} (${severity}) · ${source}`;
  wrap.textContent = node.nodeValue;
  parent.replaceChild(wrap, node);

  if (!state.byCategory[category]) {
    state.byCategory[category] = [];
    state.cursor[category] = 0;
  }
  state.byCategory[category].push({ id, severity });
}

function getCounts() {
  const counts = {};
  for (const [cat, arr] of Object.entries(state.byCategory)) counts[cat] = arr.length;
  return counts;
}

function notifyCounts() {
  chrome.runtime.sendMessage({ type: "DIGICOM_DETECTION", counts: getCounts() }).catch(() => {});
}

function jumpToNext(category) {
  const list = state.byCategory[category];
  if (!list || !list.length) return { ok: false };
  const idx = state.cursor[category] % list.length;
  state.cursor[category] = (idx + 1) % list.length;
  const entry = list[idx];
  const el = document.getElementById(entry.id);
  if (!el) return { ok: false };

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("digicom-focus");
  void el.offsetWidth;
  el.classList.add("digicom-focus");
  setTimeout(() => el.classList.remove("digicom-focus"), 2200);
  return { ok: true, index: idx + 1, total: list.length };
}

// -----  Stage 1: heuristic pass  -----
function runHeuristicPass(root = document.body) {
  const nodes = collectTextNodes(root);
  const mlCandidates = [];

  for (const node of nodes) {
    const heuristic = classifyHeuristic(node.nodeValue);
    if (heuristic) {
      applyHighlight(node, heuristic.category, heuristic.severity, "heuristic");
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

function enqueueForML(nodes) {
  for (const n of nodes) mlQueue.push(n);
  if (!mlFlushTimer) {
    mlFlushTimer = setTimeout(flushMLQueue, ML_BATCH_DELAY_MS);
  }
}

async function flushMLQueue() {
  mlFlushTimer = null;
  while (mlQueue.length) {
    const batchNodes = mlQueue.splice(0, ML_BATCH_SIZE).filter((n) => document.body.contains(n));
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
        applyHighlight(node, r.label, severity, "ml");
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
const observer = new MutationObserver((mutations) => {
  const roots = [];
  for (const m of mutations) {
    m.addedNodes.forEach((n) => {
      if (n.nodeType === Node.ELEMENT_NODE && !isIgnorableNode(n)) roots.push(n);
    });
  }
  if (!roots.length) return;
  const newCandidates = [];
  for (const root of roots) {
    newCandidates.push(...runHeuristicPass(root));
  }
  if (newCandidates.length) enqueueForML(newCandidates);
});

let running = false;

function start() {
  if (running) return;
  running = true;
  chrome.runtime.sendMessage({ type: "DIGICOM_WARMUP" }).catch(() => {});
  enqueueForML(runHeuristicPass());
  observer.observe(document.body, { childList: true, subtree: true });
}

function stop() {
  if (!running) return;
  running = false;
  observer.disconnect();
  clearAllHighlights();
}

// Re-scan text that was previously skipped (e.g. threshold lowered or category re-enabled).
// Already-highlighted nodes are skipped by collectTextNodes, so this won't duplicate work.
function rescan() {
  state.seenTextHashes = new Set();
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
