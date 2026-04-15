// Gallery UI overlay for saving/loading multiple Flickgame projects.
(function () {
  'use strict';

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      children.forEach(function (c) {
        if (c == null) return;
        if (typeof c === 'string') n.appendChild(document.createTextNode(c));
        else n.appendChild(c);
      });
    }
    return n;
  }

  function stop(e) { if (e) { e.preventDefault(); e.stopPropagation(); } }

  function safeAlert(msg) {
    try { alert(msg); } catch (e) {}
  }

  function getThumbDataUrl() {
    try {
      // Use page 1 thumbnail if available (small, fast)
      if (typeof thumbnailCanvas !== 'undefined' && thumbnailCanvas && thumbnailCanvas[0]) {
        return thumbnailCanvas[0].toDataURL('image/png');
      }
    } catch (e) {}
    return '';
  }

  function currentStateString() {
    if (typeof stateToString !== 'function') throw new Error('stateToString not available');
    return stateToString();
  }

  function loadProjectStateString(stateStr) {
    if (typeof stringToState !== 'function') throw new Error('stringToState not available');
    stringToState(stateStr);
    if (typeof setVisuals === 'function') setVisuals(true);
    if (typeof setLayer === 'function' && typeof canvasIndex !== 'undefined') setLayer(canvasIndex + 1);
    if (typeof setDropdowns === 'function') setDropdowns();
    if (typeof saveFlickgameState === 'function') saveFlickgameState();
    if (typeof closeBurgerDialog === 'function') closeBurgerDialog();
  }

  var overlay = null;
  var listContainer = null;
  var headerTitle = null;

  function ensureStyles() {
    if (document.getElementById('gallery-overlay-styles')) return;
    var css = [
      '.gallery-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:none;align-items:center;justify-content:center;padding:16px;}',
      '.gallery-overlay.visible{display:flex;}',
      '.gallery-panel{width:min(900px,100%);max-height:min(720px,100%);background:#111;border:2px solid var(--muted-foreground);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;}',
      '.gallery-header{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 12px;border-bottom:2px solid var(--muted-foreground);}',
      '.gallery-header h2{margin:0;font-size:18px;font-weight:600;}',
      '.gallery-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}',
      '.gallery-btn{background:#222;color:#fff;border:2px solid var(--muted-foreground);border-radius:8px;padding:8px 10px;font-size:14px;cursor:pointer;}',
      '.gallery-btn:active{transform:translateY(1px);}',
      '.gallery-body{padding:12px;overflow:auto;}',
      '.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;}',
      '.gallery-card{background:#0b0b0b;border:2px solid var(--muted-foreground);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;}',
      '.gallery-thumb{width:100%;aspect-ratio:16/10;background:#000;border-radius:8px;border:1px solid #333;image-rendering:pixelated;object-fit:cover;}',
      '.gallery-meta{display:flex;flex-direction:column;gap:2px;}',
      '.gallery-title{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.gallery-time{font-size:12px;color:var(--muted-foreground);}',
      '.gallery-card-actions{display:flex;gap:6px;flex-wrap:wrap;}',
      '.gallery-empty{color:var(--muted-foreground);text-align:center;padding:32px 8px;}'
    ].join('\n');
    var st = el('style', { id: 'gallery-overlay-styles', text: css });
    document.head.appendChild(st);
  }

  function formatTime(ms) {
    try {
      return new Date(ms).toLocaleString();
    } catch (e) {
      return '' + ms;
    }
  }

  function ensureOverlay() {
    if (overlay) return;
    ensureStyles();

    headerTitle = el('h2', { text: 'Gallery' });

    var btnClose = el('button', { class: 'gallery-btn', text: 'Close' });
    btnClose.addEventListener('click', function () { closeGallery(); });

    var btnNew = el('button', { class: 'gallery-btn', text: 'New' });
    btnNew.addEventListener('click', function () {
      if (typeof confirmNewFlickgame === 'function') confirmNewFlickgame();
      closeGallery();
    });

    var btnSave = el('button', { class: 'gallery-btn', text: 'Save current to Gallery' });
    btnSave.addEventListener('click', function () { saveCurrentToGallery(); });

    var actions = el('div', { class: 'gallery-actions' }, [btnNew, btnSave, btnClose]);

    var header = el('div', { class: 'gallery-header' }, [headerTitle, actions]);
    listContainer = el('div', { class: 'gallery-body' });
    var panel = el('div', { class: 'gallery-panel' }, [header, listContainer]);

    overlay = el('div', { class: 'gallery-overlay', id: 'gallery-overlay' }, [panel]);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeGallery();
    });

    document.body.appendChild(overlay);
  }

  function setBusy(busy) {
    if (!headerTitle) return;
    headerTitle.textContent = busy ? 'Gallery (loading...)' : 'Gallery';
  }

  function renderList(items) {
    listContainer.innerHTML = '';
    if (!items || items.length === 0) {
      listContainer.appendChild(el('div', { class: 'gallery-empty', text: 'No saved Flickgames yet. Tap “Save current to Gallery” to create one.' }));
      return;
    }
    var grid = el('div', { class: 'gallery-grid' });
    items.forEach(function (p) {
      var img = el('img', { class: 'gallery-thumb', alt: 'thumbnail' });
      if (p.thumb) img.src = p.thumb;

      var title = el('div', { class: 'gallery-title', text: p.title || 'Untitled' });
      var time = el('div', { class: 'gallery-time', text: 'Modified: ' + formatTime(p.updatedAt || p.createdAt || 0) });
      var meta = el('div', { class: 'gallery-meta' }, [title, time]);

      var btnOpen = el('button', { class: 'gallery-btn', text: 'Open' });
      btnOpen.addEventListener('click', function (e) {
        stop(e);
        setBusy(true);
        window.FlickGalleryStore.getProject(p.id).then(function (full) {
          if (!full || !full.state) throw new Error('Missing project data');
          loadProjectStateString(full.state);
          closeGallery();
        }).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to open project');
        }).finally(function () { setBusy(false); });
      });

      var btnRename = el('button', { class: 'gallery-btn', text: 'Rename' });
      btnRename.addEventListener('click', function (e) {
        stop(e);
        var t = prompt('Rename project:', p.title || 'Untitled');
        if (t == null) return;
        setBusy(true);
        window.FlickGalleryStore.putProject({
          id: p.id,
          title: (t || '').trim() || 'Untitled',
          createdAt: p.createdAt,
          state: p.state, // might be absent in list view; refresh below if so
          thumb: p.thumb || ''
        }).then(refresh).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to rename');
        }).finally(function () { setBusy(false); });
      });

      var btnDup = el('button', { class: 'gallery-btn', text: 'Duplicate' });
      btnDup.addEventListener('click', function (e) {
        stop(e);
        setBusy(true);
        window.FlickGalleryStore.getProject(p.id).then(function (full) {
          if (!full || !full.state) throw new Error('Missing project data');
          return window.FlickGalleryStore.putProject({
            title: (full.title || 'Untitled') + ' (copy)',
            state: full.state,
            thumb: full.thumb || ''
          });
        }).then(refresh).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to duplicate');
        }).finally(function () { setBusy(false); });
      });

      var btnDel = el('button', { class: 'gallery-btn', text: 'Delete' });
      btnDel.addEventListener('click', function (e) {
        stop(e);
        if (!confirm('Delete this saved Flickgame?')) return;
        setBusy(true);
        window.FlickGalleryStore.deleteProject(p.id).then(refresh).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to delete');
        }).finally(function () { setBusy(false); });
      });

      var actions = el('div', { class: 'gallery-card-actions' }, [btnOpen, btnRename, btnDup, btnDel]);
      var card = el('div', { class: 'gallery-card' }, [img, meta, actions]);
      grid.appendChild(card);
    });
    listContainer.appendChild(grid);
  }

  function refresh() {
    return window.FlickGalleryStore.listProjects().then(function (items) {
      renderList(items);
      return items;
    });
  }

  function openGallery() {
    ensureOverlay();
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    setBusy(true);
    refresh().catch(function (err) {
      safeAlert(err && err.message ? err.message : 'Failed to load gallery');
    }).finally(function () { setBusy(false); });
  }

  function closeGallery() {
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function saveCurrentToGallery(opts) {
    opts = opts || {};
    try { if (typeof closeBurgerDialog === 'function') closeBurgerDialog(); } catch (e) {}
    var defaultTitle = opts.defaultTitle || 'Untitled';
    var title = opts.title;
    if (!title) {
      title = prompt('Title for this saved Flickgame:', defaultTitle);
      if (title == null) return Promise.resolve(false);
    }
    var stateStr;
    try { stateStr = currentStateString(); } catch (e) { safeAlert(e.message || 'Failed to read state'); return Promise.resolve(false); }
    var thumb = getThumbDataUrl();
    setBusy(true);
    return window.FlickGalleryStore.putProject({
      title: (title || '').trim() || 'Untitled',
      state: stateStr,
      thumb: thumb
    }).then(function () {
      return window.FlickGalleryStore.listProjects().then(function (items) {
        if (overlay && overlay.classList.contains('visible')) {
          renderList(items);
        }
        if (!items || items.length === 0) {
          safeAlert('Saved, but Gallery is still empty. This usually means storage is unavailable for this webview.');
          return false;
        }
        safeAlert('Saved to Gallery.');
        return true;
      });
    }).catch(function (err) {
      safeAlert(err && err.message ? err.message : 'Failed to save');
      return false;
    }).finally(function () { setBusy(false); });
  }

  function maybePromptToMigrateDraft() {
    // One-time prompt: if autosave exists and gallery empty, offer to save it into gallery.
    try {
      var flagKey = 'flickgame_gallery_migration_prompted_v1';
      if (typeof localStorage === 'undefined') return;
      if (localStorage.getItem(flagKey) === '1') return;
      localStorage.setItem(flagKey, '1');
      if (typeof loadFlickgameState !== 'function') return;
      var draft = loadFlickgameState();
      if (!draft) return;
      if (!window.FlickGalleryStore || typeof window.FlickGalleryStore.isEmpty !== 'function') return;
      window.FlickGalleryStore.isEmpty().then(function (empty) {
        if (!empty) return;
        var ok = confirm('Add your current draft to the Gallery so you can keep multiple Flickgames?');
        if (!ok) return;
        // Save current state (which should already reflect the draft at this point).
        saveCurrentToGallery({ title: 'Draft' });
      }).catch(function () {});
    } catch (e) {}
  }

  // Expose to existing inline HTML onclicks
  window.openGallery = openGallery;
  window.closeGallery = closeGallery;
  window.saveCurrentToGallery = saveCurrentToGallery;
  window._maybePromptToMigrateDraft = maybePromptToMigrateDraft;

  // Kick migration prompt after load settles.
  window.addEventListener('load', function () {
    setTimeout(maybePromptToMigrateDraft, 250);
  });
})();
