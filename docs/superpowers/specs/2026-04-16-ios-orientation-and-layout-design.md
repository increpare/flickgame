# iOS Orientation & Layout Fix — Design Spec

## Problem

The flickgame iOS app (a WKWebView shell around the existing web editor) has broken layout behavior across device orientations, a regression in dynamic canvas sizing, and minor cosmetic issues in portrait mode.

### Specific issues

1. **Only 2 of 4 orientations supported**: `Info.plist` and `project.pbxproj` only list `Portrait` and `LandscapeLeft`. When the device is in portrait-upside-down or landscape-right, iOS does not rotate the UI. The web app's orientation detection then sees mismatched viewport dimensions and renders the wrong layout (e.g., portrait-upside-down shows landscape layout with 90-degree-rotated content).

2. **`newFlickgame` regression**: The `newFlickgame()` function was changed to always use hardcoded 160x100 dimensions. Previously, on mobile it called `mobileFillCanvasSize()` to pick a height that fills the available canvas container area. The `isProjectBlank()` auto-resize on orientation change was also removed — blank projects no longer reshape to fit the new orientation.

3. **Portrait cosmetic issues (iOS only)**: Content sits flush with screen edges in portrait. Needs small left/right margins and slightly less tight bottom spacing. These cosmetic issues are specific to the iOS app; the browser layout is correct and must not be changed.

## Approach

Minimal, targeted fixes — CSS and JS on the web side, plist/build settings on the iOS side. No Swift code changes needed.

## Changes

### 1. Enable all four orientations (iOS native config)

**Files**: `ios/FlickgameShell/FlickgameShell.xcodeproj/Info.plist`, `ios/FlickgameShell/FlickgameShell.xcodeproj/project.pbxproj`

Add `UIInterfaceOrientationPortraitUpsideDown` and `UIInterfaceOrientationLandscapeRight` to the `UISupportedInterfaceOrientations` array in `Info.plist`.

Update the matching `INFOPLIST_KEY_UISupportedInterfaceOrientations` build settings in `project.pbxproj` to list all four orientations, keeping plist and build settings in sync.

No Swift changes — `FlickgameShellApp.swift` already uses `.ignoresSafeArea()` and `FlickWebView.swift` does not constrain orientation. The web app's `updateLayoutMode()` uses viewport aspect ratio as its primary signal, so once iOS rotates the view, layout detection works correctly.

### 2. Restore dynamic canvas sizing

**File**: `index.html`

**`newFlickgame()` (line ~744)**: Restore the original logic. On mobile (`isMobileLayout()`), call `mobileFillCanvasSize()` first to measure the canvas container and pick dimensions that fill it (width 160, height calculated to match container aspect ratio). Then use those dimensions for the new game state. On desktop, keep 160x100. Remove the comment about "canonical project dimensions."

**`onLayoutModeChange` (line ~1982)**: Restore the `isProjectBlank()` checks on orientation/layout change. When layout mode changes and the project is blank:
- Mobile path: call `newFlickgame(true)` (keeps current palette) so the canvas reshapes to fit the new orientation
- Desktop path: same — call `newFlickgame(true)` if blank, otherwise `updateDesktopScale()`

The `mobileFillCanvasSize()` function itself (line ~619) is unchanged — it already correctly measures the container and picks appropriate dimensions.

### 3. iOS-only portrait cosmetic polish

**File**: `index.html`

**Detection**: At init time, when `window.FLICKGAME_IOS_APP` is truthy (injected by the Swift shell), set a data attribute on the body, e.g., `document.body.setAttribute('data-host', 'ios-app')`.

**CSS rules scoped to `body[data-host="ios-app"][data-layout="mobile-portrait"]`**:
- Add small horizontal padding (start with 6px, tune visually) on the mobile editor wrapper so content doesn't sit flush with screen edges on left/right
- Slightly reduce bottom spacing so the swatch grid area is less cramped
- Add matching small margin to the toolbar bottom so its edges don't touch screen sides
- Exact pixel values to be tuned during implementation on a notched simulator

These rules only apply to iOS portrait. Browser layout is unaffected. iOS landscape is unaffected — safe-area insets via `env()` handle notch avoidance there, and further landscape cosmetic tuning (if needed) is a separate follow-up after these fixes land.

## Out of scope

- Landscape cosmetic polish — evaluate after orientation fix lands
- Export/download UX on iOS (share sheet)
- Any changes to desktop layout
- Any changes to browser mobile layout

## Testing

After implementation, build with `make sync-ios` and run in Xcode:

1. **All four orientations**: Rotate through portrait, landscape-left, portrait-upside-down, landscape-right on a notched simulator (e.g., iPhone 17e). Canvas should show correct orientation in each. Toolbars, swatches, and menu should all be correctly oriented.
2. **New flickgame sizing**: Tap "New Flickgame" in each mobile orientation. Canvas should fill the available container area, not be fixed at 160x100.
3. **Auto-resize on rotate (blank project)**: Create new flickgame, rotate without drawing — canvas should reshape to fit new orientation. Draw something, rotate — canvas should keep its dimensions.
4. **Portrait margins (iOS)**: Verify small left/right margins appear in portrait, content not flush with edges.
5. **Browser unchanged**: Load `index.html` in a mobile browser — verify no visible changes from current behavior.
6. **Touch input accuracy**: Draw in each orientation, verify strokes appear where touched.
