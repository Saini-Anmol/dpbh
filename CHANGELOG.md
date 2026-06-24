# Changelog

All notable changes to DigiCom are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The single source of truth for
the version is [`extension/manifest.json`](extension/manifest.json).

## [Unreleased]

## [0.4.0] — 2026-06-21

### Added

- **Risk scoring (1–10) + tiers (Critical / High / Medium / Low)** for every detected
  pattern — a transparent, on-device rubric (`scorePattern` in `detection.js`: category harm
  weight × detector confidence; no LLM/agent).
- **On-page summary panel** with per-category **drill-down** (click a category → list its
  occurrences with a heading), click-to-jump, an overall **page-risk** readout, and a
  persistent **sparkling-yellow active highlight** on the selected pattern.
- **Loading/analyzing state**: the offscreen model load retries transient failures (up to 3×)
  before reporting an error; the panel shows an "analyzing…" indicator during classification.
- **False-positive guard** (`isBenignUIText`): common benign e-commerce labels ("Contact us",
  "Cancellation & Returns", "Privacy Policy", …) are no longer flagged (covered by tests).
- **Free distribution** via GitHub Releases — self-contained `digicom-extension.zip` (model
  bundled), load-unpacked install; see [`docs/DEPLOY.md`](docs/DEPLOY.md).

### Changed

- **Lighter highlight styling**: subtle tint + colored underline by default, category badge
  on hover (cleaner pages, less repaint); smoother panel (entrance animation, scrollbar).
- **Performance**: debounced `MutationObserver`, capped ML queue, throttled panel render —
  fixes page freeze/jank on dynamic marketplaces.

### Fixed

- Click-to-jump occasionally not navigating (prune stale highlights + fall back to next live
  occurrence).
- The big model `.onnx` files are git-ignored (GitHub's 100 MB limit); distributed via the
  release zip instead.

## [0.3.0] — 2026-06-21

### Changed

- **Retrained the DistilBERT classifier** on a balanced ~200/class dataset. Held-out accuracy
  **53.5% → 91.5%**, macro-F1 **44.5% → 91.8%**; the previously-dead classes now work —
  Forced Action **0% → 90.9%**, Obstruction **0% → 85.7%**, Sneaking **0% → 93.3%** F1. See
  [`docs/MODEL_CARD.md`](docs/MODEL_CARD.md). (The quantized model is ~194 MB; shrinking it is
  a follow-up.)

### Fixed

- **ONNX Runtime failed in the offscreen document with "requested a shared
  WebAssembly.Memory ... not a SharedArrayBuffer".** Root cause: the bundled ORT 1.20 runtime
  is threaded-only and requires cross-origin isolation, which offscreen documents can't
  reliably get (manifest COEP/COOP didn't apply). Switched the ML runtime to
  **`@xenova/transformers@2.17.2` (ORT 1.14)**, which ships a single-threaded
  `ort-wasm-simd.wasm` that runs without `SharedArrayBuffer` -- no isolation needed. Removed
  the COEP/COOP manifest keys; `offscreen.js` now loads with `{ quantized: true }`.
- **Model failed to load in the offscreen document** ("Browser cache is not available in this
  environment."). Disabled Transformers.js browser caching (`env.useBrowserCache = false`)
  since the model is bundled locally; added a clear `console.error` on load failure.

### Added

- **Heuristic coverage for Obstruction and Sneaking** (Stage 1), plus broadened **Forced
  Action** rules (cookie walls, forced sign-up/app/social login, permission & contact-info
  gates). Derived from web-sourced examples in [`data/collected.jsonl`](data/collected.jsonl)
  and covered by tests — these three classes are no longer detection blind spots at Stage 1,
  even though the ML model still misses them.
- **Dataset collection tooling**: a `dataset-builder` custom agent
  ([`.claude/agents/dataset-builder.md`](.claude/agents/dataset-builder.md)), a labeling
  guide ([`data/LABELING_GUIDE.md`](data/LABELING_GUIDE.md)), and a staging set
  ([`data/collected.jsonl`](data/collected.jsonl), 59 labeled examples).

- **Unit tests** ([`test/`](test/)) on Node's built-in test runner, covering detection
  heuristics/filters and settings normalization (`npm test`).
- **Continuous integration** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):
  lint, format check, tests, model-sync check, and package on every push/PR.
- **Model card** ([`docs/MODEL_CARD.md`](docs/MODEL_CARD.md)) with reproducible evaluation
  metrics (accuracy, per-class precision/recall/F1, confusion matrix) and documented
  limitations.
- **Evaluation harness** ([`scripts/evaluate.mjs`](scripts/evaluate.mjs), `npm run eval`)
  running the real `q8` model over a curated labeled set
  ([`eval/dataset.jsonl`](eval/dataset.jsonl)) → [`eval/results.json`](eval/results.json).
- **Testing guide** ([`docs/TESTING.md`](docs/TESTING.md)) and a local demo page
  ([`test/fixtures/dark-patterns-demo.html`](test/fixtures/dark-patterns-demo.html)).

### Changed

- Extracted the pure detection logic out of `content.js` into
  [`extension/detection.js`](extension/detection.js) (a shared, testable classic script
  loaded before `content.js`). No behavior change.

## [0.2.0] — 2026-06-21

### Added

- **Settings/options page** ([`options.html`](extension/options.html) /
  [`options.js`](extension/options.js)): master on/off, ML sensitivity slider, per-category
  toggles, and a disabled-sites list.
- **Shared settings module** ([`settings.js`](extension/settings.js)) persisting to
  `chrome.storage.sync`; the content script reacts to changes live.
- **Popup controls**: per-site "active on this site" toggle and a ⚙ link to settings.
- **Extension icons** (16/48/128) generated from [`assets/icon.svg`](assets/icon.svg) via
  `npm run icons`; declared in the manifest `icons` and `action.default_icon`.
- **Model-sync automation** ([`scripts/sync-model.mjs`](scripts/sync-model.mjs)):
  `npm run sync-model` and `npm run sync-model:check` (drift detection, wired into
  `npm run package`).
- Documentation: `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`,
  `LICENSE` (MIT), and dev tooling (ESLint flat config, Prettier, Git LFS).

### Changed

- ML confidence threshold is now a **user setting** (`settings.threshold`) instead of the
  hardcoded `ML_CONFIDENCE_THRESHOLD` constant.
- Popup footer version is now read from the manifest at runtime (no more hardcoded
  "Phase 2 · v0.2").

### Fixed

- Version mismatch between the manifest and the popup footer.

## [0.1.0]

### Added

- Initial hybrid dark-pattern detector: regex heuristics (Stage 1) + on-device quantized
  DistilBERT classification (Stage 2) across 8 categories, with in-page highlighting, a
  popup breakdown, and click-to-jump.

[Unreleased]: https://github.com/Saini-Anmol/dpbh/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Saini-Anmol/dpbh/releases/tag/v0.4.0
[0.3.0]: https://github.com/Saini-Anmol/dpbh/releases/tag/v0.3.0
[0.2.0]: https://github.com/Saini-Anmol/dpbh/releases/tag/v0.2.0
[0.1.0]: https://github.com/Saini-Anmol/dpbh/releases/tag/v0.1.0
