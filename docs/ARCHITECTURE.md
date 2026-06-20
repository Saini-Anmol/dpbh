# Architecture

This document describes how DigiCom is structured and why. For a quick orientation see
[`README.md`](../README.md); for AI‑assistant guidance see [`CLAUDE.md`](../CLAUDE.md).

## Overview

DigiCom is a Chrome **Manifest V3** extension with four cooperating JavaScript contexts.
All dark‑pattern detection runs on‑device; there is no backend.

```
                         ┌───────────────────────────────────────────┐
                         │                 Web page                   │
                         │  ┌─────────────────────────────────────┐  │
                         │  │ content.js  (content script)         │  │
                         │  │  • TreeWalker DOM text scan          │  │
                         │  │  • Stage 1: regex heuristics         │  │
                         │  │  • Stage 2: enqueue text for ML      │  │
                         │  │  • inject <mark> highlights          │  │
                         │  │  • MutationObserver for dynamic DOM  │  │
                         │  └───────────────┬─────────────────────┘  │
                         └──────────────────┼────────────────────────┘
                                            │ chrome.runtime messages
                              ┌─────────────▼──────────────┐
                              │ background.js              │
                              │ (MV3 service worker)       │
                              │  • offscreen lifecycle     │
                              │  • route CLASSIFY/WARMUP   │
                              │  • per‑tab counts + status │
                              └──────┬──────────────┬──────┘
                                     │              │
                  target:"offscreen"│              │ DIGICOM_GET_TAB_COUNTS
                              ┌──────▼───────┐   ┌──▼─────────────┐
                              │ offscreen.js │   │ popup.js/html  │
                              │ DistilBERT   │   │ UI + jump‑to   │
                              │ (WASM/ONNX)  │   └────────────────┘
                              └──────────────┘
```

## Why an offscreen document?

MV3 replaced background pages with **service workers**, which have no DOM and an unreliable
lifecycle for long‑running WASM workers. ONNX Runtime Web needs a document context with
WASM (and ideally workers). Chrome's **Offscreen API** provides exactly that: a hidden,
DOM‑capable page the service worker can spin up on demand. `background.js` creates it
lazily (`ensureOffscreen`) with reason `WORKERS`, and tears it down implicitly when idle.

## Detection pipeline

### Stage 1 — Heuristics (synchronous)

`classifyHeuristic(text)` in [`detection.js`](../extension/detection.js) (a pure, DOM-free
module shared with the unit tests) tests text nodes against the `HEURISTICS` rule set (regex
grouped by category + severity); `content.js` calls it during the scan. Matches are
highlighted **immediately**, before any ML runs, so the most blatant patterns appear with
zero latency. Heuristics are intentionally conservative to limit false positives.

### Stage 2 — ML classification (async, batched)

Text nodes that aren't caught by heuristics and pass `looksLikeUIText()` (length bounds,
not JSON/CSS/pure‑numeric, must contain whitespace) are:

1. **Deduplicated** with a djb2 hash (`seenTextHashes`) so repeated strings classify once.
2. **Queued** and flushed in batches of `ML_BATCH_SIZE` (24) after `ML_BATCH_DELAY_MS`.
3. Sent to the offscreen model via `background.js`.
4. Highlighted only if `label !== "Not Dark Pattern"` and `score ≥ ML_CONFIDENCE_THRESHOLD`
   (0.70).

Batches yield to the event loop between flushes to keep the page responsive.

### Highlighting

`applyHighlight()` wraps the matched text node in a `<mark class="digicom-highlight
digicom-sev-{severity}">`, tagging it with `data-digicom-category` and
`data-digicom-source` (`heuristic` | `ml`). Styling lives in
[`content.css`](../extension/content.css); a `::before` pseudo‑element renders the category
badge. Each highlight gets a unique id and is registered in `state.byCategory` for the
popup's count + jump features. Nodes inside an already‑highlighted subtree are skipped.

## Dynamic content

A `MutationObserver` on `document.body` (subtree, childList) re‑runs the heuristic pass on
newly added element subtrees and enqueues fresh ML candidates. This covers lazy‑loaded
product grids, carousels, and live countdown timers.

## State & lifecycle

- **Per‑page state** (`content.js`): `byCategory`, `cursor` (jump position), `nextId`,
  `seenTextHashes`. Lives only as long as the page.
- **Per‑tab counts** (`background.js`): `tabCounts` Map, keyed by tab id, cleared on
  `tabs.onRemoved`. Lets the popup show counts even after it's been closed and reopened.
- **ML status** (`background.js`): single `mlStatus` (`idle|loading|ready|error`) broadcast
  from the offscreen document and surfaced as the popup badge.

## The model

- Architecture: **DistilBERT** (`DistilBertForSequenceClassification`), 6 layers, hidden
  dim 768, max sequence length 512.
- Task: single‑label classification over **8 classes** (see
  [`label_map.json`](../extension/models/dpbh-distilbert/onnx/../label_map.json)).
- Format: ONNX, **quantized to `q8`** (`model_quantized.onnx`, ≈ 67 MB) for fast in‑browser
  inference.
- Loaded by Transformers.js with `env.allowRemoteModels = false` — strictly local.

### Model artifact duplication

The shipped model lives in [`extension/models/dpbh-distilbert/`](../extension/models/dpbh-distilbert/).
The repo root also contains [`onnx_quantized/`](../onnx_quantized/), a **byte‑identical**
copy representing the raw export from training. Keep them in sync; prefer scripting the
copy if you re‑train/re‑export. Both `.onnx` files are tracked with Git LFS.

## Performance considerations

- **Single‑threaded WASM** (`numThreads = 1`) — extension pages can't guarantee
  cross‑origin isolation, so SharedArrayBuffer threading is off.
- Batching + dedup + length filtering keep the model from being hammered with trivial or
  repeated strings.
- Heuristics short‑circuit the common cases so most pages need little ML work.

## Extending the system

- **New heuristic:** add a rule object to `HEURISTICS` in
  [`detection.js`](../extension/detection.js), then add a case to
  [`test/detection.test.mjs`](../test/detection.test.mjs).
- **New category:** retrain the model and update `label_map.json`, `config.json`'s
  `id2label`/`label2id`, plus `SEVERITY_MAP` in both `detection.js` and `popup.js`.
- **New message type:** add handlers in both sender and receiver; honor the MV3 async
  `sendResponse` / `return true` contract.
