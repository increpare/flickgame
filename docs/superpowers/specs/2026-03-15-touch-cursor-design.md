# Touch Cursor for Flickgame Player

## Problem

Flickgame's player (play.html) doesn't work well on touchscreens. Tapping directly on the canvas hides the target under the user's finger, and there's no hover feedback. The game's 160x100 pixel canvas makes precise touch targeting impractical.

## Solution

Add a virtual pixel cursor for touch users. The cursor is steered by dragging (trackpad-style, not anchored to fingertip) and activated by tapping anywhere on screen. Mouse users see no change.

## Scope

Only play.html is affected. The editor (index.html) is out of scope.

## Constants

```
POINTER_SPEED = 1.0        // multiplier on finger delta in game-pixel space
TAP_THRESHOLD = 10         // max screen-px movement to count as tap
TAP_TIME_THRESHOLD = 300   // max ms for a tap
DARK_LUMINANCE = 0.3       // below this, invert cursor outline to white
```

## State

```
touchMode: boolean          // false until first touch event
cursorX, cursorY: float     // position in game-pixel space (0.0-159.0 / 0.0-99.0)
cursorVisible: boolean      // shown only after first touch
hoveredIsLink: boolean      // is the color under the cursor a hyperlink?
hoveredColorIndex: int      // palette index of color under cursor (-1 before first show, 0-15 after)
lastTouchTime: number       // timestamp of last touchend, for debouncing mouse events
```

Cursor position is stored as float to accumulate sub-pixel deltas. Floor to integer only when reading pixel data or drawing. Resets to center (80, 50) on page transitions.

The existing `dx` and `dy` letterbox offsets (currently local variables in `redraw()` and `mouseMove()`) must be promoted to module-level variables, updated in `redraw()`, so they are available to the cursor renderer.

## Sprite Data

Two PNG files exist: `pointer.png` (5x8, arrow) and `pointer_hand.png` (8x10, pointing hand). Both use only three colors: transparent, white, and black.

At startup, load both PNGs into Image objects, then read their pixel data into 2D arrays of pixel type: 0 = transparent, 1 = white (fill), 2 = black (outline). These arrays are the source of truth for rendering and recoloring.

Hotspot for the arrow is (0, 0). Hotspot for the hand is (4, 0) -- offset 4 game-pixels to the right.

## Mode Detection

Start in mouse mode. Switch to touch mode on the first `touchstart` event; hide the CSS cursor on the canvas. Switch back to mouse mode if a `mousemove` fires with non-zero `movementX`/`movementY` (indicating a real mouse, not a touch-generated event); hide the virtual cursor and restore CSS cursor behavior.

## Touch Input

All touch events are registered on the main canvas. `preventDefault()` is called on all of them to suppress scrolling and zooming. The canvas CSS `touch-action` should be changed from `manipulation` to `none` to fully suppress pinch-zoom (some browsers, particularly Safari, don't honor `preventDefault()` for pinch gestures without this).

All touch handlers are no-ops when `gameState` is null or `images.length === 0` (matching the existing guard in `mouseMove`).

Only the first touch (the touch identifier from the initial `touchstart`) drives cursor movement. Additional simultaneous touches are ignored.

### touchstart

- Record screen-pixel start position and timestamp (for tap detection)
- If cursor not yet visible, show it at center (80, 50)
- Enter touch mode if not already in it

### touchmove

- Calculate finger delta in screen pixels since the previous touch event
- Convert to game-pixel delta: divide by current `zoom` factor
- Multiply by `POINTER_SPEED`
- Add to cursorX/cursorY
- Clamp to 0.0-159.0 / 0.0-99.0 (float). Floor to integer only for pixel lookup.
- Update hoveredColorIndex and hoveredIsLink from the game data at floor(cursorX), floor(cursorY)
- Call redraw()

### touchend

- If total finger movement < TAP_THRESHOLD and elapsed time < TAP_TIME_THRESHOLD, treat as a tap
- On tap: if hoveredIsLink, trigger the same page transition logic as mouseDown (animate if enabled, update currentIndex, reset cursor to center)
- Taps are ignored while a transition animation is playing

## Mouse Input

No changes to existing mouseMove/mouseDown handlers. The only addition is a check in mousemove: if `event.movementX !== 0 || event.movementY !== 0`, AND more than 500ms have elapsed since the last `touchend` (using `lastTouchTime`), switch back to mouse mode (set touchMode = false, cursorVisible = false, restore CSS cursor). The debounce window prevents synthetic mouse events generated from touch from triggering a false mode switch.

## Cursor Rendering

Drawing happens at the end of `redraw()`, after the game frame is blitted to the main canvas. Only draws when `touchMode && cursorVisible`.

The cursor is drawn by walking the sprite's 2D pixel-type array and issuing `fillRect` calls directly on the main canvas context. Each sprite pixel becomes a `zoom`-sized filled rectangle.

### Arrow (not hovering a link)

- White pixels (type 1) -> fillStyle white
- Black pixels (type 2) -> fillStyle black
- Drawn at `(cursorX * zoom + dx, cursorY * zoom + dy)` where dx/dy are the letterbox offsets

### Hand (hovering a link)

- White pixels (type 1) -> fillStyle set to the hovered palette color
- Black pixels (type 2) -> fillStyle black, UNLESS the hovered color's luminance is below DARK_LUMINANCE, then fillStyle white
- Drawn at `((cursorX - 4) * zoom + dx, cursorY * zoom + dy)` to account for the hand's hotspot offset

### Luminance calculation

Standard perceived brightness: `L = (0.299*R + 0.587*G + 0.114*B) / 255`. If L < DARK_LUMINANCE (0.3), the outline inverts from black to white.

## Files Changed

- `play.html` -- all changes are here. Touch event handlers, cursor state, sprite loading, cursor drawing in redraw().

## What Stays the Same

- All mouse interaction is unchanged
- Game rendering, transitions, animations are unchanged
- No changes to the editor, flickgame_base.js, or flickgame_vanilla.js
- No new external dependencies
