# Touch Cursor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a virtual pixel cursor to the flickgame player so touchscreen users can steer a visible cursor by dragging and tap to activate hyperlinks.

**Architecture:** All changes are in `play.html`. Sprite PNGs are parsed into pixel-type arrays at startup. Touch events drive a trackpad-style cursor in game-pixel space. The cursor is composited onto the main canvas at the end of `redraw()` as colored `fillRect` calls. Mouse behavior is completely unchanged.

**Tech Stack:** Vanilla HTML/JS/Canvas. No build tools, no dependencies. No test framework — this is a single-file browser app. Testing is manual (open play.html with a flickgame loaded).

**Spec:** `docs/superpowers/specs/2026-03-15-touch-cursor-design.md`

---

## Chunk 1: Core Implementation

### Task 1: Add constants, state variables, and promote dx/dy

**Files:**
- Modify: `play.html:920-922` (add constants/state after existing globals)
- Modify: `play.html:951-952` (promote dx/dy to module scope in redraw)
- Modify: `play.html:1225-1226` (remove local dx/dy in mouseMove, use module-level)

- [ ] **Step 1: Add constants and state variables**

After line 922 (`var currentIndex=0;`), add:

```javascript
// Touch cursor constants
var POINTER_SPEED = 1.0;
var TAP_THRESHOLD = 10;
var TAP_TIME_THRESHOLD = 300;
var DARK_LUMINANCE = 0.3;

// Touch cursor state
var touchMode = false;
var cursorX = 80.0;
var cursorY = 50.0;
var cursorVisible = false;
var hoveredIsLink = false;
var hoveredColorIndex = -1;
var lastTouchTime = 0;
var activeTouchId = null;
var touchStartX = 0;
var touchStartY = 0;
var touchStartTime = 0;
var lastTouchX = 0;
var lastTouchY = 0;

// Letterbox offsets (promoted from local vars in redraw/mouseMove)
var dx = 0;
var dy = 0;

// Sprite data (populated by loadPointerSprites)
var pointerArrow = null;   // 2D array: pointerArrow[y][x] = 0|1|2
var pointerHand = null;    // 2D array: pointerHand[y][x] = 0|1|2
var POINTER_ARROW_W = 5, POINTER_ARROW_H = 8;
var POINTER_HAND_W = 8, POINTER_HAND_H = 10;
```

- [ ] **Step 2: Promote dx/dy in redraw()**

In `redraw()` (around lines 951-952), change from local `var` to assignment to module-level variables:

```javascript
// BEFORE (lines 951-952):
    var dx=(w-160*zoom)/2;
    var dy=(h-100*zoom)/2;

// AFTER:
    dx=(w-160*zoom)/2;
    dy=(h-100*zoom)/2;
```

- [ ] **Step 3: Remove local dx/dy in mouseMove()**

In `mouseMove()` (around lines 1225-1226), same change:

```javascript
// BEFORE (lines 1225-1226):
    var dx=(w-160*zoom)/2;
    var dy=(h-100*zoom)/2;

// AFTER:
    dx=(w-160*zoom)/2;
    dy=(h-100*zoom)/2;
```

- [ ] **Step 4: Commit**

```bash
git add play.html
git commit -m "Add touch cursor constants/state, promote dx/dy to module scope"
```

---

### Task 2: Load pointer sprites into pixel-type arrays

**Files:**
- Modify: `play.html` (add `loadPointerSprites` function after the state variables, call it from `init`)

- [ ] **Step 1: Add loadPointerSprites function**

Add after the state variable block (after `var POINTER_HAND_W = 8, POINTER_HAND_H = 10;`):

```javascript
function loadPointerSprites() {
  function parseSprite(img, w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var data = ctx.getImageData(0, 0, w, h).data;
    var result = [];
    for (var y = 0; y < h; y++) {
      var row = [];
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var a = data[i + 3];
        if (a < 128) {
          row.push(0); // transparent
        } else {
          var r = data[i], g = data[i+1], b = data[i+2];
          // white if brightness > 128, black otherwise
          if (r + g + b > 384) {
            row.push(1); // white (fill)
          } else {
            row.push(2); // black (outline)
          }
        }
      }
      result.push(row);
    }
    return result;
  }

  var arrowImg = new Image();
  arrowImg.onload = function() {
    pointerArrow = parseSprite(arrowImg, POINTER_ARROW_W, POINTER_ARROW_H);
  };
  arrowImg.src = 'pointer.png';

  var handImg = new Image();
  handImg.onload = function() {
    pointerHand = parseSprite(handImg, POINTER_HAND_W, POINTER_HAND_H);
  };
  handImg.src = 'pointer_hand.png';
}
```

- [ ] **Step 2: Call loadPointerSprites from init()**

In `init()` (line 1295), add the call before `get_page_data()`:

```javascript
// BEFORE (line 1308):
  get_page_data();

// AFTER:
  loadPointerSprites();
  get_page_data();
```

- [ ] **Step 3: Commit**

```bash
git add play.html
git commit -m "Load pointer sprites into pixel-type arrays at startup"
```

---

### Task 3: Add cursor drawing to redraw()

**Files:**
- Modify: `play.html` (add `drawCursor` function, call it at end of `redraw`)

- [ ] **Step 1: Add helper to parse hex color to RGB**

Add after `loadPointerSprites`:

```javascript
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : {r: 0, g: 0, b: 0};
}
```

- [ ] **Step 2: Add drawCursor function**

Add after `hexToRgb`:

```javascript
function drawCursor() {
  if (!touchMode || !cursorVisible) return;

  var sprite, spriteW, spriteH, hotspotX;

  if (hoveredIsLink && pointerHand) {
    sprite = pointerHand;
    spriteW = POINTER_HAND_W;
    spriteH = POINTER_HAND_H;
    hotspotX = 4;
  } else if (pointerArrow) {
    sprite = pointerArrow;
    spriteW = POINTER_ARROW_W;
    spriteH = POINTER_ARROW_H;
    hotspotX = 0;
  } else {
    return; // sprites not loaded yet
  }

  var px = Math.floor(cursorX);
  var py = Math.floor(cursorY);
  var screenX = (px - hotspotX) * zoom + dx;
  var screenY = py * zoom + dy;

  // Determine fill and outline colors
  var fillColor = '#ffffff';
  var outlineColor = '#000000';

  if (hoveredIsLink && hoveredColorIndex >= 0 && hoveredColorIndex < 16) {
    fillColor = colorPalette[hoveredColorIndex];
    var rgb = hexToRgb(fillColor);
    var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    if (luminance < DARK_LUMINANCE) {
      outlineColor = '#ffffff';
    }
  }

  for (var y = 0; y < spriteH; y++) {
    for (var x = 0; x < spriteW; x++) {
      var pixelType = sprite[y][x];
      if (pixelType === 0) continue; // transparent

      if (pixelType === 1) {
        mainCanvasCtx.fillStyle = fillColor;
      } else {
        mainCanvasCtx.fillStyle = outlineColor;
      }
      mainCanvasCtx.fillRect(
        screenX + x * zoom,
        screenY + y * zoom,
        zoom, zoom
      );
    }
  }
}
```

- [ ] **Step 3: Call drawCursor at end of redraw()**

In `redraw()`, just before the closing `}` of the `if (images.length>0)` block (after the `drawImage` calls, around line 959):

```javascript
// BEFORE (line 959):
    }
  } else {

// AFTER:
    drawCursor();
    }
  } else {
```

- [ ] **Step 4: Commit**

```bash
git add play.html
git commit -m "Add cursor drawing composited onto main canvas"
```

---

### Task 4: Add touch event handlers

**Files:**
- Modify: `play.html` (add touch handler functions, register them in `init`)

- [ ] **Step 1: Add updateCursorHover helper**

Add after `drawCursor`:

```javascript
function updateCursorHover() {
  var px = Math.floor(cursorX);
  var py = Math.floor(cursorY);
  if (gameState && px >= 0 && px < 160 && py >= 0 && py < 100) {
    var ch = gameState.imageDats[currentIndex][px + 160 * py];
    hoveredColorIndex = parseInt(ch, 16);
    hoveredIsLink = gameState.hyperlinks[currentIndex][hoveredColorIndex] !== 0;
  } else {
    hoveredColorIndex = -1;
    hoveredIsLink = false;
  }
}
```

- [ ] **Step 2: Add touchStart handler**

```javascript
function touchStart(e) {
  if (gameState == null || images.length === 0) return;
  e.preventDefault();

  // Only track the first finger
  if (activeTouchId !== null) return;
  var touch = e.changedTouches[0];
  activeTouchId = touch.identifier;

  // Enter touch mode
  if (!touchMode) {
    touchMode = true;
    mainCanvas.style.cursor = 'none';
  }

  // Show cursor at center if not yet visible
  if (!cursorVisible) {
    cursorX = 80.0;
    cursorY = 50.0;
    cursorVisible = true;
    updateCursorHover();
    redraw();
  }

  // Record for tap detection
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = Date.now();
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;
}
```

- [ ] **Step 3: Add touchMove handler**

```javascript
function touchMove(e) {
  if (gameState == null || images.length === 0) return;
  e.preventDefault();

  // Find our tracked touch
  var touch = null;
  for (var i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === activeTouchId) {
      touch = e.changedTouches[i];
      break;
    }
  }
  if (!touch) return;

  // Calculate delta in screen pixels
  var deltaX = touch.clientX - lastTouchX;
  var deltaY = touch.clientY - lastTouchY;
  lastTouchX = touch.clientX;
  lastTouchY = touch.clientY;

  // Convert to game-pixel delta
  var gameDeltaX = (deltaX / zoom) * POINTER_SPEED;
  var gameDeltaY = (deltaY / zoom) * POINTER_SPEED;

  // Update cursor position (float)
  cursorX = Math.max(0, Math.min(159, cursorX + gameDeltaX));
  cursorY = Math.max(0, Math.min(99, cursorY + gameDeltaY));

  updateCursorHover();
  redraw();
}
```

- [ ] **Step 4: Add touchEnd handler**

```javascript
function touchEnd(e) {
  if (gameState == null || images.length === 0) return;
  e.preventDefault();

  // Find our tracked touch
  var touch = null;
  for (var i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === activeTouchId) {
      touch = e.changedTouches[i];
      break;
    }
  }
  if (!touch) return;

  activeTouchId = null;
  lastTouchTime = Date.now();

  // Tap detection
  var totalMove = Math.abs(touch.clientX - touchStartX) + Math.abs(touch.clientY - touchStartY);
  var elapsed = Date.now() - touchStartTime;

  if (totalMove < TAP_THRESHOLD && elapsed < TAP_TIME_THRESHOLD) {
    // It's a tap — activate hovered link
    if (hoveredIsLink && !animating) {
      var px = Math.floor(cursorX);
      var py = Math.floor(cursorY);
      var ch = gameState.imageDats[currentIndex][px + 160 * py];
      var colIndex = parseInt(ch, 16);
      var linkTarget = gameState.hyperlinks[currentIndex][colIndex];

      if (linkTarget > 0) {
        // Reset cursor to center for new page
        cursorX = 80.0;
        cursorY = 50.0;

        if (showAnimation) {
          transition(currentIndex, linkTarget - 1);
          currentIndex = linkTarget - 1;
          updateCursorHover();
          doAnimation();
        } else {
          currentIndex = linkTarget - 1;
          updateCursorHover();
          redraw();
        }
      }
    }
  }
}
```

- [ ] **Step 5: Register touch events in init()**

In `init()`, after the existing `mousedown` listener (line 1304), add:

```javascript
  mainCanvas.addEventListener('touchstart', touchStart, {passive: false});
  mainCanvas.addEventListener('touchmove', touchMove, {passive: false});
  mainCanvas.addEventListener('touchend', touchEnd, {passive: false});
  mainCanvas.addEventListener('touchcancel', function(e) {
    activeTouchId = null;
    lastTouchTime = Date.now();
  }, false);
```

- [ ] **Step 6: Commit**

```bash
git add play.html
git commit -m "Add touch event handlers with trackpad-style cursor steering"
```

---

### Task 5: Add mouse-mode-switch-back and CSS touch-action fix

**Files:**
- Modify: `play.html` (update mouseMove, update CSS)

- [ ] **Step 1: Add mode-switch-back to mouseMove**

At the top of `mouseMove()`, after the `gameState==null` guard (line 1208), add:

```javascript
    // Switch back from touch mode if real mouse detected
    if (touchMode && (e.movementX !== 0 || e.movementY !== 0)) {
      if (Date.now() - lastTouchTime > 500) {
        touchMode = false;
        cursorVisible = false;
        mainCanvas.style.cursor = 'default';
      }
    }

    // Skip mouse cursor style changes while in touch mode
    if (touchMode) return;
```

- [ ] **Step 2: Change touch-action CSS**

In the `#content canvas` CSS block (line 62), change:

```css
/* BEFORE: */
  touch-action: manipulation;

/* AFTER: */
  touch-action: none;
```

- [ ] **Step 3: Commit**

```bash
git add play.html
git commit -m "Add mouse mode switch-back with debounce, fix touch-action CSS"
```

---

### Task 6: Manual testing

- [ ] **Step 1: Test mouse behavior is unchanged**

Open `play.html` with a flickgame loaded (use `?p=<gist_id>` or an embedded game). Verify:
- Mouse cursor changes to pointer hand over hyperlinked colors
- Clicking hyperlinked colors transitions to the target page
- Animations play if enabled
- No visible cursor sprite appears
- Resizing the window still works

- [ ] **Step 2: Test touch behavior**

On a touchscreen device (or using browser DevTools device emulation with touch simulation):
- Touch the canvas — virtual arrow cursor appears at center
- Drag finger — cursor moves trackpad-style (not under finger)
- Cursor stays within game bounds (can't go off-screen)
- Cursor snaps to pixel grid
- Moving over a hyperlinked color changes cursor to hand sprite, colored with that palette color
- Moving over a dark hyperlinked color shows white outline on the hand
- Quick tap activates the hovered link and transitions pages
- Cursor resets to center after page transition
- Second finger is ignored
- After releasing touch, moving the mouse switches back to normal mouse mode

- [ ] **Step 3: Commit any fixes, then final commit**

```bash
git add play.html
git commit -m "Touch cursor feature complete"
```
