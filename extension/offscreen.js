import { pipeline, env } from "./lib/transformers.min.js";

// Force local-only loading — no CDN fetches for model or WASM.
env.allowRemoteModels = false;
env.allowLocalModels = true;
// Model is bundled locally; skip browser caching (offscreen documents may not expose the
// CacheStorage API, and there's no point re-caching a local file).
env.useBrowserCache = false;
env.localModelPath = chrome.runtime.getURL("models/");
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("lib/");
// Single-threaded WASM (ort-wasm-simd.wasm) — runs WITHOUT SharedArrayBuffer, so the
// offscreen document does NOT need cross-origin isolation. This is why the runtime is pinned
// to @xenova/transformers@2.17.2 (ORT 1.14), which ships a true non-threaded build; ORT 1.20+
// is threaded-only and requires isolation that offscreen documents can't reliably get.
env.backends.onnx.wasm.numThreads = 1;

const MODEL_ID = "dpbh-distilbert";

let classifier = null;
let loading = null;
let loadError = null;

async function ensureClassifier() {
  if (classifier) return classifier;
  if (loadError) throw loadError;
  if (!loading) {
    // v2 (Transformers.js) selects the quantized ONNX (onnx/model_quantized.onnx) via
    // `quantized: true` — the equivalent of v3's `dtype: "q8"`.
    loading = pipeline("text-classification", MODEL_ID, { quantized: true })
      .then((c) => {
        classifier = c;
        loading = null;
        broadcastStatus("ready");
        console.info("[DigiCom] model loaded");
        return c;
      })
      .catch((e) => {
        loadError = e;
        loading = null;
        broadcastStatus("error", String(e));
        // Surface the real cause (the bundle's internal stack alone isn't actionable).
        console.error("[DigiCom] model failed to load:", e);
        throw e;
      });
    broadcastStatus("loading");
  }
  return loading;
}

function broadcastStatus(status, detail) {
  chrome.runtime.sendMessage({ type: "DIGICOM_ML_STATUS", status, detail }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== "offscreen") return false;

  if (msg.type === "CLASSIFY") {
    (async () => {
      try {
        const clf = await ensureClassifier();
        const results = await clf(msg.texts, { top_k: 1 });
        const normalized = msg.texts.map((_, i) => {
          const r = Array.isArray(results[i]) ? results[i][0] : results[i];
          return { label: r.label, score: r.score };
        });
        sendResponse({ ok: true, results: normalized });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg.type === "PING") {
    sendResponse({
      status: classifier ? "ready" : loading ? "loading" : loadError ? "error" : "idle",
      error: loadError ? String(loadError) : null,
    });
    return false;
  }

  if (msg.type === "WARMUP") {
    ensureClassifier().catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

// Announce readiness to the service worker.
chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" }).catch(() => {});
