<div align="center">

# 🛡️ DigiCom — Dark Pattern Buster

**A privacy‑first Chrome extension that detects and highlights manipulative "dark patterns" on shopping websites — in real time, 100% on your device.**

[![CI](https://github.com/Saini-Anmol/dpbh/actions/workflows/ci.yml/badge.svg)](https://github.com/Saini-Anmol/dpbh/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![On‑device ML](https://img.shields.io/badge/ML-on--device%20DistilBERT-ff6f00)](https://github.com/huggingface/transformers.js)
[![No tracking](https://img.shields.io/badge/Privacy-no%20telemetry-2ea44f)]()

</div>

---

## What are dark patterns?

**Dark patterns** are user‑interface tricks designed to manipulate you into doing things
you didn't mean to — buying more, signing up, sharing data, or paying full price when a
discount was a click away. Examples: countdown timers that never really end, "Only 2 left
in stock!" on infinite inventory, or a decline button that reads _"No thanks, I don't want
to save money."_

DigiCom reads the page as you browse and flags these tactics so you can make decisions on
your own terms. It aligns with consumer‑protection guidance such as India's CCPA
_Guidelines for Prevention and Regulation of Dark Patterns (2023)_.

## Highlights

- 🔒 **100% on‑device.** The ML model runs locally in your browser. No servers, no
  telemetry, no data ever leaves your machine.
- ⚡ **Two‑stage hybrid detection.** Instant regex heuristics for obvious cases, plus a
  quantized **DistilBERT** model for nuanced language.
- 🎯 **8 categories** classified and color‑coded by severity.
- 🔍 **Click‑to‑jump.** The popup lists every detection by category; click to scroll
  straight to it on the page.
- ⚙️ **Configurable.** A full settings page: master on/off, an ML **sensitivity slider**,
  per‑category toggles, and a per‑site disable list (plus a one‑click "active on this site"
  toggle in the popup). Changes apply **live**, no reload needed.
- 🌐 **Works everywhere.** Runs on any site and adapts to dynamic content (lazy‑loaded
  cards, carousels, live countdowns) via a `MutationObserver`.

## Detected categories

| Category          | Severity    | Example                                      |
| ----------------- | ----------- | -------------------------------------------- |
| **Forced Action** | 🔴 high     | "Create an account to continue reading"      |
| **Obstruction**   | 🔴 high     | Deliberately hard‑to‑find cancel/unsubscribe |
| **Sneaking**      | 🔴 high     | Items or fees added silently at checkout     |
| **Urgency**       | 🟠 moderate | "Hurry! Sale ends in 00:04:59"               |
| **Scarcity**      | 🟠 moderate | "Only 3 left in stock!"                      |
| **Misdirection**  | 🟠 moderate | "No thanks, I'd rather pay full price"       |
| **Social Proof**  | 🔵 low      | "27 people are viewing this right now"       |

## Screenshots

> _Add screenshots/GIFs here: the popup breakdown and an in‑page highlight._
>
> `docs/screenshot-popup.png` · `docs/screenshot-highlight.png`

## Install — free, no Chrome Web Store

DigiCom installs in ~1 minute and is **100% free** (no store listing, no account, no payment).

### For users (recommended)

1. Download the latest **`digicom-extension.zip`** from the
   [**Releases**](https://github.com/Saini-Anmol/dpbh/releases) page. It's self‑contained —
   the on‑device model is bundled inside.
2. **Unzip** it into a folder you'll keep (Chrome loads the extension from this folder, so
   don't delete or move it afterward).
3. Open `chrome://extensions` in Chrome, Edge, or Brave.
4. Toggle **Developer mode** (top‑right).
5. Click **Load unpacked** and select the unzipped folder.
6. Pin the 🛡 DigiCom icon and browse a shopping site — patterns are highlighted live, and the
   on‑page panel shows a per‑category **risk breakdown (1–10, Critical→Low)**.

### For developers (from source)

```bash
git clone https://github.com/Saini-Anmol/dpbh.git
cd dpbh
npm install        # dev tooling (lint / test / format)
```

The model weights (~194 MB) are **not** in the repo (too large for plain Git). Get them from
a release: download `digicom-extension.zip`, and copy its `models/` folder into
`extension/models/`. Then `chrome://extensions` → **Developer mode** → **Load unpacked** →
select the **`extension/`** folder.

> Without the weights, Stage‑1 heuristics still highlight patterns; Stage‑2 ML needs the model.

## How it works

```
┌─────────────┐   text    ┌──────────────┐  classify  ┌────────────────────┐
│ content.js  │──────────▶│ background.js │───────────▶│ offscreen.js       │
│ (each page) │◀──────────│ (service     │◀───────────│ DistilBERT (WASM)  │
│ DOM scan +  │  results  │  worker)     │   results  │ Transformers.js    │
│ heuristics  │           └──────────────┘            └────────────────────┘
│ + highlight │                  ▲
└─────────────┘                  │ counts / status
        ▲                        │
        │ jump / counts   ┌──────────────┐
        └─────────────────│  popup.js    │
                          └──────────────┘
```

1. **Stage 1 (instant):** regex heuristics flag obvious manipulative phrasing immediately.
2. **Stage 2 (async):** remaining UI text is batched and classified by DistilBERT. Only
   predictions above a **70% confidence** threshold are highlighted.
3. Inference is isolated in an **offscreen document** because MV3 service workers can't
   reliably host the WASM runtime. Everything is bundled — **no CDN, no network.**

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`CLAUDE.md`](CLAUDE.md) for details.

## Model & evaluation

The classifier is documented in [`docs/MODEL_CARD.md`](docs/MODEL_CARD.md), including
**reproducible metrics** (`npm run eval` over [`eval/dataset.jsonl`](eval/dataset.jsonl)).
On the current curated set the **model** scores ~**54% accuracy / 44.5% macro-F1** — strong
on Scarcity, Social Proof, and Urgency, but it misses Forced Action, Obstruction, and
Sneaking. Those three are backstopped by **Stage 1 heuristics** so the running product still
flags them; the model itself needs retraining (read the model card's Limitations).

## Testing

To try it on real pages, see the step-by-step [`docs/TESTING.md`](docs/TESTING.md). A
self-contained demo page lives at
[`test/fixtures/dark-patterns-demo.html`](test/fixtures/dark-patterns-demo.html).

## Tech stack

- **Chrome Extension Manifest V3** (service worker + offscreen document + content script)
- **[Transformers.js](https://github.com/huggingface/transformers.js)** + **ONNX Runtime Web** (WASM)
- **DistilBERT** fine‑tuned for 8‑class dark‑pattern classification, quantized to `q8`
- Vanilla JS / HTML / CSS — no UI framework, no runtime dependencies beyond the bundled ML libs

## Development

```bash
npm install              # ESLint + Prettier
npm run lint             # lint the extension source
npm test                 # run unit tests (Node built‑in test runner)
npm run format           # auto‑format with Prettier
npm run icons            # regenerate icons from assets/icon.svg (macOS)
npm run sync-model       # sync the model artifact into the extension
npm run sync-model:check # verify the model copies match
npm run package          # build dist/digicom-extension.zip for distribution
```

Load the unpacked `extension/` folder as above. There's no build step — Chrome loads the
source directly. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Privacy

DigiCom requests broad host permissions (`<all_urls>`) **only** to read page text locally
for detection. It performs **no network requests**, stores no browsing history, and sends
nothing to any server. Detection counts live in memory per tab and are discarded when the
tab closes.

## Roadmap

- [x] User‑configurable sensitivity, category toggles, and per‑site disable
- [x] Risk scoring (1–10) + Critical/High/Medium/Low tiers, on‑page risk panel
- [x] Model card + reproducible metrics; retrained classifier (91.5% acc)
- [x] Free distribution via GitHub Releases (load‑unpacked)
- [ ] Slim the quantized model (~194 MB → ~67 MB)
- [ ] Firefox (WebExtensions) port
- [ ] Optional: Chrome Web Store / Edge Add‑ons listing

## Contributing

Contributions welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[MIT](LICENSE) © DigiCom contributors.

> The bundled DistilBERT weights and Transformers.js / ONNX Runtime libraries are subject
> to their own upstream licenses.
