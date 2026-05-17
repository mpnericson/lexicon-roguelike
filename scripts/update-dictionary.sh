#!/usr/bin/env bash
# Refresh dictionary.txt from Collins CSW (SOWPODS) via danvk/hybrid-boggle.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="https://raw.githubusercontent.com/danvk/hybrid-boggle/main/wordlists/sowpods.txt"
OUT="$ROOT/dictionary.txt"

echo "Downloading SOWPODS word list..."
curl -fsSL "$URL" | tr '[:lower:]' '[:upper:]' > "$OUT"
COUNT=$(wc -l < "$OUT" | tr -d ' ')
echo "Wrote $COUNT words to $OUT"
grep -qx "ZEN" "$OUT" && echo "Verified: ZEN present" || { echo "ERROR: ZEN missing"; exit 1; }
