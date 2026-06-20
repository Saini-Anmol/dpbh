# Changelog

All notable changes to DigiCom are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The single source of truth for
the version is [`extension/manifest.json`](extension/manifest.json).

## [Unreleased]

### Added

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

[Unreleased]: https://github.com/your-org/digicom-dark-pattern-buster/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/your-org/digicom-dark-pattern-buster/releases/tag/v0.2.0
[0.1.0]: https://github.com/your-org/digicom-dark-pattern-buster/releases/tag/v0.1.0
