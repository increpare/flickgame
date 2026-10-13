# Flickgame for Android

Offline Android shell around the same editor, gallery and player as the web and
[iOS app](../ios/README.md). Supports Android 6.0 (API 23) and later; targets Android
16 (API 36). Phone and tablet layouts, all mobile translations and the three starter
games are shared with iOS.

## Build and run

Open this `android/` directory in Android Studio. Install SDK Platform 36 and Build
Tools 35.0.0. Use JDK 17 (Android Studio's bundled JDK is suitable).
Install Node.js 18 or newer and make `node` available on `PATH`; Gradle uses it to
generate the offline assets on Windows, macOS and Linux.

### Windows (PowerShell)

From the repository root:

```powershell
.\android\build.ps1 -Target All
```

This runs the asset/bridge tests, Java unit tests and lint, builds the installable
debug APK and device-test APK, and builds the release AAB. Use `-Target Debug`
(the default), `Release`, or `Verify` to run only that group. Device tests still
require a connected phone or emulator and `gradlew.bat connectedDebugAndroidTest`.

Set `JAVA_HOME` to your JDK and `ANDROID_HOME` to your Android SDK, or use Android
Studio's SDK location in `android/local.properties`. The helper also detects the
default Android Studio installation and SDK. On this checkout it can reuse the
portable Java/SDK in ignored `android/.toolchain/`; that folder and its downloaded
Gradle cache are local tools and are not included in the branch.

You can also run `android\gradlew.bat -p android assembleDebug` directly when
`JAVA_HOME`, the SDK location and `node` are configured.

### macOS / Linux

From the repository root:

```sh
make android-debug
```

Or inside `android/`:

```sh
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Set the SDK location through Android Studio, `ANDROID_HOME`, or an ignored
`local.properties` containing `sdk.dir=/absolute/path/to/your/Android/sdk`.
The checked-in Gradle wrapper downloads Gradle 8.13. The Android plugin is pinned
to 8.13.2 and Play Billing to 8.3.0.

## Shared assets

Every build regenerates `app/build/generated/flickgame/assets/www/`. Edit source
web files at the repository root. Do not edit or commit the generated web bundle.
`make sync-android` refreshes it without building.
On Windows, run
`node android/scripts/sync-web-assets.cjs . android/app/build/generated/flickgame/assets/www`.

The portable Node.js sync script uses the shared iOS manifest, offline strip markers,
help, translations and starter games, then adapts generated host
flags and store wording for Android. It supplies Material icons and a small adapter
for the established native message channels. The in-app player bootstrap is injected
only when served; exported HTML never depends on Android scripts or assets.

`make android-icons` regenerates launcher and Play icons from `favicon.png` using
ImageMagick 7, with nearest-neighbour scaling. `make android-store-art` regenerates
the feature graphic from the existing starter games (Node.js and librsvg
`rsvg-convert` are required).

## Storage and files

Projects live in WebView IndexedDB on the fixed local origin
`https://appassets.androidplatform.net/www/`. Updating the app keeps the origin and
package name, so games remain available. Uninstalling or clearing app data deletes
the gallery. Backups and device transfers are disabled; share files to keep backups.

- The folder button uses `ACTION_OPEN_DOCUMENT`; no storage permission is requested.
- Gallery Share exports the same standalone HTML as iOS under `.flickgame`, through
  a read-only URI grant and Android's share sheet. Renaming it `.html` plays it in a
  browser. The preview comment is retained for iOS Quick Look compatibility.
- Opening/sharing a game from another app imports it into the gallery and plays it.
  Imported HTML is parsed for game data, never executed or navigated to.
- Imports/exports are limited to 32 MiB. External documents are copied using their
  temporary read grants; staged imports survive Activity/process recreation.
  Interrupted delivery retries the same project ID, so a completed save is not
  duplicated if its acknowledgement is lost during navigation.
- Shared temporary files are kept for 24 hours, then cleaned on a later launch.
- The file picker accepts any file because Android providers often label custom
  extensions as `application/octet-stream`; the game parser checks the contents.

Android Back closes Help and pickers, then the editor menu, then uses the existing
save/discard/cancel dialog to return to the gallery. Back from the player returns
to the gallery; Back from the gallery exits. Rotation keeps the WebView and drawing
state alive. System bars, keyboard and display cutouts are handled by native insets.
Layout settling preserves canvas dimensions, including saved blank games. Native
save/discard/cancel replaces the web editor's additional browser unload warning.

## Offline and privacy

All WebView requests are intercepted. Only bundled assets on the private HTTPS
origin are served, external navigation is rejected, and a content security policy
blocks network connections. The final app requests only `com.android.vending.BILLING`:
no internet, location, media or storage permissions. Network permissions introduced
by Billing's telemetry dependencies are explicitly removed from the merged manifest.
The optional purchase talks to the Google Play service in a separate process.

No account, ads, remote gallery or app analytics. See [privacy text](playstore/privacy-policy.txt).

## Supporter and release

The optional one-time supporter purchase changes only the smiley; it unlocks no
features. Android uses product ID `com.increpare.flickgame.supporter` (lowercase as
required by Play), independently of the iOS product.

Purchases are verified locally with the app's Google Play RSA license key. Set
`FLICKGAME_PLAY_LICENSE_KEY` to the base64 public key from Play Console. Without it,
a build remains usable but cannot start a purchase. This public key is safe to
embed in the app; it is not a server/service-account credential. Acknowledgements
are retried on foreground refresh; pending purchases do not grant supporter status.
Successful entitlement queries reflect refunds/revocations; offline failures retain
the last verified smiley state. Restore is in Help and runs automatically on resume.

`make android-release` produces an **unsigned** release AAB unless signing is
configured. A development AAB cannot be uploaded to Play until it is signed with
your upload key. To build the actual upload bundle, set these environment variables
in your local shell or CI secret store:

- `FLICKGAME_KEYSTORE`: absolute path to the upload keystore
- `FLICKGAME_STORE_PASSWORD`: keystore password
- `FLICKGAME_KEY_ALIAS`: upload key alias
- `FLICKGAME_KEY_PASSWORD`: key password
- `FLICKGAME_PLAY_LICENSE_KEY`: app's Play RSA public key

Then run `make android-release`. Result:
`android/app/build/outputs/bundle/release/app-release.aab`.
Keep the upload keystore and passwords outside the repository. Increment versionCode
for every subsequent Play upload. Release builds disable WebView debugging and
retain the native bridge methods through R8.

[Play release preparation](playstore/RELEASE.md) contains metadata and the remaining
account-specific steps. Purchases need a Play-distributed build and license tester;
a sideloaded emulator APK cannot validate a real purchase end to end.

## Verification

From the repository root:

```sh
node --test android/test/*.test.cjs
make android-test
cd android
./gradlew connectedDebugAndroidTest
```

The Node tests exercise bootstrap channels, picker Back handling, asset generation
and round-trip standalone exports using the current example games. JVM tests cover
URL/path/size boundaries and purchase signatures. Device tests use the actual
WebView and document provider for gallery/editor/player navigation, rotation,
save/cancel, Help, read-only exports, untrusted HTML imports and network blocking.
They also cover finger drawing, save/reopen, discard and interrupted import retries.
See [verification record](VERIFICATION.md) for the devices and checks run for this port.
