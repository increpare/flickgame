# iOS Orientation & Layout Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix iOS app orientation support (all 4 orientations), restore dynamic canvas sizing on mobile, and add iOS-only portrait cosmetic margins.

**Architecture:** Three independent changes touching iOS plist/build config and the web app's `index.html`. No Swift code changes. Browser behavior must remain identical — iOS-only cosmetic changes are gated on `data-host="ios-app"`.

**Tech Stack:** Xcode project config (plist, pbxproj), vanilla JS, CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `ios/FlickgameShell/FlickgameShell.xcodeproj/Info.plist` | Modify | Add missing orientation entries |
| `ios/FlickgameShell/FlickgameShell.xcodeproj/project.pbxproj` | Modify | Sync orientation build settings |
| `index.html` | Modify | Restore `newFlickgame` sizing, restore `isProjectBlank` auto-resize, add `data-host` attribute, add iOS portrait CSS |

---

### Task 1: Enable all four orientations in Info.plist

**Files:**
- Modify: `ios/FlickgameShell/FlickgameShell.xcodeproj/Info.plist:29-33`

- [ ] **Step 1: Add the two missing orientations to Info.plist**

Replace the current `UISupportedInterfaceOrientations` array:

```xml
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
	</array>
```

With:

```xml
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
```

- [ ] **Step 2: Verify the plist is valid XML**

Run: `plutil -lint ios/FlickgameShell/FlickgameShell.xcodeproj/Info.plist`
Expected: `ios/FlickgameShell/FlickgameShell.xcodeproj/Info.plist: OK`

- [ ] **Step 3: Commit**

```bash
git add ios/FlickgameShell/FlickgameShell.xcodeproj/Info.plist
git commit -m "ios: enable all four device orientations in Info.plist"
```

---

### Task 2: Sync orientation build settings in project.pbxproj

**Files:**
- Modify: `ios/FlickgameShell/FlickgameShell.xcodeproj/project.pbxproj:176-177,261-262`

There are four lines to change (two per build configuration — Debug and Release). Each line appears once in its respective build settings block.

- [ ] **Step 1: Update all four INFOPLIST_KEY lines**

Find each of these lines (they appear at lines 176, 177, 261, 262):

```
INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft";
INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft";
```

Replace each with (respectively):

```
INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
```

All four instances use the same replacement value.

- [ ] **Step 2: Verify the pbxproj parses correctly**

Run: `plutil -lint ios/FlickgameShell/FlickgameShell.xcodeproj/project.pbxproj`
Expected: `ios/FlickgameShell/FlickgameShell.xcodeproj/project.pbxproj: OK`

- [ ] **Step 3: Commit**

```bash
git add ios/FlickgameShell/FlickgameShell.xcodeproj/project.pbxproj
git commit -m "ios: sync all four orientations in pbxproj build settings"
```

---

### Task 3: Restore dynamic canvas sizing in newFlickgame()

**Files:**
- Modify: `index.html:744-784`

- [ ] **Step 1: Restore mobile-aware sizing in newFlickgame()**

Find the current `newFlickgame` function opening (lines 744-750):

```javascript
    function newFlickgame(keepPalette) {
      closeBurgerDialog();
      resetViewTransform();
      // Keep canonical project dimensions independent of current orientation.
      // Orientation-specific dimensions make the canvas appear "rotated" or skewed after device rotation.
      var w = 160;
      var h = 100;
```

Replace with:

```javascript
    function newFlickgame(keepPalette) {
      closeBurgerDialog();
      resetViewTransform();
      var w, h;
      if (isMobileLayout()) {
        mobileFillCanvasSize();
        w = width;
        h = height;
      } else {
        w = 160;
        h = 100;
      }
```

This restores the original behavior: on mobile, `mobileFillCanvasSize()` measures the canvas container and sets `width`/`height` globals to fill it (keeping width at 160, calculating height from the container aspect ratio). On desktop, dimensions stay 160x100.

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "fix: restore dynamic canvas sizing in newFlickgame for mobile"
```

---

### Task 4: Restore isProjectBlank() auto-resize on layout mode change

**Files:**
- Modify: `index.html:1982-2002`

- [ ] **Step 1: Restore isProjectBlank checks in onLayoutModeChange**

Find the mobile path inside `window.onLayoutModeChange` (lines 1982-1988):

```javascript
          closeBurgerDialog();
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              updateMobileCanvasSize();
              updateMobileToolbarBottomScale();
            });
          });
```

Replace with:

```javascript
          closeBurgerDialog();
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              if (isProjectBlank()) newFlickgame(true);
              else updateMobileCanvasSize();
              updateMobileToolbarBottomScale();
            });
          });
```

- [ ] **Step 2: Restore isProjectBlank check in the desktop path**

Find the desktop path inside `window.onLayoutModeChange` (lines 1999-2002):

```javascript
          requestAnimationFrame(function() {
            updateDesktopScale();
            updateMobileToolbarBottomScale();
          });
```

Replace with:

```javascript
          requestAnimationFrame(function() {
            if (isProjectBlank()) newFlickgame(true);
            else updateDesktopScale();
            updateMobileToolbarBottomScale();
          });
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: restore auto-resize of blank projects on orientation change"
```

---

### Task 5: Add data-host attribute for iOS detection

**Files:**
- Modify: `index.html:1706-1711`

- [ ] **Step 1: Set data-host attribute at init time**

Find the start of the `init()` function (lines 1706-1711):

```javascript
    function init() {
      updatePaletteRGB();
      for (var i = 0; i < 16; i++) {
        paletteContrastColors[i] = contrastTextColor(colorPalette[i]);
      }
      updateLayoutMode();
```

Replace with:

```javascript
    function init() {
      if (window.FLICKGAME_IOS_APP) {
        document.body.setAttribute('data-host', 'ios-app');
      }
      updatePaletteRGB();
      for (var i = 0; i < 16; i++) {
        paletteContrastColors[i] = contrastTextColor(colorPalette[i]);
      }
      updateLayoutMode();
```

This runs before any layout logic, so CSS rules scoped to `[data-host="ios-app"]` are active from the first paint.

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: set data-host attribute when running in iOS app shell"
```

---

### Task 6: Add iOS-only portrait cosmetic CSS

**Files:**
- Modify: `index.html` (CSS section, after the existing mobile-portrait rules around line ~3606)

- [ ] **Step 1: Add iOS portrait margin rules**

Find the end of the mobile editor wrapper rules (after line 3606):

```css
      padding-left: var(--sa-left);
    }
```

Add the following CSS block immediately after that closing `}`:

```css
    body[data-host="ios-app"][data-layout="mobile-portrait"] #mobile-editor-wrapper {
      padding-left: max(var(--sa-left), 6px);
      padding-right: max(var(--sa-right), 6px);
      padding-bottom: max(var(--sa-bottom), 4px);
    }
```

This ensures a minimum 6px horizontal and 4px bottom padding even when safe-area insets are zero (non-notch edges). On notch edges, the safe-area inset is larger and wins via `max()`. Only applies in the iOS app in portrait.

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add iOS-only portrait margins for breathing room"
```

---

### Task 7: Sync web assets and verify build

- [ ] **Step 1: Sync web assets to the iOS bundle**

Run: `make sync-ios`
Expected: Script copies files from root into `ios/FlickgameShell/FlickgameShell/www/` without errors.

- [ ] **Step 2: Build in Xcode**

Open `ios/FlickgameShell/FlickgameShell.xcodeproj` in Xcode. Build and run on an iPhone simulator (e.g., iPhone 17e). Verify:
- App launches without errors
- No console warnings about missing files

- [ ] **Step 3: Manual QA — all four orientations**

Rotate through portrait → landscape-left → portrait-upside-down → landscape-right:
- Canvas shows correct orientation in each
- Toolbars, swatches, menu all correctly oriented
- Touch input draws where touched

- [ ] **Step 4: Manual QA — new flickgame sizing**

In each mobile orientation, tap menu → "New Flickgame":
- Canvas should fill the available container area (not fixed 160x100)
- Width stays 160, height adapts to fit

- [ ] **Step 5: Manual QA — blank project auto-resize**

Create a new flickgame in portrait. Without drawing, rotate to landscape:
- Canvas should automatically reshape to fit landscape
Draw a pixel. Rotate back to portrait:
- Canvas should keep its landscape dimensions (no auto-resize)

- [ ] **Step 6: Manual QA — portrait margins (iOS)**

In portrait on the iOS simulator:
- Small gap visible between content and left/right screen edges
- Bottom area has slight breathing room
- Toolbar bottom edges don't touch screen sides

- [ ] **Step 7: Manual QA — browser unchanged**

Open `index.html` directly in a mobile browser (or desktop browser with mobile emulation):
- No visible changes from current behavior
- No extra margins or padding
