# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repository.

## What this project is

**DigiCom — Dark Pattern Buster** is a Chrome **Manifest V3** browser extension that
detects and highlights _dark patterns_ (manipulative UI/UX) on e‑commerce and shopping
websites in real time. All detection runs **100% on‑device** — there is no backend, no
telemetry, and no network calls for inference. A quantized DistilBERT model runs locally
via [Transformers.js](https://github.com/huggingface/transformers.js) + ONNX Runtime (WASM).

The goal is consumer protection: surface manipulative tactics (fake urgency, false
scarcity, manipulative wording, forced sign‑ups, etc.) so shoppers aren't tricked into
rushed or unwanted decisions. This maps to regulatory frameworks such as India's CCPA
"Guidelines for Prevention and Regulation of Dark Patterns, 2023".

## Detection categories

The model is an 8‑class single‑label classifier. See
[`extension/models/dpbh-distilbert/label_map.json`](extension/models/dpbh-distilbert/label_map.json):

| id  | label            | severity (UI) |
| --- | ---------------- | ------------- |
| 0   | Forced Action    | high          |
| 1   | Misdirection     | moderate      |
| 2   | Not Dark Pattern | — (ignored)   |
| 3   | Obstruction      | high          |
| 4   | Scarcity         | moderate      |
| 5   | Sneaking         | high          |
| 6   | Social Proof     | low           |
| 7   | Urgency          | moderate      |

`Not Dark Pattern` is the negative class and is never highlighted.

## Architecture

Detection is a **two‑stage hybrid pipeline**:

1. **Stage 1 — regex heuristics** (synchronous, instant). Fast pattern matches for
   obvious phrases ("Only 3 left!", "Sale ends soon"). Lives in `HEURISTICS` in
   [`extension/detection.js`](extension/detection.js).
2. **Stage 2 — ML classification** (async, batched). Remaining UI‑like text is batched
   and classified by DistilBERT. Only predictions with `score ≥ settings.threshold`
   (user‑configurable, default 0.70) and `label !== "Not Dark Pattern"` are highlighted.

### MV3 contexts and message flow

Because MV3 service workers cannot reliably host the WASM/worker runtime, inference is
isolated in an **offscreen document**.

```
content.js  ──DIGICOM_CLASSIFY──▶ background.js ──CLASSIFY──▶ offscreen.js (DistilBERT)
(per page)  ◀─────results────────  (service worker) ◀──results──
     │
     └─DIGICOM_DETECTION──▶ background.js (stores per‑tab counts)
popup.js ──DIGICOM_GET_TAB_COUNTS / DIGICOM_GET_ML_STATUS──▶ background.js
popup.js ──DIGICOM_GET_COUNTS / DIGICOM_JUMP_NEXT──▶ content.js (active tab)
```

| File                                                                                      | Context            | Responsibility                                                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [`extension/content.js`](extension/content.js)                                            | content script     | DOM scan (TreeWalker + MutationObserver), highlight `<mark>` injection, per‑category counts, jump‑to‑next, settings lifecycle |
| [`extension/detection.js`](extension/detection.js)                                        | shared (classic)   | Pure detection logic (`HEURISTICS`, `SEVERITY_MAP`, `classifyHeuristic`, `looksLikeUIText`, `hashText`) — no DOM; unit‑tested |
| [`extension/background.js`](extension/background.js)                                      | service worker     | Orchestrate offscreen doc lifecycle, route classify/warmup, hold per‑tab stats + ML status                                    |
| [`extension/offscreen.js`](extension/offscreen.js)                                        | offscreen document | Load model, run inference (Transformers.js pipeline)                                                                          |
| [`extension/popup.js`](extension/popup.js) / [`popup.html`](extension/popup.html)         | popup              | Show totals, per‑category breakdown, ML status badge, click‑to‑jump, per‑site on/off toggle                                   |
| [`extension/options.js`](extension/options.js) / [`options.html`](extension/options.html) | options page       | Configure enable, sensitivity threshold, per‑category toggles, disabled‑site list                                             |
| [`extension/settings.js`](extension/settings.js)                                          | shared (classic)   | Settings schema/defaults + `chrome.storage.sync` load/save/normalize/onChange; loaded in content, popup, and options          |
| [`extension/content.css`](extension/content.css)                                          | injected styles    | Highlight styling by severity                                                                                                 |

### Message protocol (string `type` constants)

- `DIGICOM_WARMUP` — content → bg: trigger eager model load.
- `DIGICOM_CLASSIFY` `{ texts }` → `{ ok, results:[{label,score}] }`.
- `DIGICOM_DETECTION` `{ counts }` — content → bg: report per‑tab counts.
- `DIGICOM_GET_COUNTS` — popup → content: read live counts from the page.
- `DIGICOM_GET_TAB_COUNTS` `{ tabId }` — popup → bg: read cached counts (survives popup reopen).
- `DIGICOM_JUMP_NEXT` `{ category }` — popup → content: scroll to next occurrence.
- `DIGICOM_ML_STATUS` / `DIGICOM_GET_ML_STATUS` — model status: `idle|loading|ready|error`.
- Offscreen‑targeted messages carry `target: "offscreen"` and type `CLASSIFY|WARMUP|PING`.

Settings propagate **not** via these messages but through `chrome.storage.sync`: the
options page / popup write settings, and `content.js` reacts live via
`DigiComSettings.onChange` (see below).

When adding a message type, register handlers in **both** the sender and receiver, and
remember the MV3 rule: return `true` from an `onMessage` listener only when you call
`sendResponse` **asynchronously**.

## Hard constraints / gotchas

- **Local‑only model loading is mandatory.** In [`extension/offscreen.js`](extension/offscreen.js),
  `env.allowRemoteModels = false` and `wasmPaths` point at the bundled `lib/`. Never
  introduce a CDN fetch — it breaks the offline/privacy guarantee and CSP.
- **Single‑threaded WASM** (`numThreads = 1`): extension pages can't reliably enable
  cross‑origin isolation. Don't assume threaded ORT.
- **Model is bundled twice.** [`extension/models/dpbh-distilbert/`](extension/models/dpbh-distilbert/)
  is what ships; the root [`onnx_quantized/`](onnx_quantized/) is the byte‑identical
  exported artifact (training/export output). They must stay in sync — if you re‑export
  the model, update both, or better, script the copy. The `q8` dtype in `offscreen.js`
  must match the quantized `model_quantized.onnx`.
- **Large binaries** (`model_quantized.onnx` ≈ 67 MB, `ort-wasm-*.wasm` ≈ 21 MB) are
  tracked via **Git LFS** — see `.gitattributes`.
- **`<all_urls>` host permissions.** The extension runs everywhere; keep the DOM scan
  cheap and the heuristics conservative to avoid false positives and jank.
- **Don't double‑wrap.** Highlights are skipped if a parent already has
  `data-digicom-highlighted`; preserve this when editing `applyHighlight`.

## User settings

Defined in [`extension/settings.js`](extension/settings.js) and persisted to
`chrome.storage.sync` under key `digicomSettings`:

- `enabled` (bool) — master on/off.
- `threshold` (0.5–0.95) — ML confidence cutoff (replaces the old hardcoded
  `ML_CONFIDENCE_THRESHOLD`); the content script reads `settings.threshold`.
- `categories` (per‑label bool) — which of the 7 highlightable categories to show.
- `disabledSites` (hostname[]) — sites where DigiCom stays off.

`content.js` loads settings on boot, gates scanning on `DigiComSettings.isActive(settings,
hostname)`, and applies changes **live** via `DigiComSettings.onChange`: disabling a
category unwraps its highlights, re‑enabling/lowering the threshold triggers a `rescan()`,
toggling enabled/site calls `start()`/`stop()`. When changing this logic, keep the unwrap
(`clearCategory`/`clearAllHighlights`) and rescan paths consistent.

## Tuning knobs (top of [`extension/content.js`](extension/content.js))

`ML_BATCH_SIZE` and `ML_BATCH_DELAY_MS` live in `content.js`; the text‑filter bounds
(`ML_MIN_LEN`, `ML_MAX_LEN`), the `HEURISTICS` rules, and `SEVERITY_MAP` now live in
[`extension/detection.js`](extension/detection.js). The confidence threshold is a user
setting, not a constant. Tune these for precision/recall and page performance.

## Development workflow

```bash
npm install              # dev tooling (ESLint + Prettier)
npm run lint             # check
npm run lint:fix         # auto‑fix
npm test                 # unit tests (Node built‑in runner; test/*.test.mjs)
npm run format           # Prettier write
npm run icons            # regenerate extension/icons/* from assets/icon.svg (macOS: sips + qlmanage)
npm run sync-model       # copy onnx_quantized/ → extension/models/dpbh-distilbert/
npm run sync-model:check # verify the two model copies match (drift detection)
npm run package          # sync-model:check, then produce dist/digicom-extension.zip
```

**Load unpacked:** `chrome://extensions` → enable _Developer mode_ → _Load unpacked_ →
select the [`extension/`](extension/) directory. After editing `content.js`/`settings.js`/
`popup.js`, click reload on the extension card and refresh the page. After editing
`background.js`, reload the extension (the service worker restarts). The settings UI is at
the extension's _Options_ (right‑click the icon → Options, or the ⚙ in the popup).

**Tests** cover the pure logic (`detection.js`, `settings.js`) via Node's built‑in test
runner — see [`test/`](test/). They load the classic scripts through
[`test/helpers.mjs`](test/helpers.mjs) (`vm.runInThisContext`) since those files attach to
`globalThis` rather than exporting. DOM/messaging glue in `content.js` is **not** unit‑tested;
verify it manually (load unpacked, visit a page with known dark patterns, check counts and
click‑to‑jump). CI runs lint + format + tests + package on every push/PR
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

When you change detection behavior, keep the pure logic in `detection.js` (so it stays
testable) and add/extend a case in [`test/detection.test.mjs`](test/detection.test.mjs).

## Conventions

- Vanilla JS, ES modules in the offscreen/background module contexts; no framework.
- Keep new code dependency‑free in the extension itself (only Transformers.js, bundled).
- `digicom`‑prefixed DOM ids/classes/data‑attributes to avoid clashing with host pages.
- Match the existing comment style: short section banners (`// ----- Stage 1 ... -----`).

## Versioning

The **single source of truth** for the version is
[`extension/manifest.json`](extension/manifest.json) (`version`). The popup reads it at
runtime via `chrome.runtime.getManifest().version` — don't hardcode versions in the UI.
Keep [`package.json`](package.json) and [`CHANGELOG.md`](CHANGELOG.md) in step when bumping.

## Model artifacts & sync

The shipped model is [`extension/models/dpbh-distilbert/`](extension/models/dpbh-distilbert/);
the root [`onnx_quantized/`](onnx_quantized/) is the source-of-truth export. The destination
nests the weights under `onnx/` (Transformers.js convention) while tokenizer/config files
sit at the top level. Use `npm run sync-model` to copy and `npm run sync-model:check` to
detect drift (the latter gates `npm run package`).

## Branding / icons

Icons are generated from [`assets/icon.svg`](assets/icon.svg) into `extension/icons/`
(16/48/128) via `npm run icons`. Edit the SVG, re-run, and the manifest `icons` /
`action.default_icon` pick them up.

## Model evaluation

The classifier is documented in [`docs/MODEL_CARD.md`](docs/MODEL_CARD.md). Metrics are
**reproducible**: `npm run eval` ([`scripts/evaluate.mjs`](scripts/evaluate.mjs)) runs the
real `q8` model over [`eval/dataset.jsonl`](eval/dataset.jsonl) and writes
[`eval/results.json`](eval/results.json). The eval uses the dev‑only `@huggingface/transformers`
package (not shipped). **Known model weakness:** Forced Action, Obstruction, and Sneaking are
under‑detected (collapse to "Not Dark Pattern"); heuristics backstop Forced Action but
Obstruction/Sneaking have no heuristic coverage either. When changing the model, re‑run
`npm run eval` and update the model card.

## Known follow‑ups

- Not published to the Chrome Web Store; needs store listing assets + a privacy policy.
- `npm run icons` is macOS-only (uses `sips`/`qlmanage`); add a cross-platform fallback if
  contributors are on Linux/Windows.
- Model under‑detects Forced Action / Obstruction / Sneaking — add heuristics and/or retrain
  (see `docs/MODEL_CARD.md`); expand `eval/dataset.jsonl` beyond the small curated set.
- Content‑script DOM/messaging glue is not unit‑tested (only the pure logic is).
