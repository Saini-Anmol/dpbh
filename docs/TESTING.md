# Testing DigiCom on real e-commerce sites

A practical, repeatable workflow for verifying the extension end-to-end — first on a
deterministic local page, then on live shopping sites.

## 0. Prerequisites

- Chrome / Edge / Brave (Chromium).
- The model files present (Git LFS). If you cloned without LFS: `git lfs pull`.

## 1. Load the extension

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** → select the [`extension/`](../extension/) folder.
4. Pin the 🛡 DigiCom icon to the toolbar.

After editing source:

- `content.js` / `detection.js` / `settings.js` / `popup.*` → click **Reload** on the
  extension card, then **refresh** the page under test.
- `background.js` / `offscreen.js` → click **Reload** (the service worker restarts).

## 2. Smoke test on the local demo page (do this first)

A self-contained page with known patterns ships in the repo:
[`test/fixtures/dark-patterns-demo.html`](../test/fixtures/dark-patterns-demo.html).

1. To run on `file://` URLs, open `chrome://extensions` → DigiCom **Details** → enable
   **"Allow access to file URLs."**
2. Open the file in the browser (drag it into a tab, or `file:///…/test/fixtures/dark-patterns-demo.html`).
3. **Expected:**
   - Urgency, Scarcity, Social Proof, Misdirection, Forced Action sections get highlighted.
   - The **Benign control** section is **not** highlighted.
   - Sneaking / Obstruction now highlight too via Stage 1 heuristics (the model alone misses
     them — see [`MODEL_CARD.md`](MODEL_CARD.md)).
4. Open the popup: the total and per-category counts should match what you see. Click a
   category row → the page scrolls to and pulses that highlight.

> Prefer `http://` over `file://`? Serve the folder: `npx serve test/fixtures` (or
> `python3 -m http.server`) and visit the printed URL.

## 3. Verify the ML stage is actually running

1. Open the popup and watch the **ML badge**: `idle → loading → active`. "active" means the
   DistilBERT model loaded in the offscreen document.
2. To inspect logs: `chrome://extensions` → DigiCom → **Inspect views: service worker**
   (background) and **offscreen.html** (model). The page console shows content-script errors.
3. If the badge stays on `loading`/`error`, confirm the model files aren't LFS pointer stubs
   (`ls -la extension/models/dpbh-distilbert/onnx/model_quantized.onnx` should be ~67 MB).

## 4. Test on live e-commerce sites

Pick pages that tend to use the patterns DigiCom detects best (Urgency, Scarcity, Social
Proof):

- **Product pages** on large marketplaces and fast-fashion retailers — look for "Only N
  left", countdown timers, "X people viewing".
- **Travel / hotel / ticket booking** flows — heavy on urgency and scarcity ("1 room left at
  this price", "booked 5 times today").
- **Checkout / cart** flows — pre-checked add-ons, marketing opt-ins, "no thanks" decline
  copy (Misdirection / Sneaking).

For each page:

1. Let it fully load (DigiCom scans at `document_idle` and watches for lazy-loaded content).
2. Scroll — confirm highlights appear on dynamically loaded cards/carousels (the
   `MutationObserver` should catch them).
3. Open the popup; sanity-check counts and click-to-jump.
4. Note **false positives** (benign text flagged) and **false negatives** (obvious patterns
   missed) — these feed heuristic/threshold tuning and `eval/dataset.jsonl`.

### Tuning during testing

Open **Options** (right-click the icon → Options, or the ⚙ in the popup):

- **Sensitivity slider** — raise it if you see noise (false positives); lower it if obvious
  patterns are missed.
- **Category toggles** — turn off a noisy category to confirm its highlights disappear live.
- **Disabled sites** / per-site popup toggle — confirm DigiCom stops on that hostname and
  resumes elsewhere, without a reload.

## 5. Regression checklist before a release

- [ ] `npm run lint && npm test && npm run format:check` all pass.
- [ ] `npm run eval` — metrics haven't regressed vs. `eval/results.json`.
- [ ] Local demo page: expected categories highlight; benign control stays clean.
- [ ] Live site: highlights + popup counts + click-to-jump work; dynamic content is caught.
- [ ] Options: sensitivity, category toggles, and per-site disable all apply live.
- [ ] `npm run package` builds `dist/digicom-extension.zip`; reload the **packed** zip and
      re-smoke-test.

## Troubleshooting

| Symptom                            | Likely cause / fix                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| No highlights anywhere             | Extension disabled, site in disabled list, or model failed to load (check ML badge + offscreen console).           |
| Works on `http` but not local file | Enable "Allow access to file URLs" in the extension details.                                                       |
| ML badge stuck on `loading`        | Model file is an LFS pointer stub — run `git lfs pull`.                                                            |
| Obvious "Only 2 left" not flagged  | Heuristics are conservative; check the category is enabled and the text isn't inside an already-highlighted block. |
| Sneaking/Obstruction not flagged   | Should be caught by Stage 1 heuristics now; the ML model alone still misses them (see `MODEL_CARD.md`).            |
