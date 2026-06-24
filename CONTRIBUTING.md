# Contributing to DigiCom

Thanks for your interest in improving DigiCom! This guide covers setup, conventions, and
how to propose changes.

## Prerequisites

- A Chromium‑based browser (Chrome, Edge, Brave).
- [Node.js](https://nodejs.org/) 18+ (for the lint/format/test/package tooling only — the
  extension itself has no build step).

## Getting started

```bash
git clone https://github.com/Saini-Anmol/dpbh.git
cd dpbh
npm install
```

The model weights (~194 MB) are **not** committed (too large for plain Git). To run the ML
stage locally, copy the `models/` folder from a release `digicom-extension.zip` into
`extension/models/`, or export your own with
[`notebooks/finetune_distilbert.ipynb`](notebooks/finetune_distilbert.ipynb) then
`npm run sync-model`. Stage‑1 heuristics work without the weights.

### Load the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** → select the `extension/` directory.

### Reload after edits

- Edited `content.js`, `content.css`, `popup.*`: click **reload** on the extension card,
  then refresh the page under test.
- Edited `background.js` or `offscreen.js`: reload the extension (the service worker and
  offscreen document restart).

## Project layout

```
extension/            # everything that ships
  manifest.json       # MV3 manifest
  content.js/.css     # in‑page detection + highlighting
  background.js       # service worker (orchestration)
  offscreen.js/.html  # ML inference host
  popup.js/.html      # toolbar UI
  lib/                # Transformers.js + ONNX Runtime WASM (bundled)
  models/             # shipped DistilBERT (q8 ONNX) + tokenizer
onnx_quantized/       # raw exported model artifact (kept in sync with extension/models)
docs/                 # architecture & design docs
CLAUDE.md             # context for AI assistants
```

## Coding conventions

- **Vanilla JS**, no frameworks. Keep the extension dependency‑free apart from the bundled
  ML libraries.
- Prefix all injected DOM ids/classes/data‑attributes with `digicom` to avoid clashing
  with host pages.
- Run `npm run lint` and `npm run format` before committing.
- Match the existing comment style (short section banners, e.g. `// ----- Stage 1 ... -----`).
- Honor the MV3 messaging contract: only `return true` from an `onMessage` listener when
  `sendResponse` is called asynchronously.

## Tooling

```bash
npm run lint        # ESLint
npm run lint:fix    # ESLint --fix
npm test            # unit tests (Node built-in runner)
npm run format      # Prettier write
npm run format:check
npm run icons       # regenerate icons from assets/icon.svg (macOS)
npm run sync-model  # sync onnx_quantized/ → extension/models/
npm run package     # build dist/digicom-extension.zip (runs sync-model:check first)
```

### Tests

Unit tests live in [`test/`](test/) and run on Node's built-in test runner — no extra
dependencies. They cover the **pure** logic only: detection heuristics/filters
([`extension/detection.js`](extension/detection.js)) and settings normalization
([`extension/settings.js`](extension/settings.js)). Both are classic scripts that attach to
`globalThis`, so the tests load them via `vm.runInThisContext` (see
[`test/helpers.mjs`](test/helpers.mjs)).

When you add a heuristic or change detection behavior, add a case to
[`test/detection.test.mjs`](test/detection.test.mjs). DOM/messaging code in `content.js`
is verified manually (load unpacked). CI runs lint, format check, tests, and package on
every push/PR.

## Guardrails (please don't break these)

- **No network at inference time.** Keep `env.allowRemoteModels = false` and bundle all
  assets. DigiCom's privacy promise depends on it.
- **Keep the DOM scan cheap.** The content script runs on `<all_urls>`; avoid expensive
  per‑node work and excessive re‑scans.
- **Avoid false positives.** New heuristics should be conservative; prefer raising the ML
  threshold over shipping noisy regexes.

## Changing the model

If you re‑train or re‑export the classifier:

1. Put the new export in `onnx_quantized/`, then run `npm run sync-model` to copy it into
   `extension/models/dpbh-distilbert/` (the big `.onnx` files are git‑ignored, so they stay
   local and ship via the release zip — see [`docs/DEPLOY.md`](docs/DEPLOY.md)).
2. Update `label_map.json` / `config.json` (`id2label` / `label2id`) if classes change.
3. Update `SEVERITY_MAP` / `CATEGORY_RISK` in `detection.js` if categories change.
4. Export at **opset 14** with `{ quantized: true }` output so the extension's ONNX Runtime
   1.14 can load it.
5. Re‑run `npm run eval` and refresh `docs/MODEL_CARD.md`.

## Submitting changes

1. Create a feature branch.
2. Make focused commits; run lint/format.
3. Manually verify: load unpacked, visit a page with known dark patterns, confirm popup
   counts and click‑to‑jump behavior.
4. Open a PR describing **what** changed and **why**, with before/after screenshots for UI
   changes.

## Reporting issues

Include: browser + version, the URL or a minimal repro, what you expected vs. saw, and any
service‑worker / page console errors (`chrome://extensions` → _Inspect views_).
