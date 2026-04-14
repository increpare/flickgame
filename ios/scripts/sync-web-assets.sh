#!/bin/sh
# Copies flickgame web files from the repo into the iOS app bundle source folder.
# Usage: sync-web-assets.sh <REPO_ROOT> <DEST_WWW_DIR>
set -eu

REPO_ROOT="${1:?repo root}"
DEST_WWW="${2:?destination www dir}"

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
MANIFEST="${SCRIPT_DIR}/../flickgame-web-manifest.txt"

if [ ! -f "$MANIFEST" ]; then
  echo "error: manifest not found at $MANIFEST" >&2
  exit 1
fi

mkdir -p "$DEST_WWW"

missing=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|\#*) continue ;;
  esac
  rel="$line"
  src="${REPO_ROOT}/${rel}"
  if [ ! -f "$src" ]; then
    echo "error: missing source file: $src (listed in manifest)" >&2
    missing=1
    continue
  fi
  install -d "$DEST_WWW/$(dirname "$rel")"
  cp -f "$src" "$DEST_WWW/$rel"
done < "$MANIFEST"

if [ "$missing" -ne 0 ]; then
  exit 1
fi

echo "Synced flickgame web assets to $DEST_WWW"
