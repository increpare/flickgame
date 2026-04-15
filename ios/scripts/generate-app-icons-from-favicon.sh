#!/bin/sh
# Build AppIcon.appiconset PNGs from repo-root favicon.png (nearest-neighbour, black behind transparency).
# Usage: generate-app-icons-from-favicon.sh <REPO_ROOT> <APPICONSET_DIR>
set -eu

REPO_ROOT="${1:?repo root}"
APPICONSET_DIR="${2:?AppIcon.appiconset directory}"

if ! command -v magick >/dev/null 2>&1; then
  echo "error: ImageMagick v7 (magick) not found. Install e.g. brew install imagemagick" >&2
  exit 1
fi

FAVICON="${REPO_ROOT}/favicon.png"
if [ ! -f "$FAVICON" ]; then
  echo "error: missing $FAVICON" >&2
  exit 1
fi

mkdir -p "$APPICONSET_DIR"
ASSETS_DIR="$(CDPATH= cd -- "$(dirname "$APPICONSET_DIR")" && pwd)"

# Asset catalog root (parent of AppIcon.appiconset)
if [ ! -f "${ASSETS_DIR}/Contents.json" ]; then
  printf '%s\n' '{"info":{"author":"xcode","version":1}}' > "${ASSETS_DIR}/Contents.json"
fi

MASTER="$(mktemp "${TMPDIR:-/tmp}/favicon_master.XXXXXX").png"
cleanup() { rm -f "$MASTER"; }
trap cleanup EXIT

# Opaque RGB on black, then each size uses nearest-neighbour from this master.
magick "$FAVICON" -background black -alpha remove -alpha off "$MASTER"

# Unique square pixel sizes (deduped filenames Icon-<px>.png).
# Add ~5% padding on each side by scaling artwork to 90% and centering on a black square.
for px in 20 29 40 58 60 76 80 87 120 152 167 180 1024; do
  inset_px=$(( (px * 90 + 50) / 100 ))
  magick -size "${px}x${px}" canvas:black \
    \( "$MASTER" -filter point -resize "${inset_px}x${inset_px}!" \) \
    -gravity center -composite \
    "${APPICONSET_DIR}/Icon-${px}.png"
done

cat > "${APPICONSET_DIR}/Contents.json" <<'EOF'
{
  "images" : [
    { "size" : "20x20",   "idiom" : "iphone",      "filename" : "Icon-40.png",   "scale" : "2x" },
    { "size" : "20x20",   "idiom" : "iphone",      "filename" : "Icon-60.png",   "scale" : "3x" },
    { "size" : "29x29",   "idiom" : "iphone",      "filename" : "Icon-58.png",   "scale" : "2x" },
    { "size" : "29x29",   "idiom" : "iphone",      "filename" : "Icon-87.png",   "scale" : "3x" },
    { "size" : "40x40",   "idiom" : "iphone",      "filename" : "Icon-80.png",   "scale" : "2x" },
    { "size" : "40x40",   "idiom" : "iphone",      "filename" : "Icon-120.png",  "scale" : "3x" },
    { "size" : "60x60",   "idiom" : "iphone",      "filename" : "Icon-120.png",  "scale" : "2x" },
    { "size" : "60x60",   "idiom" : "iphone",      "filename" : "Icon-180.png",  "scale" : "3x" },
    { "size" : "20x20",   "idiom" : "ipad",        "filename" : "Icon-20.png",   "scale" : "1x" },
    { "size" : "20x20",   "idiom" : "ipad",        "filename" : "Icon-40.png",   "scale" : "2x" },
    { "size" : "29x29",   "idiom" : "ipad",        "filename" : "Icon-29.png",   "scale" : "1x" },
    { "size" : "29x29",   "idiom" : "ipad",        "filename" : "Icon-58.png",   "scale" : "2x" },
    { "size" : "40x40",   "idiom" : "ipad",        "filename" : "Icon-40.png",   "scale" : "1x" },
    { "size" : "40x40",   "idiom" : "ipad",        "filename" : "Icon-80.png",   "scale" : "2x" },
    { "size" : "76x76",   "idiom" : "ipad",        "filename" : "Icon-76.png",   "scale" : "1x" },
    { "size" : "76x76",   "idiom" : "ipad",        "filename" : "Icon-152.png",  "scale" : "2x" },
    { "size" : "83.5x83.5", "idiom" : "ipad",    "filename" : "Icon-167.png",  "scale" : "2x" },
    { "size" : "1024x1024", "idiom" : "ios-marketing", "filename" : "Icon-1024.png", "scale" : "1x" }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF

echo "Wrote AppIcon set to $APPICONSET_DIR"
