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

## Notes

- **localStorage** (editor autosave) persists in the app’s WebKit store like a normal embedded web app.
- **Export / download** via `FileSaver` may need follow-up work on iOS (share sheet / downloads delegate) depending on WebKit behavior—test on device when you care about export UX.
