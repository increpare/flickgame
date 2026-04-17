# iOS Gallery-First Flow — Design Spec

## Problem

The iOS Flickgame app currently mirrors the browser version: it boots into the editor and hides everything else (gallery, import/export, help) inside a burger menu. For phone use this is backwards — on a phone, the natural home is a gallery of the user's games, with the editor and player as sub-views you enter from there.

We want to flip iOS to gallery-first while keeping the browser version unchanged and keeping a single shared codebase.

## Architecture

Add a new top-level page `gallery.html` alongside `index.html` (editor) and `play.html` (player). The iOS shell loads `gallery.html` as its entry point. Browsers continue to load `index.html`. All three pages share the same bundle and the same `FlickGalleryStore` (IndexedDB).

State passing between pages is by **project ID in the URL query**, with the actual state read from IndexedDB:

| Hop                   | URL                             |
| --------------------- | ------------------------------- |
| Gallery → Editor      | `index.html?id=<projectId>`     |
| Gallery → Player      | `play.html?id=<projectId>`      |
| Editor → Gallery      | `gallery.html`                  |

The existing `?p=<gistId>` Gist-share path and the download-standalone-HTML path (`embeddedDat` string replacement in `play.html`) are untouched. The new `id` param is non-overlapping.

Host detection continues to use `window.FLICKGAME_IOS_APP` / `window.FLICKGAME_HOST === 'ios-app'` injected by the Swift shell at document-start; `gallery.html` reads the same flag.

**Browser behaviour is unchanged**: `index.html` still boots into the editor with the existing gallery *overlay* available from the burger. `gallery.html` works if visited directly in a browser but is not surfaced in browser chrome. Future extension if desired.

## Files

### New

- **`gallery.html`** — top-level gallery page. Minimal HTML loading the shared theme CSS, `gallery_store.js`, and the new `gallery_page.js`.
- **`gallery_page.js`** — controller for `gallery.html`. Builds the card grid, handles Play / Edit / Share / Delete, the `+` and Import tiles, and the Share action sheet.
- **`ios_editor_menu.js`** — replaces `ios_burger_menu.js`. Renders the new editor-side burger (Name / Background / Palette grid, then Save, Clear page, Help, Back to Gallery).

### Modified

- **`gallery_ui.js`** — slim down. Keep `FlickGalleryStore` integration helpers (save current, load by id, dirty tracking, `ensureIosActiveProjectEntry`, rename-with-uniqueness). Keep the desktop overlay rendering for browser use. Remove the embedded iOS burger-list rendering (the burger no longer contains the list).
- **`index.html`** — on load, if `?id=<projectId>` is present, load that project from IndexedDB and set it active before normal editor init. Replace the `ios_burger_menu.js` include with `ios_editor_menu.js`. Minor CSS tweaks to move Background and Palette rows into the new burger layout when on iOS.
- **`play.html`** — add IndexedDB ingestion: if `?id=<projectId>` is present, load state from IndexedDB before the existing runtime init. `embeddedDat` and `?p=<gistId>` paths unchanged.
- **`ios/FlickgameShell/FlickgameShell/FlickWebView.swift`** — load `gallery.html` on launch instead of `index.html`. Enable `allowsBackForwardNavigationGestures` so swipe-back works naturally between gallery ↔ editor ↔ player.
- **`ios/flickgame-web-manifest.txt`** — add `gallery.html`, `gallery_page.js`, `ios_editor_menu.js`; remove `ios_burger_menu.js`.

### Unchanged

`gallery_store.js`, `flickgame_base.js`, `flickgame_vanilla.js`, `colorNames.js`, `FileSaver.js`, palette data, the editor's drawing surface, and the browser-side editor UX.

## Gallery page (`gallery.html`)

### Header

A slim title bar reading "Flickgames". No action buttons — Import is a tile (see below); Export is gone (handled per-card via Share → Save HTML to Files).

### Tile grid

Rendered top-left to bottom-right:

1. **`+` New tile** — creates a blank project in IndexedDB using `nextDefaultTitle(items)`, navigates to `index.html?id=<newId>`.
2. **Import… tile** — opens a hidden `<input type="file">`. On file selected, parses as the current export/import format, creates a new project via `putProject({ title, state })`, navigates to the editor for that new project.
3. **Saved project cards**, most-recently-updated first.

### Card anatomy

Each saved project card contains:

- **Thumbnail** — tap anywhere on the thumbnail navigates to `play.html?id=<projectId>`.
- **Title line** (resolved title as stored).
- **Modified timestamp**.
- **Action row**: `Edit` · `Share` · `Delete`.

Taps on the action row must not bubble to the thumbnail's play handler.

### Empty state

Only the `+` and Import tiles are shown. No prose.

### Share action sheet

An in-page modal overlay (not the native iOS sheet), with two primary actions and a cancel row:

- **Share Link** — run the existing Gist upload flow for the project's state; on success call `navigator.share({ url })`; on failure toast the error and offer clipboard copy.
- **Save HTML to Files** — run the existing standalone-HTML export for the project. On iOS, `FileSaver.js`'s download triggers WKWebView's default file-download handling, which surfaces the iOS Save-to-Files UI.
- **Cancel** — close the sheet.

### Delete

Confirm dialog. On confirm, `FlickGalleryStore.deleteProject(id)` then re-render the grid.

## Editor burger (iOS only — `ios_editor_menu.js`)

Replaces today's iOS burger contents. Desktop/browser burger is unchanged.

### Layout

A two-column label→value grid:

- **Name** → text input (live-reflects the current project's title)
- **Background** → existing `bgColorSelect` element, reparented into the grid
- **Palette** → button whose label is the current palette name; tapping it opens the existing palette-selector UI. The palette's external credit link is hidden on iOS.

Followed by stacked full-width buttons in this order:

1. **Save**
2. **Clear page**
3. **Help**
4. **◀ Back to Gallery**

No section headings, no wrapper panels.

### Name input (rename algorithm)

On `blur` or Enter:

1. Trim the input. If empty → use `nextDefaultTitle(items)` and return.
2. Strip a trailing ` \d+` from the input (e.g. `"Space Game 3"` → `"Space Game"`).
3. Build the set of titles across all *other* projects (excluding the current one) from `listProjects()`.
4. If the bare name is not in that set → resolved title = bare name.
5. Else find the smallest integer `N ≥ 2` such that `"<base> <N>"` is not in the set → resolved title = `"<base> <N>"`.
6. Persist via `FlickGalleryStore.putProject({ ...current, title: resolved })`.
7. Write the resolved title back into the input so the user sees any applied suffix.

Suffix separator is a single space (e.g. `"Space Game"`, `"Space Game 2"`). Consistent with the intent of human-typed names; distinct from the `#N`-style default `"flickgame #1"` which is only a default and will be stripped-and-renumbered on any subsequent rename collision.

### Save

Calls `saveCurrentToGallery({ silent: false })` (existing function), closes the burger on success.

### Clear page

Fills *only the current frame* with the current background colour (`bgColorSelect.value`), using the existing single-frame clear code path triggered by the toolbar's clear icon. Not `newFlickgame()`.

Shows a confirmation: "Clear this page? This cannot be undone." (Editor undo does still cover it; the confirm is a seatbelt because the action looks irreversible.)

### Help

`window.location.href = 'help.html'`. Same as today.

### Back to Gallery

1. Check dirty via `FlickGalleryUI.isDirty()`.
2. If dirty → prompt "Save changes before returning to the gallery?" with Save / Discard / Cancel.
3. On Save (after save resolves) or Discard → `window.location.href = 'gallery.html'`. On Cancel → stay in the editor.
4. If not dirty → navigate immediately.

## Swift shell changes (`FlickWebView.swift`)

```swift
if let url = Bundle.main.url(forResource: "gallery", withExtension: "html", subdirectory: "www") {
    let dir = url.deletingLastPathComponent()
    webView.loadFileURL(url, allowingReadAccessTo: dir)
}
```

And:

```swift
webView.allowsBackForwardNavigationGestures = true
```

No other Swift changes. The existing `FLICKGAME_HOST` user-script is `atDocumentStart` and applies to every same-origin navigation, so editor and player pages still see the flag.

## Edge cases

- **Stale deep link** (`index.html?id=<missing>`): editor toasts "Project not found" and redirects to `gallery.html`.
- **Rapid taps** on a card while transitioning: card-level busy flag gates Edit / Share / Delete.
- **Gist upload failure** in Share Link: toast the error, leave the sheet open.
- **Malformed Import file**: toast the error, do not create a project.
- **Back-gesture** from player: WKWebView history handles it; no custom code needed.
- **Delete the project currently being edited** is no longer reachable from the editor — you delete from the gallery, and by then the editor is not mounted.

## Out of scope

- A default/template project on first launch (noted as a future concern).
- Browser adopting `gallery.html` as its home.
- Additional landscape polish for the gallery or player chrome beyond what existing CSS covers.
- Gallery-level rename (rename happens in the editor name input; gallery-level rename can be added later if wanted).
- A Swift-side `UIActivityViewController` bridge. `navigator.share({ url })` is sufficient.

## Testing

Build with `make sync-ios` (or equivalent) and run in Xcode.

1. **Launch target**: iOS opens to `gallery.html`; browser opens to `index.html`.
2. **Zero state**: fresh install shows only `+` and Import tiles; `+` navigates to the editor with a blank project.
3. **Tap-to-play**: tapping a thumbnail navigates to `play.html?id=`; swipe-back returns to the gallery.
4. **Edit round-trip**: Edit → modify → burger Save → Back to Gallery → card shows fresh thumbnail and updated timestamp.
5. **Dirty Back-to-Gallery**: modify → Back to Gallery → prompt appears; verify Save / Discard / Cancel branches.
6. **Rename collision**: two projects exist; rename the second to the first's name → resolves to `"<name> 2"`.
7. **Rename strip**: rename an existing project to `"Space Game 3"` with no collision → resolves to `"Space Game"`.
8. **Delete from gallery**: card disappears; remaining cards render; `+` tile remains.
9. **Share Link**: Share → Share Link → Gist URL reaches the iOS share sheet via `navigator.share`.
10. **Save HTML to Files**: Share → Save HTML to Files → iOS Save-to-Files surfaces the standalone HTML.
11. **Import**: Import tile → pick a valid export file → new project appears in the gallery and opens in the editor.
12. **Browser unchanged**: load `index.html` in a desktop browser → existing editor + overlay work as today.
