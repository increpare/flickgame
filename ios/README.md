# Flickgame iOS shell

Native wrapper around the same flickgame web assets as the site: [`index.html`](../index.html) (editor) and [`play.html`](../play.html) (player), plus the static files listed in [`flickgame-web-manifest.txt`](flickgame-web-manifest.txt).

## Open in Xcode

1. Open [`FlickgameShell/FlickgameShell.xcodeproj`](FlickgameShell/FlickgameShell.xcodeproj).
2. Set your **Team** under Signing & Capabilities so the app can run on a device (simulator often works without).
3. Build and run (**⌘R**).

The **Sync web assets** build phase runs before resources are copied; it copies from the repository root into `FlickgameShell/www/` using the manifest. You can also run the script manually from the repo root:

```sh
ios/scripts/sync-web-assets.sh "$(pwd)" ios/FlickgameShell/FlickgameShell/www
```

## Changing which files ship

Edit [`flickgame-web-manifest.txt`](flickgame-web-manifest.txt) (one path per line, relative to repo root). The script fails the build if a listed file is missing.

## Notes

- **localStorage** (editor autosave) persists in the app’s WebKit store like a normal embedded web app.
- **Export / download** via `FileSaver` may need follow-up work on iOS (share sheet / downloads delegate) depending on WebKit behavior—test on device when you care about export UX.
