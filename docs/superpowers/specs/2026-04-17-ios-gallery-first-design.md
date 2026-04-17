# iOS Gallery-First Flow — Design Spec

## Problem

The iOS Flickgame app currently mirrors the browser version: it boots into the editor and hides everything else inside the burger menu. On a phone this is backwards. The natural home is a gallery of the user's games, with the editor and player as sub-views entered from there.

We want to flip iOS to gallery-first while keeping the browser version unchanged and keeping a single shared codebase.

## Architecture

Add a new top-level page `gallery.html` alongside `index.html` (editor) and `play.html` (player). The iOS shell loads `gallery.html` as its entry point. Browsers continue to load `index.html`.

Project state lives in IndexedDB (`FlickGalleryStore`) and is addressed by project ID. The URL is the navigation contract; IndexedDB is the source of truth.

Canonical routes:

| Hop | URL |
| --- | --- |
| Gallery -> Existing project in editor | `index.html?id=<projectId>` |
| Gallery -> New project bootstrap | `index.html?new=1` |
| Gallery -> Player | `play.html?id=<projectId>` |
| Editor -> Gallery | `gallery.html` |

The existing `?p=<gistId>` Gist-share path and standalone-export `embeddedDat` path remain unchanged. The new `id` and `new` params are local-only and non-overlapping.

Host detection continues to use `window.FLICKGAME_IOS_APP` / `window.FLICKGAME_HOST === 'ios-app'` injected by the Swift shell at document start.

## Boot rules

### Editor boot (`index.html`)

- If `?id=<projectId>` is present, load that exact project from IndexedDB into the editor and bind that same ID as the active iOS project identity for future Save / dirty tracking.
- If `?new=1` is present, start a blank flickgame, create a fresh IndexedDB project from that blank state, bind it active, then `history.replaceState(...)` to the canonical `index.html?id=<newId>` URL.
- If neither param is present, keep today's behavior for the browser. On iOS this path is only a defensive fallback.

The important constraint is that explicit `?id=` loads must bind the exact project record, and `?new=1` must create a fresh record directly rather than matching by state.

### Player boot (`play.html`)

`play.html` gains a small inline IndexedDB loader for `?id=<projectId>`, using the same IndexedDB database and store names as `gallery_store.js`, but without adding external `<script src>` dependencies. This preserves standalone-export behavior.

Precedence in `play.html` remains:

1. `embeddedDat`
2. `?id=<projectId>`
3. `?p=<gistId>`

## Files

### New

- `gallery.html` — top-level gallery page.
- `gallery_page.js` — controller for `gallery.html`.
- `ios_editor_menu.js` — new iOS-only editor burger.
- `flickgame_share.js` — shared standalone-export, share-link, and import-parsing helpers used by both the editor and gallery.

### Modified

- `gallery_ui.js` — keep editor/gallery-store integration helpers, expose editor-facing helpers needed for exact-project load and fresh-project creation, and remove the old embedded iOS gallery menu path.
- `index.html` — add `?id=` / `?new=1` editor bootstrap logic, use `flickgame_share.js` for export/share/import plumbing, replace `ios_burger_menu.js` with `ios_editor_menu.js`.
- `play.html` — add inline IndexedDB ingestion for `?id=<projectId>`.
- `ios/FlickgameShell/FlickgameShell/FlickWebView.swift` — load `gallery.html` on launch and enable swipe-back.
- `ios/flickgame-web-manifest.txt` — add new files and remove `ios_burger_menu.js`.

### Unchanged in principle

`gallery_store.js`, `flickgame_vanilla.js`, palette data, the drawing surface, and the browser-side editor UX all stay conceptually the same.

## Gallery Page (`gallery.html`)

### Header

A slim title bar reading "Flickgames". No action buttons.

### Tile grid

Rendered top-left to bottom-right:

1. `+` New tile -> navigates to `index.html?new=1`.
2. Import tile -> opens a hidden file input and imports using the same standalone-file parsing rules as the editor.
3. Saved project cards, most-recently-updated first.

### Import format

The import path should accept the format the app already exports today:

- Standalone exported `.html` files containing embedded state.
- Raw state JSON may optionally be accepted as a convenience, but standalone HTML is the primary supported format.

On successful import, create a new project with a unique resolved title and navigate to `index.html?id=<newId>`.

### Card anatomy

Each saved project card contains:

- Thumbnail — tap navigates to `play.html?id=<projectId>`.
- Title line.
- Modified timestamp.
- Action row: `Edit` · `Share` · `Delete`.

Action-row taps must not bubble to the thumbnail play handler.

### Empty state

Only the `+` and Import tiles are shown. No prose.

### Share action sheet

An in-page modal overlay with:

- `Share Link` — upload the project's state through the existing Gist flow; on success call `navigator.share({ url })`; if sharing is unavailable or cancelled after upload, offer clipboard copy.
- `Save HTML to Files` — generate the existing standalone HTML export and hand it off through `FileSaver.js`.
- `Cancel` — close the sheet.

### Delete

Confirm dialog. On confirm, delete the project and re-render the grid.

## Editor Burger (`ios_editor_menu.js`)

Desktop/browser burger stays unchanged. The iOS burger is replaced entirely.

### Layout

A two-column label/value grid:

- Name -> text input
- Background -> existing `bgColorSelect` element, reparented into the grid
- Palette -> button labeled with the current palette name; tapping opens the existing palette selector

Then four stacked full-width buttons in order:

1. Save
2. Clear page
3. Help
4. Back to Gallery

### Name input

On blur or Enter:

1. Trim the input.
2. If empty, fall back to `nextDefaultTitle(items)`.
3. Strip one trailing ` <digits>` suffix from the user-entered name.
4. Resolve collisions against all other project titles by appending the smallest ` N` where `N >= 2`.
5. Persist the resolved title and write it back into the input.

### Save

Calls `saveCurrentToGallery({ silent: false })` and closes the burger on success.

### Clear page

Uses the existing single-frame clear path. It clears only the current frame, not the whole flickgame, and asks for confirmation first.

### Help

Navigates to `help.html`.

### Back to Gallery

If the current project is dirty, show a custom three-action confirmation UI:

- `Save` -> save, then navigate to `gallery.html`
- `Discard` -> navigate without saving
- `Cancel` -> stay in the editor

If the project is not dirty, navigate immediately.

## Edge Cases

- Stale deep link: `index.html?id=<missing>` or `play.html?id=<missing>` alerts/toasts "Project not found" and redirects to `gallery.html`.
- New-project bootstrap: `index.html?new=1` always creates a fresh project entry and rewrites the URL to `?id=<newId>`.
- Import failure: malformed files show an error and do not create a project.
- Share failure: keep the share sheet open and surface the error.
- Delete current project from the editor remains unreachable; delete happens from the gallery.

## Out of Scope

- Making the browser app gallery-first.
- Additional gallery-level rename UX.
- Swift-native share-sheet bridging.
- Major visual redesign outside the new gallery page and iOS burger.

## Testing

1. Launch target: iOS opens `gallery.html`; browser still opens `index.html`.
2. Zero state: fresh install shows only `+` and Import.
3. New bootstrap: tapping `+` opens the editor, immediately creates a fresh project, and canonicalizes the URL to `index.html?id=<newId>`.
4. Exact-project edit: opening an existing card in the editor saves back into that same project record.
5. Dirty back flow: verify Save / Discard / Cancel all behave distinctly.
6. Tap-to-play: tapping a card thumbnail opens `play.html?id=<projectId>` and swipe-back returns to the gallery.
7. Rename collision: duplicate names resolve to `<name> 2`, `<name> 3`, etc.
8. Rename strip: `"Space Game 3"` resolves to `"Space Game"` when there is no collision.
9. Share Link: Gist upload succeeds and `navigator.share` receives the final play URL.
10. Save HTML to Files: standalone HTML export still downloads and plays correctly.
11. Import: importing a standalone exported HTML file creates a new project and opens it in the editor.
12. Browser unchanged: desktop editor, overlay gallery, share, import, and download still work as before.
