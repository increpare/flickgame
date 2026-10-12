# Android implementation plan

Goal: deliver a buildable Android app using the existing web/iOS product.
Architecture and decisions: DESIGN.md. Execute inline in this session; keep all
changes under android except additive Makefile/.gitignore/README entries.

- [x] Write Node tests for bootstrap messages, generated assets and standalone
      export. Run node --test android/test/*.test.cjs and verify missing-feature failures.
- [x] Implement scripts/sync-web-assets.sh and web bootstrap/back controls.
      Re-run Node tests; generated web assets must remain ignored.
- [x] Write Java unit tests for origin/path allowlist, safe export paths and
      bounded imports. Implement FileRules, AssetClient, ShareProvider and
      MainActivity. Use ACTION_OPEN_DOCUMENT and read grants, never storage permission.
- [x] Implement Supporter with pending purchase handling, acknowledgement,
      foreground restore, offline cache and quiet startup failures.
- [x] Add Gradle wrapper, API 36 manifest, native resources, nearest-neighbour
      launcher icons from favicon.png, build integration and signing env variables.
- [x] Build debug APK/release AAB, run JVM tests and lint; resolve actual failures.
- [x] Run emulator instrumentation smoke tests and inspect phone/tablet layouts.
- [x] Prepare Play metadata, review instructions, privacy text and release guide.
- [x] Request code review and fix actionable findings. Record verification and
      release dependencies without claiming Play purchases were tested locally.
