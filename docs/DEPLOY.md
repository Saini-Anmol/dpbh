# Deploying DigiCom — free, no Chrome Web Store

DigiCom is distributed as a **self‑contained zip on GitHub Releases**. Users download it and
"Load unpacked" — completely free, no $5 store fee, no account. This guide is for maintainers
cutting a release.

## Why this approach

- The packaged `dist/digicom-extension.zip` bundles **everything** — code, WASM runtime, and
  the on‑device model — so users get a working extension with one download.
- The 194 MB model is **not** in Git (GitHub blocks >100 MB blobs), but `npm run package`
  zips it from your local `extension/` folder, so the **release asset is complete** even
  though the repo isn't.

## Release checklist

1. **Bump the version** (single source of truth = `extension/manifest.json`):
   - update `version` in `extension/manifest.json` and `package.json`
   - move the `[Unreleased]` section in `CHANGELOG.md` to the new version
2. **Validate**:
   ```bash
   npm run lint && npm test && npm run format:check
   npm run eval          # optional: confirm model metrics haven't regressed
   ```
3. **Build the distributable** (self‑contained, includes the model):
   ```bash
   npm run package       # → dist/digicom-extension.zip  (~170 MB)
   ```
   Sanity‑check it contains the model:
   ```bash
   unzip -l dist/digicom-extension.zip | grep model_quantized.onnx
   ```
4. **Commit & tag**:
   ```bash
   git add -A && git commit -m "Release vX.Y.Z"
   git tag vX.Y.Z && git push origin main --tags
   ```
5. **Create the GitHub Release with the zip attached** (free, unlimited downloads):
   ```bash
   gh release create vX.Y.Z dist/digicom-extension.zip \
     --title "DigiCom vX.Y.Z" \
     --notes "On-device dark-pattern detector. Download the zip, unzip, then chrome://extensions → Developer mode → Load unpacked."
   ```
   Or upload `dist/digicom-extension.zip` manually via the GitHub **Releases → Draft a new
   release** UI (assets up to 2 GB; doesn't count against repo size).

## What users do

1. Download `digicom-extension.zip` from the release.
2. Unzip to a permanent folder.
3. `chrome://extensions` → **Developer mode** → **Load unpacked** → select the folder.

That's the whole install — see the README "Install" section.

## Other free channels (optional, later)

- **Edge Add‑ons** — free developer registration (no fee), reviews MV3 extensions.
- **Firefox (AMO)** — free, but needs a WebExtensions port (offscreen API differs).
- **Chrome Web Store** — one‑time $5 developer fee (not required for the above).
