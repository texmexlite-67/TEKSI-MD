#!/bin/bash
# TEKSI-MD • TEKSI — Quick start (Termux / Linux)
set -u

echo "Starting TEKSI-MD..."
cd "$(dirname "$0")"

# sharp on Termux/arm32 must never try a source build against a global libvips.
export SHARP_IGNORE_GLOBAL_LIBVIPS=1
export TMPDIR="${TMPDIR:-$HOME/tmp}"
mkdir -p "$TMPDIR"

# ---------------------------------------------------------------------------
# Termux helper packages for PDF / ZIP / audio commands.
# Skipped on VPS/PC/Render — those use their own package manager or prebuilts.
# ---------------------------------------------------------------------------
if [[ -d /data/data/com.termux || -n "${TERMUX_VERSION:-}" ]]; then
  command -v ffmpeg    >/dev/null 2>&1 || pkg install -y ffmpeg
  command -v qpdf      >/dev/null 2>&1 || pkg install -y qpdf
  command -v pdftotext >/dev/null 2>&1 || pkg install -y poppler
  command -v zip       >/dev/null 2>&1 || pkg install -y zip
  command -v unzip     >/dev/null 2>&1 || pkg install -y unzip

  # Pillow is the image backend on Termux/arm32 (replaces broken sharp WASM).
  command -v python3 >/dev/null 2>&1 || pkg install -y python
  python3 -c 'import PIL' >/dev/null 2>&1 || pkg install -y python-pillow
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install --no-audit --no-fund
fi

exec node index.js
