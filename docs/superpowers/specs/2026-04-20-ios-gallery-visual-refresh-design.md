# iOS Gallery Visual Refresh — Design Spec

## Problem

The iOS gallery (from the 2026-04-17 gallery-first redesign) is functional but visually crude. On an iPhone the single-column layout makes each card enormous, the thumbnail is `object-fit:cover` and crops non-16:10 games, the destructive `Delete` button sits in the flat action row between `Edit` and `Share`, and every card looks the same regardless of the flickgame it represents. The player already knows how to theme its UI from each game's `background_color`; the gallery should do the same.

## Scope

This spec covers visual changes to `gallery.html` and `gallery_page.js`. The underlying architecture, routes, import/share/delete semantics, and persistence layer from the 2026-04-17 gallery-first spec are unchanged.

Because `gallery.html` is today reached only from the iOS shell, the visual refresh is effectively iOS-only in practice. The CSS does not branch on host — if a desktop browser ever opens `gallery.html` directly, the refresh applies there too.

## Design Summary

Each project card becomes a small window into its flickgame:

- Card background = the game's `background_color`.
- Thumbnail sits inside a 16:10 cell whose background is also the game's `background_color`, so non-16:10 canvases appear to float in one continuous pool of color.
- A thin border hugs the actual canvas (not the cell), so the art always has a clean outline regardless of aspect ratio.
- Title, modified-time, card border, thumb border, and icon-button borders are all derived from a single ink color per card (`--ink`), which is strictly `#000` or `#fff` — picked via luminance (same logic as `getContrastingStroke` in `play.html`).
- A play triangle is overlaid on the thumbnail at render time; it also uses `--ink`.
- Delete moves out of the action row and becomes a red `×` in the thumbnail's top-right corner, sitting in a small translucent dark pill so it is legible on any tint.
- `Edit` and `Share` become two square icon buttons filling the card's bottom row: Bootstrap Icons `pencil` and `box-arrow-up-right`, both inline SVGs using `fill="currentColor"`.
- The grid is 2 columns on mobile widths, widening to `auto-fill, minmax(210px, 1fr)` on larger viewports.

The page header, the `+` New tile, and the `Import` button stay the neutral dark treatment — there is no single game to tint them from.

## Card Anatomy

```
+---------------------------------+   <-- .gallery-card, bg = --bg, 1px border ink@22%
|  +---------------------+  [×]   |       .gc-x in top-right of thumb wrapper
|  |   16:10 cell        |        |
|  |  +---------------+  |        |       cell bg = --bg
|  |  |  canvas ▶     |  |        |       .gallery-canvas: max-width/max-height 100%,
|  |  |  (play tri)   |  |        |         1px border ink@40%, image-rendering pixelated
|  |  +---------------+  |        |
|  +---------------------+        |
|                                 |
|  title                          |       color: var(--ink)
|  Modified: ...                  |       color: var(--ink), opacity 0.65
|                                 |
|  [ ✎ pencil ] [ ↗ share ]       |       two square icon buttons,
|                                 |         aspect-ratio 1/1, border ink@30%,
+---------------------------------+         fill="currentColor"
```

## CSS Variables Per Card

```css
.gallery-card {
  --bg: <project.state.background_color>;
  --ink: #000 | #fff;   /* computed once per card via luminance */
  background: var(--bg);
  color: var(--ink);
  border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
}
```

`--ink` is computed in JS at card render time using the existing luminance rule:

```
lum = (0.299*r + 0.587*g + 0.114*b) / 255
ink = lum < DARK_LUMINANCE ? '#fff' : '#000'
```

(Reuse `DARK_LUMINANCE` from `play.html` if we move it to a shared helper; otherwise hard-code the 0.5 threshold locally in `gallery_page.js`. A small helper `contrastingInk(hex)` in `gallery_page.js` is sufficient — no refactor needed.)

## Grid & Sizing

```css
.gallery-grid {
  grid-template-columns: 1fr 1fr;        /* mobile default = 2 columns */
  gap: 10px;
}

@media (min-width: 500px) {
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  }
}
```

The mobile branch deliberately forces exactly 2 columns regardless of exact viewport width — iPhone SE through iPhone Pro Max all get the same tight, useful grid.

## Thumbnail Behavior

- Thumbnail cell: `aspect-ratio: 16/10; display:flex; align-items:center; justify-content:center; background: var(--bg); overflow:hidden;`
- Canvas (`<img>` element produced by `renderPreviewFromState`): `max-width:100%; max-height:100%; display:block; image-rendering:pixelated; border: 1px solid color-mix(in srgb, var(--ink) 40%, transparent);`
- Because the image carries its natural width/height attributes from the rendered preview canvas, `max-width`/`max-height` let it self-size to its own aspect ratio inside the cell — the border follows the canvas, not the cell.

## Play Triangle Overlay

Rendered as a small inline SVG placed absolutely over the thumbnail:

```html
<span class="gallery-play"><svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg></span>
```

```css
.gallery-play { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; color: var(--ink); opacity: 0.85; }
.gallery-play svg { width:38px; height:38px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4)); }
```

`pointer-events:none` so the thumbnail tap still routes through to the play navigation.

## Delete as Red ×

Replaces the `Delete` text button. Sits in the top-right corner of the thumb wrapper:

```css
.gallery-x { position:absolute; top:5px; right:5px; width:24px; height:24px; border-radius:50%; background: rgba(0,0,0,0.55); color:#ff5c5c; border:none; font-size:15px; font-weight:700; line-height:1; display:flex; align-items:center; justify-content:center; }
```

The red override is intentional: delete is a semantic signal that should not be recolored per card. The translucent dark pill keeps it legible on light tints (yellow, pink, white). Confirmation dialog semantics stay identical to today.

Click-handler must `stopPropagation` to prevent the thumb's play-navigation handler firing.

## Edit & Share as Icon Buttons

```html
<div class="gallery-actions">
  <button class="gallery-ibtn" aria-label="Edit"><!-- Bootstrap pencil --></button>
  <button class="gallery-ibtn" aria-label="Share"><!-- Bootstrap box-arrow-up-right --></button>
</div>
```

```css
.gallery-actions { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:7px; }
.gallery-ibtn { aspect-ratio:1/1; border-radius:8px; border:1px solid color-mix(in srgb, var(--ink) 30%, transparent); background:transparent; color: inherit; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.gallery-ibtn svg { width:20px; height:20px; fill: currentColor; }
.gallery-ibtn[disabled] { opacity: 0.45; cursor: default; }
```

Inline SVG path data lifted verbatim from Bootstrap Icons 1.11:

- **pencil**: `M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325`
- **box-arrow-up-right**: two paths, as on the Bootstrap Icons page.

Both keep `viewBox="0 0 16 16"` and use `fill="currentColor"` so they follow `--ink`.

Busy state (while share / delete are in flight) disables both icon buttons plus the `×`, mirroring today's `btn.disabled = isBusy(project.id)` pattern.

## Neutral Tiles

The `+` New tile and page chrome stay dark:

```css
.gallery-card.gallery-tile { background:#0a0a0a; color:#888; border: 1px dashed #444; }
.gallery-page-header, .gallery-page-body { background: var(--bg /* = #000 */ ); }
```

The header and the Import button continue to use the existing `--muted-foreground` border and panel colors.

## Files

### Modified

- `gallery.html`
  - Rewrite the embedded `<style>` block to implement the design above (grid, card, thumb, play overlay, ×, icon buttons, mobile 2-col / wide auto-fill).
  - Drop the old `.gallery-thumb` / `.gallery-title` / `.gallery-time` / `.gallery-actions` rules that no longer apply, and the old `.gallery-btn` styling for Edit/Share/Delete (keep `.gallery-btn` only for the Import / share-sheet contexts that still use text buttons).
- `gallery_page.js`
  - Add a small `contrastingInk(hex)` helper.
  - Pull `background_color` from each project's parsed state (already parsed in `renderPreviewFromState`) — expose it alongside the preview data URL so each card can set `--bg` and `--ink`.
  - In `renderProjectCard`: set CSS vars on the card, wrap the thumbnail in a positioned div, append the play-overlay span and the `×` button to that wrapper, and render Edit / Share as icon buttons with the Bootstrap SVGs.
  - Move the Delete handler to the `×` button and keep its `stopPropagation` so it does not trigger thumb play-navigation.

### Unchanged

- `gallery_store.js`, the IndexedDB schema, share/import/export plumbing, `flickgame_share.js`, `ios_editor_menu.js`, and all Swift shell code are untouched.

## Edge Cases

- **Game has no `background_color`** (legacy state, malformed, or thumb cache miss): fall back to `#000` for `--bg` and `#fff` for `--ink`. Render a neutral-looking card that still shows the thumb.
- **`background_color` equals page background (`#000`)**: card borders and the card's ink@22% border keep the card distinguishable from the page.
- **Pure white `background_color`**: `--ink` is `#000`; the red × still sits in the translucent dark pill so it reads as red, not as a black blob.
- **Non-16:10 canvas**: the canvas self-sizes inside the 16:10 cell via `max-width`/`max-height` on the `<img>`; border hugs the art.
- **Very wide desktop viewport**: grid expands via `repeat(auto-fill, minmax(210px, 1fr))`; tinted cards still work, just smaller.

## Out of Scope

- Any change to the editor, the burger menu, the player, the palette, or the Swift shell.
- Desktop overlay-gallery redesign (this spec only touches `gallery.html`).
- Animation / transitions on hover / tap (no new motion rules).
- Share sheet visual redesign — it still uses the existing text-button modal.
- Making the `×` icon itself an SVG (keep the `×` glyph).

## Testing

1. Launch on iPhone; the grid is exactly 2 columns at all iPhone widths.
2. A card with a light `background_color` shows black text / black play triangle / black icon glyphs / black borders; red × still reads as red.
3. A card with a dark `background_color` shows white equivalents.
4. A card with a non-16:10 canvas (e.g. 100×100 or 80×120) shows the canvas border hugging the art, letterboxed by the card's tint — not by black.
5. The red × deletes the project with the existing confirmation and does not also fire the thumb play-navigation.
6. Tapping the pencil navigates to the editor; tapping the share icon opens the share sheet.
7. Legacy projects without `background_color` render on a neutral dark card with a white-ink chrome.
8. At desktop widths (≥500px viewport) the grid becomes a multi-column auto-fill layout; tinted cards still hold up.
