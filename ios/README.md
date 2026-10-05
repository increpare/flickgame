# Flickgame iOS shell

Native wrapper around the same flickgame web assets as the site: [`index.html`](../index.html) (editor) and [`play.html`](../play.html) (player), plus the static files listed in [`flickgame-web-manifest.txt`](flickgame-web-manifest.txt).

## Single source of truth (no parallel copies)

- Edit web files only at the **repository root** (same paths as the live site). Do **not** treat `FlickgameShell/www/` as something to hand-maintain: it is **generated output**.
- Every **Xcode build** runs the **Sync web assets** phase first and overwrites `www/` from the manifest.
- From the repo root you can refresh `www/` without Xcode: `make sync-ios` or `ios/scripts/sync-web-assets.sh "$(pwd)" ios/FlickgameShell/FlickgameShell/www`
- Contents of `ios/FlickgameShell/FlickgameShell/www/` are **gitignored** (except `.gitkeep`) so synced blobs are not committed.

## App icon (from `favicon.png`)

The Xcode **AppIcon** set under `FlickgameShell/Assets.xcassets/AppIcon.appiconset/` is **generated** from the repository-root **`favicon.png`**: nearest-neighbour scaling, flattened on **black** where transparency would not be allowed.

- Requires **ImageMagick v7** (`magick` on your `PATH`, e.g. `brew install imagemagick`).
- After changing `favicon.png`, from the repo root run **`make ios-icons`**, then rebuild in Xcode. This is separate from **`make sync-ios`** (web bundle vs store icon assets).

## Open in Xcode

1. Open [`FlickgameShell/FlickgameShell.xcodeproj`](FlickgameShell/FlickgameShell.xcodeproj).
2. Set your **Team** under Signing & Capabilities so the app can run on a device (simulator often works without).
3. Build and run (**⌘R**).

The **Sync web assets** build phase runs before resources are copied; it copies from the repository root into `FlickgameShell/www/` using the manifest.

## Changing which files ship

Edit [`flickgame-web-manifest.txt`](flickgame-web-manifest.txt) (one path per line, relative to repo root). The script fails the build if a listed file is missing.

## Mobile layout QA (manual)

After mobile layout or safe-area changes, build (`make sync-ios`, then run from Xcode) and spot-check **portrait** and **landscape** on a notched device or simulator: toolbar and swatches should clear the safe area, nothing should be clipped, and the editor should remain usable when rotating.

## Local-only

The app never touches the network. The only way in or out is game files: share from the gallery hands a `.flickgame` file to the system share sheet, **Import…** reads one back, and opening one from AirDrop/Messages/Files imports it and plays it (`IncomingGame` in `FlickWebView.swift`). A `.flickgame` file is the same standalone HTML the website exports, under an extension the app owns (`Info.plist`); renamed to `.html` it plays in a browser.

- **Strip markers.** Web code that talks to the outside world (gist sharing, GitHub login, outbound links in help) is wrapped in `<!--ios-strip-->` … `<!--/ios-strip-->` or `/*ios-strip*/` … `/*/ios-strip*/`. `sync-web-assets.sh` deletes those blocks from the copy in `www/`; the website serves the files untouched.
- **URL guard.** After stripping, the sync script fails the build if any URL other than `flickgame.org` / `w3.org` / the FileSaver credit is left in `www/`. If it trips, wrap the offending code in strip markers.
- **Runtime backstop.** `FlickWebView.swift` installs a content rule list that blocks all http(s)/ws/ftp loads and a navigation policy that only allows `file:` pages.

## Translations

The app's interface and help are translated; the website is English only.

- `ios/i18n/<language>.json` holds one language each, keyed by the English text. `_source.json` lists every string with a note for translators. `en-us.json` only lists spellings that differ from the British source.
- `sync-web-assets.sh` joins them with `ios/i18n/runtime.js` into `www/i18n.js`, which the shell injects into every page. Code calls `T('English text')` and gets the English back when there is no translation.
- To add a string: use `T('…')` in the code (or `data-t` in `ios/help/help.html`), add it to `_source.json`, and add it to each language file. `node ios/i18n/check.js` reports files with missing or extra keys.
- The languages are also listed under `CFBundleLocalizations` in `Info.plist`.
- Arabic, Hebrew and Urdu get right-to-left text in help; the editor layout is not mirrored.

## Notes

- Projects live in the app’s WebKit store (IndexedDB); deleting the app deletes them. Exported HTML files are the backup.
- Help opens as an overlay inside the editor (`ios_editor_menu.js`) so unsaved work is not lost.
- The app has its own help page, `ios/help/help.html` (pictures and GIFs made from simulator screenshots), shipped as `help.html`. The website's `help.html` is not bundled.
- `FlickgamePreview` is a Quick Look extension: it shows a game's first picture when a `.flickgame` file is previewed (the screen AirDrop shows on receipt). The app writes that picture into the file on export as a `<!--flickgame-preview:…-->` comment; files without it have no preview.
- A fresh install starts with one game in the gallery, taken from `ios/example.flickgame`. Replace that file with any exported game to change it.
