import { pipeline, env } from "./lib/transformers.min.js";

// Force local-only loading — no CDN fetches for model or WASM.
env.allowRemoteModels = false;
env.allowLocalModels = true;
// Offscreen documents don't reliably expose the CacheStorage (`caches`) API, and the model
// is already bundled locally — so disable browser caching to avoid a load-time throw
// ("Browser cache is not available in this environment.") and a wasted 67 MB cache write.
env.useBrowserCache = false;
env.useFSCache = false;
env.localModelPath = chrome.runtime.getURL("models/");
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("lib/");
// The bundled ORT build is threaded and needs a real SharedArrayBuffer. The manifest opts
// extension pages into cross-origin isolation (cross_origin_embedder_policy /
// cross_origin_opener_policy), so SharedArrayBuffer is available here. Keep 1 thread — one
// model, no benefit from a worker pool, and it avoids spawning proxy workers.
env.backends.onnx.wasm.numThreads = 1;

const MODEL_ID = "dpbh-distilbert";

let classifier = null;
let loading = null;
let loadError = null;

async function ensureClassifier() {
  if (classifier) return classifier;
  if (loadError) throw loadError;
  if (!loading) {
    loading = pipeline("text-classification", MODEL_ID, { dtype: "q8" })
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
