// Gallery UI overlay for saving/loading multiple Flickgame projects.
(function () {
  'use strict';

  var IOS_CURRENT_PROJECT_KEY = 'flickgame_ios_current_project_id_v1';
  var currentProjectId = null;
  var currentSavedStateString = null;
  var overlay = null;
  var listContainer = null;
  var headerTitle = null;

  function isIosApp() {
    try {
      return !!(window && (window.FLICKGAME_HOST === 'ios-app' || window.FLICKGAME_IOS_APP));
    } catch (e) {
      return false;
    }
  }

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
      if (typeof canvasses !== 'undefined' && canvasses && canvasses[0] && typeof width === 'number' && typeof height === 'number') {
        var previewCanvas = document.createElement('canvas');
        previewCanvas.width = width;
        previewCanvas.height = height;
        var previewContext = previewCanvas.getContext('2d');
        if (!previewContext) return '';
        var imageData = previewContext.createImageData(width, height);
        var data = imageData.data;
        var source = canvasses[0];
        for (var i = 0; i < source.length; i++) {
          var rgb = hexToRgb((colorPalette && colorPalette[source[i]]) || '#000000') || { r: 0, g: 0, b: 0 };
          var off = i << 2;
          data[off] = rgb.r;
          data[off + 1] = rgb.g;
          data[off + 2] = rgb.b;
          data[off + 3] = 255;
        }
        previewContext.putImageData(imageData, 0, 0);
        return previewCanvas.toDataURL('image/png');
      }
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

  function setCurrentProjectIdentity(id, savedStateString) {
    if (!isIosApp()) return;
    currentProjectId = id || null;
    if (typeof savedStateString === 'string') currentSavedStateString = savedStateString;
    try {
      if (typeof localStorage !== 'undefined') {
        if (currentProjectId) localStorage.setItem(IOS_CURRENT_PROJECT_KEY, currentProjectId);
        else localStorage.removeItem(IOS_CURRENT_PROJECT_KEY);
      }
    } catch (e) {}
  }

  function loadCurrentProjectIdentityFromStorage() {
    if (!isIosApp()) return;
    if (currentProjectId) return;
    try {
      if (typeof localStorage === 'undefined') return;
      var id = localStorage.getItem(IOS_CURRENT_PROJECT_KEY);
      if (id) currentProjectId = id;
    } catch (e) {}
  }

  function isDirtyAgainstSavedSnapshot() {
    if (!isIosApp()) return !isProjectBlankSafe();
    if (!currentProjectId) return true;
    if (typeof currentSavedStateString !== 'string') return true;
    try {
      return currentStateString() !== currentSavedStateString;
    } catch (e) {
      return true;
    }
  }

  function isProjectBlankSafe() {
    try {
      if (typeof isProjectBlank === 'function') return !!isProjectBlank();
    } catch (e) {}
    return false;
  }

  function loadProjectStateString(stateStr) {
    if (typeof stringToState !== 'function') throw new Error('stringToState not available');
    stringToState(stateStr);
    if (typeof setVisuals === 'function') setVisuals(true);
    if (typeof setLayer === 'function' && typeof canvasIndex !== 'undefined') setLayer(canvasIndex + 1);
    if (typeof setDropdowns === 'function') setDropdowns();
    if (typeof saveFlickgameState === 'function') saveFlickgameState();
  }

  function formatTime(ms) {
    try {
      return new Date(ms).toLocaleString();
    } catch (e) {
      return '' + ms;
    }
  }

  function nextDefaultTitle(items) {
    var used = {};
    (items || []).forEach(function (p) {
      var m = /^flickgame #(\d+)$/i.exec((p && p.title) || '');
      if (m) used[parseInt(m[1], 10)] = true;
    });
    var i = 1;
    while (used[i]) i += 1;
    return 'flickgame #' + i;
  }

  function resolveUniqueTitle(rawInput, items, currentId) {
    var trimmed = (rawInput || '').trim();
    if (trimmed.length === 0) return nextDefaultTitle(items);
    var base = trimmed.replace(/\s+\d+$/, '').trim();
    if (base.length === 0) return nextDefaultTitle(items);
    var usedTitles = {};
    (items || []).forEach(function (p) {
      if (!p || p.id === currentId) return;
      if (typeof p.title === 'string') usedTitles[p.title] = true;
    });
    if (!usedTitles[base]) return base;
    var n = 2;
    while (usedTitles[base + ' ' + n]) n += 1;
    return base + ' ' + n;
  }

  function saveToExistingProject(project, opts) {
    opts = opts || {};
    var stateStr;
    try {
      stateStr = currentStateString();
    } catch (e) {
      safeAlert(e.message || 'Failed to read state');
      return Promise.resolve(false);
    }
    var payload = {
      id: project.id,
      title: project.title || 'Untitled',
      createdAt: project.createdAt,
      state: stateStr,
      thumb: getThumbDataUrl()
    };
    return window.FlickGalleryStore.putProject(payload).then(function (saved) {
      setCurrentProjectIdentity(saved.id, saved.state);
      if (!opts.silent) safeAlert('Saved.');
      return true;
    });
  }

  function createProjectFromCurrentState(opts) {
    opts = opts || {};
    var stateStr;
    try {
      stateStr = currentStateString();
    } catch (e) {
      safeAlert(e.message || 'Failed to read state');
      return Promise.resolve(null);
    }
    return window.FlickGalleryStore.listProjects().then(function (items) {
      var title = opts.title || nextDefaultTitle(items);
      return window.FlickGalleryStore.putProject({
        title: title,
        state: stateStr,
        thumb: getThumbDataUrl()
      });
    }).then(function (saved) {
      setCurrentProjectIdentity(saved.id, saved.state);
      return saved;
    });
  }

  function openProjectById(id, opts) {
    opts = opts || {};
    return window.FlickGalleryStore.getProject(id).then(function (full) {
      if (!full || typeof full.state !== 'string') throw new Error('Missing project data');
      loadProjectStateString(full.state);
      setCurrentProjectIdentity(full.id, full.state);
      if (opts.closeGallery && typeof closeGallery === 'function') closeGallery();
      if (opts.closeBurger && typeof closeBurgerDialog === 'function') closeBurgerDialog();
      return full;
    });
  }

  function ensureIosActiveProjectEntry() {
    if (!isIosApp()) return Promise.resolve(null);
    loadCurrentProjectIdentityFromStorage();
    return window.FlickGalleryStore.listProjects().then(function (items) {
      var byId = {};
      items.forEach(function (p) { byId[p.id] = p; });
      if (currentProjectId && byId[currentProjectId]) {
        if (typeof byId[currentProjectId].state === 'string') currentSavedStateString = byId[currentProjectId].state;
        return byId[currentProjectId];
      }
      var nowState = '';
      try { nowState = currentStateString(); } catch (e) {}
      var exactMatch = null;
      if (nowState) {
        exactMatch = items.find(function (p) { return p.state === nowState; }) || null;
      }
      if (exactMatch) {
        setCurrentProjectIdentity(exactMatch.id, exactMatch.state || nowState);
        return exactMatch;
      }
      return createProjectFromCurrentState({ title: nextDefaultTitle(items) });
    });
  }

  function saveCurrentToGallery(opts) {
    opts = opts || {};
    setBusy(true);
    if (!isIosApp()) {
      var defaultTitle = opts.defaultTitle || 'Untitled';
      var title = opts.title;
      if (!title) {
        title = prompt('Title for this saved Flickgame:', defaultTitle);
        if (title == null) {
          setBusy(false);
          return Promise.resolve(false);
        }
      }
      var stateStr;
      try {
        stateStr = currentStateString();
      } catch (e) {
        safeAlert(e.message || 'Failed to read state');
        setBusy(false);
        return Promise.resolve(false);
      }
      return window.FlickGalleryStore.putProject({
        title: (title || '').trim() || 'Untitled',
        state: stateStr,
        thumb: getThumbDataUrl()
      }).then(function () {
        if (!opts.silent) safeAlert('Saved to Gallery.');
        return true;
      }).catch(function (err) {
        safeAlert(err && err.message ? err.message : 'Failed to save');
        return false;
      }).finally(function () { setBusy(false); });
    }
    return ensureIosActiveProjectEntry().then(function (active) {
      return saveToExistingProject(active, opts);
    }).catch(function (err) {
      safeAlert(err && err.message ? err.message : 'Failed to save');
      return false;
    }).finally(function () { setBusy(false); });
  }

  function maybeSaveBeforeIosDestructiveAction() {
    if (!isIosApp()) return Promise.resolve(true);
    if (!isDirtyAgainstSavedSnapshot()) return Promise.resolve(true);
    var saveFirst = confirm('Save current flickgame before starting a new one? (All changes will be lost)');
    if (!saveFirst) return Promise.resolve(true);
    return saveCurrentToGallery({ silent: true });
  }

  function startNewFlickgameForIos() {
    if (!isIosApp()) {
      if (typeof confirmNewFlickgame === 'function') confirmNewFlickgame();
      return Promise.resolve(true);
    }
    return ensureIosActiveProjectEntry().then(function () {
      return maybeSaveBeforeIosDestructiveAction();
    }).then(function (canContinue) {
      if (!canContinue) return false;
      if (typeof newFlickgame !== 'function') return false;
      newFlickgame();
      return createProjectFromCurrentState().then(function () { return true; });
    }).catch(function (err) {
      safeAlert(err && err.message ? err.message : 'Failed to start a new flickgame');
      return false;
    });
  }

  function deleteProjectForIos(project, opts) {
    opts = opts || {};
    var deletingActive = isIosApp() && project && project.id && currentProjectId === project.id;
    var proceed = Promise.resolve(true);
    if (deletingActive) proceed = maybeSaveBeforeIosDestructiveAction();
    return proceed.then(function (ok) {
      if (!ok) return false;
      return window.FlickGalleryStore.deleteProject(project.id).then(function () {
        if (!deletingActive) return true;
        setCurrentProjectIdentity(null);
        return window.FlickGalleryStore.listProjects().then(function (items) {
          if (items.length > 0) return openProjectById(items[0].id, { closeBurger: false }).then(function () { return true; });
          if (typeof newFlickgame === 'function') newFlickgame();
          return createProjectFromCurrentState().then(function () { return true; });
        });
      });
    });
  }

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
      '.gallery-card-active{border-color:#93c5fd;}',
      '.gallery-card-dirty{box-shadow:0 0 0 2px #f59e0b inset;}',
      '.gallery-thumb{width:100%;aspect-ratio:16/10;background:#000;border-radius:8px;border:1px solid #333;image-rendering:pixelated;object-fit:cover;}',
      '.gallery-meta{display:flex;flex-direction:column;gap:2px;}',
      '.gallery-title{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.gallery-time{font-size:12px;color:var(--muted-foreground);}',
      '.gallery-card-actions{display:flex;gap:6px;flex-wrap:wrap;}',
      '.gallery-empty{color:var(--muted-foreground);text-align:center;padding:32px 8px;}',
      '.gallery-new-tile{display:flex;align-items:center;justify-content:center;min-height:170px;font-size:28px;font-weight:700;color:#cbd5e1;cursor:pointer;}',
      '.gallery-new-plus{font-size:40px;line-height:1;}'
    ].join('\n');
    var st = el('style', { id: 'gallery-overlay-styles', text: css });
    document.head.appendChild(st);
  }

  function ensureOverlay() {
    if (overlay) return;
    ensureStyles();
    headerTitle = el('h2', { text: 'Gallery' });
    var btnClose = el('button', { class: 'gallery-btn', text: 'Close' });
    btnClose.addEventListener('click', function () { closeGallery(); });
    var btnNew = el('button', { class: 'gallery-btn', text: 'New' });
    btnNew.addEventListener('click', function () {
      if (isIosApp()) startNewFlickgameForIos().finally(closeGallery);
      else if (typeof confirmNewFlickgame === 'function') { confirmNewFlickgame(); closeGallery(); }
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

  function renderDesktopList(items) {
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
        openProjectById(p.id, { closeGallery: true }).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to open project');
        }).finally(function () { setBusy(false); });
      });
      var btnRename = el('button', { class: 'gallery-btn', text: 'Rename' });
      btnRename.addEventListener('click', function (e) {
        stop(e);
        var t = prompt('Rename project:', p.title || 'Untitled');
        if (t == null) return;
        setBusy(true);
        window.FlickGalleryStore.getProject(p.id).then(function (full) {
          if (!full) throw new Error('Missing project data');
          full.title = (t || '').trim() || 'Untitled';
          return window.FlickGalleryStore.putProject(full);
        }).then(refreshOverlay).catch(function (err) {
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
        }).then(refreshOverlay).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to duplicate');
        }).finally(function () { setBusy(false); });
      });
      var btnDel = el('button', { class: 'gallery-btn', text: 'Delete' });
      btnDel.addEventListener('click', function (e) {
        stop(e);
        if (!confirm('Delete this saved Flickgame?')) return;
        setBusy(true);
        window.FlickGalleryStore.deleteProject(p.id).then(refreshOverlay).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to delete');
        }).finally(function () { setBusy(false); });
      });
      var actions = el('div', { class: 'gallery-card-actions' }, [btnOpen, btnRename, btnDup, btnDel]);
      var card = el('div', { class: 'gallery-card' }, [img, meta, actions]);
      grid.appendChild(card);
    });
    listContainer.appendChild(grid);
  }

  function renderListInto(containerEl, items, opts) {
    opts = opts || {};
    containerEl.innerHTML = '';
    if (!items || items.length === 0) items = [];
    var grid = el('div', { class: 'gallery-grid' });

    items.forEach(function (p) {
      var classes = ['gallery-card'];
      var isActive = isIosApp() && currentProjectId === p.id;
      if (isActive) classes.push('gallery-card-active');
      if (isActive && isDirtyAgainstSavedSnapshot()) classes.push('gallery-card-dirty');

      var img = el('img', { class: 'gallery-thumb', alt: 'thumbnail' });
      if (p.thumb) img.src = p.thumb;
      var titleText = p.title || 'Untitled';
      if (isActive && isDirtyAgainstSavedSnapshot()) titleText = titleText + ' *';
      var title = el('div', { class: 'gallery-title', text: titleText });
      var time = el('div', { class: 'gallery-time', text: 'Modified: ' + formatTime(p.updatedAt || p.createdAt || 0) });
      var meta = el('div', { class: 'gallery-meta' }, [title, time]);

      function refreshEmbedded() {
        return window.FlickGalleryStore.listProjects().then(function (nextItems) {
          renderListInto(containerEl, nextItems, opts);
          return nextItems;
        });
      }

      var btnOpen = el('button', { class: 'gallery-btn', text: 'Open' });
      btnOpen.addEventListener('click', function (e) {
        stop(e);
        openProjectById(p.id, { closeBurger: false }).then(function (full) {
          if (opts.onOpen) opts.onOpen(full);
          return refreshEmbedded();
        }).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to open project');
        });
      });

      var btnRename = el('button', { class: 'gallery-btn', text: 'Rename' });
      btnRename.addEventListener('click', function (e) {
        stop(e);
        var t = prompt('Rename project:', p.title || 'Untitled');
        if (t == null) return;
        window.FlickGalleryStore.getProject(p.id).then(function (full) {
          if (!full) throw new Error('Missing project data');
          full.title = resolveUniqueTitle(t, items, p.id);
          return window.FlickGalleryStore.putProject(full);
        }).then(refreshEmbedded).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to rename');
        });
      });
      var btnDup = el('button', { class: 'gallery-btn', text: 'Duplicate' });
      btnDup.addEventListener('click', function (e) {
        stop(e);
        window.FlickGalleryStore.getProject(p.id).then(function (full) {
          if (!full || typeof full.state !== 'string') throw new Error('Missing project data');
          return window.FlickGalleryStore.putProject({
            title: resolveUniqueTitle((full.title || 'Untitled') + ' copy', items, null),
            state: full.state,
            thumb: full.thumb || ''
          });
        }).then(refreshEmbedded).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to duplicate');
        });
      });

      var btnDel = el('button', { class: 'gallery-btn', text: 'Delete' });
      btnDel.addEventListener('click', function (e) {
        stop(e);
        if (!confirm('Delete this flickgame?')) return;
        deleteProjectForIos(p).then(function () {
          return refreshEmbedded();
        }).catch(function (err) {
          safeAlert(err && err.message ? err.message : 'Failed to delete');
        });
      });
      var card = el('div', { class: classes.join(' ') }, [img, meta, el('div', { class: 'gallery-card-actions' }, [btnOpen, btnRename, btnDup, btnDel])]);
      grid.appendChild(card);
    });

    if (items.length === 0) {
      containerEl.appendChild(el('div', { class: 'gallery-empty', text: 'No saved Flickgames yet.' }));
      return;
    }
    containerEl.appendChild(grid);
  }

  function refreshOverlay() {
    return window.FlickGalleryStore.listProjects().then(function (items) {
      renderDesktopList(items);
      return items;
    });
  }

  function renderEmbedded(containerEl, opts) {
    ensureStyles();
    return window.FlickGalleryStore.listProjects().then(function (items) {
      renderListInto(containerEl, items, opts);
      return items;
    }).catch(function (err) {
      containerEl.innerHTML = '';
      containerEl.appendChild(el('div', { class: 'gallery-empty', text: err && err.message ? err.message : 'Failed to load gallery' }));
      throw err;
    });
  }

  function openGallery() {
    ensureOverlay();
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    setBusy(true);
    refreshOverlay().catch(function (err) {
      safeAlert(err && err.message ? err.message : 'Failed to load gallery');
    }).finally(function () { setBusy(false); });
  }

  function closeGallery() {
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function removeGalleryButtonsFromDefaultBurger() {
    if (isIosApp()) return;
    ['burger-btn-save-gallery', 'burger-btn-open-gallery'].forEach(function (id) {
      var n = document.getElementById(id);
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });
  }

  function maybePromptToMigrateDraft() {
    return;
  }

  window.openGallery = openGallery;
  window.closeGallery = closeGallery;
  window.saveCurrentToGallery = saveCurrentToGallery;
  window.startNewFlickgameForIos = startNewFlickgameForIos;
  window._maybePromptToMigrateDraft = maybePromptToMigrateDraft;
  window.FlickGalleryUI = {
    renderEmbedded: renderEmbedded,
    isDirty: isDirtyAgainstSavedSnapshot,
    resolveUniqueTitle: resolveUniqueTitle,
    nextDefaultTitle: nextDefaultTitle,
    openProjectById: openProjectById,
    createProjectFromCurrentState: createProjectFromCurrentState,
    ensureIosActiveProjectEntry: ensureIosActiveProjectEntry
  };

  window.addEventListener('load', function () {
    removeGalleryButtonsFromDefaultBurger();
    if (!isIosApp()) return;
    ensureIosActiveProjectEntry().catch(function () {});
  });
})();
