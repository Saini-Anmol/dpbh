// Service worker. Orchestrates offscreen document, routes ML requests,
// and keeps per-tab detection stats so the popup can read them after reload.

const tabCounts = new Map();
let mlStatus = { status: "idle", detail: null };
let offscreenReady = null;

async function hasOffscreen() {
  if (!chrome.runtime.getContexts) return false;
  const ctx = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  return ctx.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  if (offscreenReady) return offscreenReady;
  offscreenReady = chrome.offscreen
    .createDocument({
      url: "offscreen.html",
      reasons: ["WORKERS"],
      justification: "Runs DistilBERT inference for dark-pattern classification.",
    })
    .finally(() => {
      offscreenReady = null;
    });
  return offscreenReady;
}

async function classifyTexts(texts) {
  if (!texts || !texts.length) return { ok: true, results: [] };
  await ensureOffscreen();
  return chrome.runtime.sendMessage({
    target: "offscreen",
    type: "CLASSIFY",
    texts,
  });
}

async function warmup() {
  try {
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ target: "offscreen", type: "WARMUP" });
  } catch {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === "offscreen") return false;

  if (msg?.type === "DIGICOM_DETECTION" && sender.tab?.id != null) {
    tabCounts.set(sender.tab.id, msg.counts);
    return false;
  }

  if (msg?.type === "DIGICOM_GET_TAB_COUNTS" && msg.tabId != null) {
    sendResponse({ counts: tabCounts.get(msg.tabId) || {}, mlStatus });
    return false;
  }

  if (msg?.type === "DIGICOM_CLASSIFY") {
    classifyTexts(msg.texts)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (msg?.type === "DIGICOM_WARMUP") {
    warmup();
    sendResponse({ ok: true });
    return false;
  }

  if (msg?.type === "DIGICOM_ML_STATUS") {
    mlStatus = { status: msg.status, detail: msg.detail || null };
    return false;
  }

  if (msg?.type === "DIGICOM_GET_ML_STATUS") {
    sendResponse(mlStatus);
    return false;
  }

  if (msg?.type === "OFFSCREEN_READY") {
    return false;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => tabCounts.delete(tabId));
