# Orientation & mobile layout — handoff notes

**Context:** This document exists because a long debugging session on safe-area, canvas sizing, and rotation in the iOS `WKWebView` shell **did not converge on a verified fix**. A lot of time was lost iterating on layout, CSS env() variables, and instrumentation. Treat everything below as **working hypotheses and file pointers**, not as solved facts.

---

## What went wrong (process)

- Multiple overlapping concerns were tackled at once: **CSS safe-area insets**, **JavaScript layout mode** (`desktop` / `mobile-portrait` / `mobile-landscape`), **canvas zoom** (`updateMobileCanvasSize`), **`visualViewport` vs `window.innerWidth/Height`**, and **iOS app orientation policy**.
- **Runtime evidence was sparse or inconclusive** relative to the complexity (rotation transitions, WebKit quirks, transient geometry). The session ended with **debug tooling removed** at the author’s request—not with a proven fix.
- **Do not assume** the last structural change (orientation lock, variable renames, etc.) fully addresses notch alignment, input mapping, or zoom stability until someone measures again on device/simulator.

---

## What we think we know (architecture)

### Web app (`index.html` at repo root)

- **Layout mode** is derived in JS (`updateLayoutMode`): `desktop` vs `mobile-portrait` vs `mobile-landscape`, driven by touch + viewport size threshold and **aspect/orientation heuristics** (`visualViewport` preferred; `screen.orientation` / `window.orientation` / `matchMedia` as fallbacks).
- **`data-layout`** on `<body>` reflects `layoutMode` and is used for CSS branching.
- **Mobile canvas scaling** goes through **`updateMobileCanvasSize`**, which reads the **`mobile-canvas-container`** bounding rect, compares to **`visualViewport`** dimensions, applies a **“oversized” guard** (schedules a settle pass via `requestAnimationFrame` when geometry looks transient/wrong), and sets **`zoomFactor`** from container vs logical canvas size. **`resetViewTransform`**, **`applyEditorDimensions`**, **`setVisuals`** follow when zoom changes.
- **Resize / `orientationchange`** listeners call `updateLayoutMode`, then either desktop scale or `updateMobileCanvasSize` (sometimes double-`requestAnimationFrame` after orientation change to catch settled layout).

### iOS shell

- **`FlickWebView.swift`** loads bundled `www/index.html` (synced from root via the Xcode build phase / `make sync-ios`). It injects `window.FLICKGAME_HOST = 'ios-app'` and `window.FLICKGAME_IOS_APP = true` at document start.
- **Supported orientations** were **restricted** to reduce the “four orientations / notch jumps around” problem:
  - **`Info.plist`**: `UISupportedInterfaceOrientations` lists **`UIInterfaceOrientationPortrait`** and **`UIInterfaceOrientationLandscapeLeft`** only.
  - **`project.pbxproj`** also sets `INFOPLIST_KEY_UISupportedInterfaceOrientations_*` — **keep plist and build settings aligned** if you change this (`GENERATE_INFOPLIST_FILE` makes both relevant).
- If the physical notch ends up on the “wrong” side in landscape for a given device expectation, the fix may be as small as swapping **`LandscapeLeft` ↔ `LandscapeRight`** in **both** places—**verify on hardware**, don’t guess.

---

## What was tried and then backed out

- **Heavy debug instrumentation** (NDJSON ingest, optional native log bridge, `captureSafeAreaSnapshot`-style payloads) was added to correlate viewport rects, zoom, and layout mode. It was **removed** when debugging stopped; **do not expect those hooks in the tree now**.
- **`ios/README.md`** was shortened: it no longer documents a `?debugSafeArea=1` workflow (that path may not exist anymore).

---

## Likely problem areas for the next investigator

These are **candidates**, not confirmed root causes:

1. **Rotation / layout settling:** `innerWidth`/`innerHeight` and `visualViewport` can disagree during iOS rotation; code already tries rAF chaining—timing may still be wrong for some paths.
2. **Zoom vs CSS safe-area:** `zoomFactor` and pixel mapping for drawing/input must stay consistent with **actual** displayed canvas size; any mismatch looks like “wrong stroke position” or “canvas in wrong place.”
3. **`WKWebView` + safe-area:** env(safe-area-inset-*) behavior in embedded WebKit can differ from Mobile Safari; padding on the wrong element duplicates or fights JS assumptions.
4. **Policy vs UX:** Locking to two orientations trades flexibility for predictability; it does not automatically fix geometry bugs.

---

## What a competent assistant should do first

1. **Reproduce on iOS** (simulator + real device): portrait ↔ single allowed landscape, note **notch side**, **toolbar overlap**, **canvas alignment**, **draw accuracy**.
2. **Trace one code path** end-to-end: `orientationchange` / `resize` → `updateLayoutMode` → `onLayoutModeChange` → `updateMobileCanvasSize` → `applyEditorDimensions` / `getCoords` for input.
3. **Add minimal, targeted logging** (or Web Inspector breakpoints) only after forming hypotheses—avoid another multi-hour unfocused pass.
4. If changing orientations again, **edit both** `Info.plist` **and** `project.pbxproj` keys so they stay consistent.

---

## Key files

| Area | Path |
|------|------|
| Editor logic, layout mode, mobile zoom | `index.html` (large; search `layoutMode`, `updateMobileCanvasSize`, `updateLayoutMode`) |
| Bundled copy for Xcode | `ios/FlickgameShell/FlickgameShell/www/index.html` (generated; sync from root) |
| WebView host flags | `ios/FlickgameShell/FlickgameShell/FlickWebView.swift` |
| iOS orientation plist | `ios/FlickgameShell/FlickgameShell.xcodeproj/Info.plist` |
| Build settings / generated plist keys | `ios/FlickgameShell/FlickgameShell.xcodeproj/project.pbxproj` |
| Sync script | `ios/scripts/sync-web-assets.sh`, `Makefile` (`sync-ios`) |

---

## Bottom line

**Today’s session was costly and did not deliver a validated, minimal fix** for the underlying canvas/safe-area/orientation behavior. The app may still exhibit issues on rotation or notched devices. The next person should treat this as **a fresh debugging task with clear reproduction steps and measured evidence**, not as “almost done.”
