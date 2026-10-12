#!/bin/sh
# Reuse the existing mobile/offline assets, adapting only generated output.
set -eu
REPO_ROOT="${1:?repo root}"
DEST_WWW="${2:?destination www dir}"
"$REPO_ROOT/ios/scripts/sync-web-assets.sh" "$REPO_ROOT" "$DEST_WWW"
find "$DEST_WWW" -type f \( -name '*.html' -o -name '*.js' \) -exec perl -0pi -e '
  s/ios-app/android-app/g;
  s/FLICKGAME_IOS_APP/FLICKGAME_ANDROID_APP/g;
  s/flickgame_ios_example/flickgame_android_example/g;
  s/the App Store/Google Play/g;
  s/App\s*Store/Google Play/g;
  s/var wanted = /var wanted = window.FLICKGAME_LANGUAGES || /g;
' {} +
# play.html deliberately remains a standalone export template. AssetClient injects
# the runtime bootstrap when serving it inside the app, never into exported games.
for page in index gallery help; do
  perl -0pi -e 's{<head>}{<head>\n  <script src="android_bootstrap.js"></script>\n  <script src="i18n.js"></script>\n  <script src="android_back.js"></script>}' "$DEST_WWW/$page.html"
done
# Layout settling/rotation must change presentation, not regenerate a saved blank
# game after its IndexedDB snapshot. Explicit New still sizes the initial canvas.
perl -0pi -e 's~if \(isProjectBlank\(\)\) newFlickgame\(true\);\n      else if \(isMobileLayout\(\)\)~if (isMobileLayout())~ or die "layout refresh hook not found\n"' "$DEST_WWW/index.html"
# Export the established editor save/discard/cancel flow for system Back.
printf '\n' >> "$DEST_WWW/ios_editor_menu.js"
perl -0pi -e 's~  function init\(\) \{~  window.FlickAndroidBackToGallery = handleBackToGallery;\n\n  function init() {~' "$DEST_WWW/ios_editor_menu.js"
perl -0pi -f "$REPO_ROOT/android/scripts/gallery-import.pl" "$DEST_WWW/gallery_page.js"
cp "$REPO_ROOT/android/web/bootstrap.js" "$DEST_WWW/android_bootstrap.js"
cp "$REPO_ROOT/android/web/back.js" "$DEST_WWW/android_back.js"
echo "Adapted mobile assets for Android at $DEST_WWW"
