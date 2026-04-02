# Unified Color Picker for Flickgame Editor

## Problem

The editor has two separate UI rows for color management: a row of 16 color swatches (for selecting the paint color) and a row of 16 `<select>` dropdowns (for assigning hyperlinks to colors). This wastes vertical space, splits a related concept across two UI elements, and the tiny dropdowns are hard to use on touchscreens.

## Solution

Replace both rows with a single row of color swatches. Each swatch shows its hyperlink target page number overlaid directly on the color. Tapping an unselected swatch selects it for painting. Tapping an already-selected swatch opens a floating page picker popup with thumbnails.

## Scope

Only `index.html` is affected. `index_big.html` is a parallel copy of the editor and should receive the same changes, but that can be done as a follow-up — it is out of scope for this spec. No changes to play.html, flickgame_base.js, or flickgame_vanilla.js.

## Swatch Row

The 16 swatches remain in a single `<table>` row, same dimensions as today (30×16px each). The dropdown `<tr>` is removed entirely. The palette button `<td>` currently has `rowspan="2"` spanning both rows — this must be changed to `rowspan="1"` (or the attribute removed) when the dropdown row is deleted.

Each swatch that has a hyperlink assigned displays the target page number (1–16) centered on the swatch. The `hyperlinks` array stores 0 for no link and 1–16 for the target page — the stored value is displayed directly.

Text color is auto-chosen for contrast using the existing `color_distance()` function (CIELAB delta-E), consistent with how the editor already computes foreground colors for the palette. Compare distance-from-white vs distance-from-black: if farther from white, use white text; otherwise black. This matches the logic at lines 529–531 and the `--col_fg` CSS variables.

Swatches with no hyperlink (value 0) show no number.

## Swatch Interaction

Each swatch is currently wrapped in an `<a href="#" onclick="setColor(N)">`. This wrapper remains. The `setColor()` function is modified so that when the clicked color is already selected, it toggles the page picker popup instead of no-oping.

- **Tap/click an unselected swatch:** select that color for painting (same as current `setColor()` behavior).
- **Tap/click an already-selected swatch:** open the page picker popup for that color. If the popup is already open for that color, close it.

Self-linking (assigning a page to link to itself) is allowed — same as the current dropdowns. No special visual treatment.

## Page Picker Popup

A floating 4×4 grid of page thumbnails, positioned below the tapped swatch. Contains:

- 16 cells, one per page, each showing:
  - A thumbnail of that page (reusing the existing 16×10 thumbnail canvases)
  - The page number (1–16) below the thumbnail
- A "clear link" row at the bottom spanning the full width
- The currently-assigned target (if any) is highlighted with a border

### Popup Behavior

- **Tap a page cell:** assign that page as the hyperlink target for the selected color on the current canvas (`hyperlinks[canvasIndex][colorIndex] = pageNumber`). Close the popup. Update the swatch overlay number.
- **Tap "clear link":** remove the hyperlink (`hyperlinks[canvasIndex][colorIndex] = 0`). Close the popup. Remove the overlay number from the swatch.
- **Tap outside the popup:** close without changing anything.
- **Opening a new popup:** if a popup is already open, close it before opening the new one.

### Popup Positioning

The popup is absolutely positioned relative to the swatch row container. It appears directly below the selected swatch. If the popup would overflow the right edge of the viewport, shift it left to stay on screen. Bottom overflow is not handled — the popup is small enough (~150px tall) that it will fit below the swatch row in any reasonable window.

### Popup Styling

```
Background: #2a2a3e (dark, matches editor theme)
Border: 2px solid #777
Border-radius: 5px
Padding: 8px
Box-shadow: 0 6px 20px rgba(0,0,0,0.6)
Grid: 4 columns, 6px gap
Thumbnail size: ~48×30px (scaled up from the 16×10 canvas)
Page number: 10px font, #aaa color
Current target highlight: white border on the cell
Clear link row: border-top separator, red-ish text (#f88)
```

## Thumbnail Reuse

The editor already maintains 16 thumbnail canvases (`thumbnail1` through `thumbnail16`, each 16×10 pixels) updated by `drawThumbnail(n)`. The page picker popup renders these same canvases into its cells using `drawImage` to scale them up. No new thumbnail generation logic is needed.

## Overlay Number Rendering

The page numbers on swatches are rendered as DOM text (a `<span>` inside each swatch div), not canvas-drawn. This keeps the implementation simple and leverages CSS for contrast coloring.

Each swatch div gets a child `<span class="link-label">` that is:
- Absolutely positioned, centered in the swatch
- Font: 9px bold, no text-shadow
- Color: computed using `color_distance()` (same as existing foreground color logic)
- Content: the target page number, or empty string if no link

Updated whenever:
- `updateSwatchLabels()` is called (from `setDropdowns()`, palette switch, or after the page picker assigns/clears a link)

## State Changes

The existing `hyperlinks[canvasIndex][colorIndex]` array is the single source of truth — no new state variables. The popup reads from it to highlight the current target, and writes to it when the user picks a page.

## Functions Changed

- **`setColor(newColorIndex)`**: Add logic: if `newColorIndex === colorIndex` (already selected), toggle the page picker popup instead of re-selecting.
- **`setDropdowns()`**: Replace the dropdown value updates with a call to `updateSwatchLabels()`. Keep the background color dropdown update.
- **`dropDownSelect(dropdown, val)`**: Removed. The page picker writes directly to `hyperlinks[canvasIndex][colorIndex]` using 0-based color index.
- **`generateDropDowns()`**: Removed (no more `<select>` elements to populate).
- **`init()`**: Remove `generateDropDowns()` call. Add `createPagePicker()` call. Add click-outside listener for dismissing the popup.
- **Palette switch code (lines 524–534)**: Add `updateSwatchLabels()` call after updating `--col` CSS variables, so label text colors update when the palette changes.

## New Functions

- **`createPagePicker()`**: Builds the popup DOM element (called once at init). Returns the popup container element. Appends it to the document.
- **`showPagePicker(colorIdx)`**: Positions and shows the popup below the swatch for `colorIdx`. Highlights current target. Draws thumbnails into the popup cells.
- **`hidePagePicker()`**: Hides the popup.
- **`updateSwatchLabels()`**: Iterates all 16 swatches, sets each overlay span's text to the link target page number (or empty), and sets text color using `color_distance()`. Called from `setDropdowns()` and after palette switches.

## HTML Changes

- Remove the entire `<tr>` containing the 16 `<select>` dropdowns (`col1` through `col16`).
- Change the palette button `<td rowspan="2">` to `<td>` (remove rowspan).
- Add a `<span class="link-label"></span>` inside each swatch div (`color_0` through `color_15`).
- Add a single popup container div (hidden by default) after the swatch table, absolutely positioned.

## CSS Changes

- Add `.link-label` style (absolute positioning, centered, 9px bold font, pointer-events: none).
- Add `.page-picker` style (the popup grid, position: absolute, z-index, hidden by default).
- Add `.page-picker-item` style (each cell in the grid).
- The `div.selected` and `div.unselected` swatch styles remain, with `position: relative` added so the label span can be absolutely positioned inside.

## Keyboard Accessibility

The current `<select>` dropdowns are natively keyboard-accessible. The new page picker popup is not. This is an intentional trade-off for simplicity — the editor is primarily mouse/touch-driven. Keyboard support for the popup can be added later if needed.

## Reusability Note

The page picker popup is designed as a generic "pick a page" component. It can later be reused as the active page selector (replacing the current page list sidebar), or anywhere else a page needs to be chosen.

## What Stays the Same

- All drawing/painting behavior unchanged
- `hyperlinks` array structure unchanged
- File import/export unchanged
- Thumbnail generation unchanged
- No new external dependencies
