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

# www is bundled whole, so clear out anything left from earlier syncs:
# only files in the manifest may ship.
find "$DEST_WWW" -type f ! -name .gitkeep -delete

missing=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|\#*) continue ;;
  esac
  rel="${line%%=*}"
  src="${REPO_ROOT}/${line#*=}"
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

# The example game that a fresh install starts with. ios/example.flickgame is an ordinary
# exported game; only its embedded game data is shipped.
perl -0ne '
  if (m{__EmbedBegin__-->\s*var embeddedDat="([^"]*)"}) {
    print "window.FLICKGAME_EXAMPLE_STATE = decodeURI(\"$1\");\n";
  } else {
    die "no embedded game data in example.flickgame\n";
  }
' "${SCRIPT_DIR}/../example.flickgame" > "$DEST_WWW/example_game.js"

# Translations: one JSON file per language in ios/i18n, keyed by the English text.
{
  echo 'window.FLICK_I18N = {'
  for f in "${SCRIPT_DIR}"/../i18n/*.json; do
    code="$(basename "$f" .json)"
    case "$code" in _*) continue ;; esac
    printf '"%s": ' "$code"
    cat "$f"
    echo ','
  done
  echo '};'
  cat "${SCRIPT_DIR}/../i18n/runtime.js"
} > "$DEST_WWW/i18n.js"

# The app is local-only. Drop everything between ios-strip markers
# (<!--ios-strip--> ... <!--/ios-strip--> or /*ios-strip*/ ... /*/ios-strip*/),
# then refuse to build if any outside-world URL is still in the bundle.
find "$DEST_WWW" -type f \( -name '*.html' -o -name '*.js' \) -exec perl -0pi -e '
  s{[ \t]*(?:<!--|/\*)ios-strip(?:-->|\*/).*?(?:<!--|/\*)/ios-strip(?:-->|\*/)[ \t]*\n?}{}gs;
  s{https://github\.com/increpare/flickgame/issues/}{issue }g;
' {} +

if grep -rnoE 'ios-strip|(https?:)?//(www\.)?[a-z0-9.-]+\.[a-z]{2,}/?|mailto:' "$DEST_WWW" --include='*.html' --include='*.js' --include='*.css' \
  | grep -vE '//(www\.)?(w3\.org|flickgame\.org|purl\.eligrey\.com)'; then
  echo "error: outside-world URL left in the iOS web bundle (see above)" >&2
  exit 1
fi

echo "Synced flickgame web assets to $DEST_WWW"
