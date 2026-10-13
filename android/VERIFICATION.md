# Android verification — 12 October 2026

## Build and automated checks

Verified with JDK 17, Gradle 8.13, AGP 8.13.2, SDK Platform 36 and Build Tools 35.0.0.

| Check | Result |
| --- | --- |
| `node --test android/test/*.test.cjs` | 4 passed |
| `:app:testDebugUnitTest` | 5 passed: file/origin/size boundaries and RSA purchase signatures |
| `:app:assembleDebug` | Passed; installable debug-signed APK |
| `:app:assembleDebugAndroidTest` | Passed |
| `:app:lintDebug` | 0 errors, 7 warnings |
| `:app:bundleRelease` | Passed, including R8 and release lint |
| Android 14 / API 34, real WebView instrumentation | 6 passed |
| Android 16 / API 36, real WebView instrumentation | 6 passed |
| Android 16 tablet viewport, 1600×2560 at 240 dpi | 6 passed; final gallery/editor/player capture rerun passed |
| Android 16 tablet viewport, 2560×1600 at 240 dpi | Gallery/editor/pickers/player capture test passed |

The device suite checks actual touch drawing, a clean New project, save/reopen,
Save/Discard/Cancel, Help preserving unsaved work, Android Back, phone rotation,
read-only shared content URIs, Unicode filenames, incoming HTML parsed without
execution, delayed IndexedDB persistence, interrupted imports without duplicates,
and blocked remote requests/navigation. The export test round-trips an existing
`.flickgame` through the bundled standalone player template.

The Android 14 emulator used a temporary read-only overlay of the existing AVD.
The Android 16 emulator and large-screen overrides were temporary. These are
emulator results, not physical phone/tablet certification or API 23 device testing.
Android 16 tablet orientation requests are ignored by the platform; the tablet
capture test therefore uses both explicit display shapes instead of requesting
phone orientation changes.

Lint's remaining warnings are the deliberately pinned Gradle wrapper version,
the Back callback attribute ignored on older Android versions (with a native
fallback), and five legacy square launcher icons preserving the existing favicon.
Modern adaptive, round and monochrome icons are included.

## Manual and visual checks

Inspected the captured gallery, editor, 16-picture picker, colour link picker and
player on phone and both tablet shapes. Screenshots in `playstore/screenshots/`
come from the real app. Inspected the generated 512×512 Play icon and 1024×500
feature graphic.

On Android 16, tapping Gallery Share displayed Android's native chooser with
`icecream.flickgame`; no recipient was selected. The folder button opened Android's
document picker. Instrumentation separately verifies provider reads, rejected
writes and import of a content URI.

The final APK's permission dump contains only `com.android.vending.BILLING`.
`jarsigner -verify` confirms the development release AAB is unsigned.
Backup/transfer rules explicitly exclude every Android storage domain, following
the [Android backup configuration](https://developer.android.com/identity/data/autobackup).

Independent code review identified and resolved the Play product ID casing,
picker Back handling, durable import acknowledgement and navigation retry latch.
Device tests additionally caught blank-game regeneration during layout settling
and a duplicate browser unload warning after drawing; both are fixed in the
Android host/generated bundle. The web and iOS source files were preserved.

## Artifacts

- `app/build/outputs/apk/debug/app-debug.apk` — sideloadable development build.
- `app/build/outputs/bundle/release/app-release.aab` — unsigned release compilation.
- `playstore/` — listing, privacy text, review notes, icons, feature graphic and screenshots.

SHA-256 for the original build recorded above (before the Windows preparation):

```text
APK  568d1bf6fcbe0cd5bd68d6efe542ac46cc731d318349ed1d4e689151d7b04689
AAB  9f7b467d15685f3ca9c6a126d4478cf5faeb53a7cf4a586d34de5233c38ad255
```

Build outputs and the machine-specific SDK location are ignored. Rebuild using
[README.md](README.md); hashes will change when signing or sources change.

## Release checks requiring the Play account

No app has been submitted or published. The upload keystore, Play RSA public key,
supporter product and internal testing track must be configured in the developer
account. Real purchases, pending payment completion, acknowledgement, restore and
refund/revocation need a Play-distributed build and license tester; they cannot be
certified with this sideloaded emulator build. Publish the prepared privacy text at
a public URL and complete Play's account/content forms before submission. Follow
[playstore/RELEASE.md](playstore/RELEASE.md).

## Windows build preparation — 12 October 2026

Rebuilt on branch `codex/pre-wipe-2026-10-12/flickgame-42951473/working-files`
with portable Temurin JDK 17.0.20.1, SDK Platform 36, Build Tools 35.0.0,
Gradle 8.13 and AGP 8.13.2. Local Java, SDK and Gradle downloads are ignored under
`.toolchain/`. Run `android/build.ps1 -Target All` from the repository root.

Android asset generation now uses Node.js directly, without requiring a Unix shell,
Perl or Unix file utilities. It preserves the shared manifest, translations, examples,
offline stripping and Android-specific editor/import adaptations. Text processing
normalizes Windows line endings; expected source hooks must exist or the build fails.
The shell entry point delegates to the same portable script.

| Check | Windows result |
| --- | --- |
| Node asset/bridge tests | 6 passed, including import persistence/retry and safe regeneration |
| Java unit tests | 5 passed, 0 skipped/failures/errors |
| Debug APK | Built; `apksigner verify` passed with v1 and v2 signatures |
| Device-test APK | Built; device execution was not repeated in this Windows session |
| Debug lint | 0 errors, 7 warnings |
| Release AAB | Built with R8 and release lint; `jarsigner -verify` confirms unsigned |
| Packaged manifest | Package `com.increpare.flickgame`, minimum API 23, target API 36; only Billing permission |

The first Gradle run hit a transient Windows dependency-cache file lock. Retrying
the same command succeeded. Earlier device/visual verification above is a separate
record; this session certifies the Windows build and automated checks.

SHA-256 for the current Windows artifacts:

```text
APK  5357135c86ca216d26577bb9fddee6920678692b039d738eed5686178954f0eb
AAB  359d7f27ce2e1a10048b7a5b362f8d52c2f1d8cb69170f4c91c046bed5a4a361
```

The release AAB still needs the developer's upload keystore and Play configuration
before submission. No Play submission or purchase/device testing was performed here.
