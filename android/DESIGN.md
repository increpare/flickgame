# Android port

Carry the web/iOS product decisions onto Android: offline gallery, drawing editor,
16-picture player, all existing translations, three starter games, compatible
.flickgame import/export, native share sheet, and optional one-time supporter.

The repository-root web assets remain the source of truth. Each Gradle build runs
the existing offline iOS asset pipeline, then adapts only the generated Android
bundle. The native Activity serves bundled files on a fixed private HTTPS origin,
blocks external requests/navigation, and exposes a small bridge for documents,
sharing and billing. Imported HTML is parsed as data by the existing importer;
it is never navigated to or executed. Gallery data lives in WebView IndexedDB.

Android-specific controls use Material icons and system dialogs. Insets keep the
existing mobile layout clear of system bars, cutouts and the keyboard. Rotation
keeps the WebView alive. Back dismisses overlays, then uses the existing editor
save/discard/cancel flow, then exits from the gallery.

Package com.increpare.flickgame; minimum Android 6/API 23; compile/target API 36.
AGP 8.13.2, Gradle 8.13, Java 17, Play Billing 8.3.0. Supporter is a non-consumable
with product ID com.increpare.flickgame.supporter (Play requires lowercase IDs).
Billing uses the Play service; the app requests no internet or storage permissions.
Backup is disabled so the local-only gallery is not uploaded automatically.

Verification: Node bridge/bundle/export tests; Java file/URL boundary unit tests;
Gradle debug APK, release AAB and lint; emulator tests of gallery/editor/player,
rotation, import, sharing, persistence, external navigation and Android Back.
Play purchases require an uploaded build and a Play license tester.
