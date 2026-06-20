#!/usr/bin/env bash
# Generate the extension PNG icon set from assets/icon.svg.
# macOS-only (uses qlmanage + sips). Re-run after editing the SVG.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/assets/icon.svg"
OUT="$ROOT/extension/icons"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[ -f "$SVG" ] || { echo "Missing $SVG" >&2; exit 1; }
mkdir -p "$OUT"

# Render the SVG to a high-res master PNG via Quick Look, then downscale with sips.
qlmanage -t -s 512 -o "$TMP" "$SVG" >/dev/null 2>&1
MASTER="$TMP/icon.svg.png"
[ -f "$MASTER" ] || { echo "qlmanage failed to render $SVG" >&2; exit 1; }

for size in 16 48 128; do
  sips -z "$size" "$size" "$MASTER" --out "$OUT/icon$size.png" >/dev/null
  echo "wrote extension/icons/icon$size.png"
done
