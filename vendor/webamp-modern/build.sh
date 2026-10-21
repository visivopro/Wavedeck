#!/usr/bin/env bash
# Rebuild src/renderer/modern/webamp-modern.js from source.
# Upstream: https://github.com/captbaritone/webamp (MIT), packages/webamp-modern
set -euo pipefail
UPSTREAM_COMMIT=7734cd3c7cf144bab2d8614ce9f9ba2ff21e163e
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../src/renderer/modern/webamp-modern.js"
WORK="${WORK:-$(mktemp -d)}"
git clone https://github.com/captbaritone/webamp "$WORK/webamp"
cd "$WORK/webamp" && git checkout "$UPSTREAM_COMMIT"
git apply "$HERE/wavedeck.patch"
cd packages/webamp-modern
npm i --no-save esbuild jszip @rgrove/parse-xml@3 id3-parser@2 butterchurn butterchurn-presets
npx esbuild src/wavedeck-entry.ts --bundle --format=iife --target=chrome120 \
  --minify --keep-names --legal-comments=inline --outfile="$OUT"
echo "Built $OUT"
