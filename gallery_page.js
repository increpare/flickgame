// Controller for the top-level gallery page.
(function () {
  'use strict';

  var grid = null;
  var toastEl = null;
  var importInput = null;
  var shareOverlay = null;
  var shareSheet = null;
  var toastTimer = null;
  var busyProjectId = null;
  var importBtn = null;
  var previewCache = {};

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
    (children || []).forEach(function (c) {
      if (c == null) return;
      if (typeof c === 'string') n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    });
    return n;
  }

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('visible');
    }, 2400);
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
    if (!trimmed) return nextDefaultTitle(items);
    var base = trimmed.replace(/\s+\d+$/, '').trim();
    if (!base) return nextDefaultTitle(items);
    var used = {};
    (items || []).forEach(function (p) {
      if (!p || p.id === currentId || typeof p.title !== 'string') return;
      used[p.title] = true;
    });
    if (!used[base]) return base;
    var n = 2;
    while (used[base + ' ' + n]) n += 1;
    return base + ' ' + n;
  }

  function formatTime(ms) {
    try {
      return new Date(ms).toLocaleString();
    } catch (e) {
      return '' + ms;
    }
  }

  function navigate(url) {
    window.location.href = url;
  }

  function decodeRleCanvas(rle, pixelCount) {
    var out = new Uint8Array(pixelCount);
    var index = 0;
    for (var i = 0; i < rle.length; i += 2) {
      var count = rle[i];
      var ch = rle[i + 1];
      for (var j = 0; j < count && index < pixelCount; j++) {
        out[index++] = parseInt(ch, 16);
      }
    }
    return out;
  }

  function renderPreviewFromState(stateString) {
    if (typeof stateString !== 'string' || !stateString) return '';
    var parsed = JSON.parse(stateString);
    if (parsed.palette_name === undefined) parsed.palette_name = 'dawnbringer-16';
    if (parsed.background_color === undefined) parsed.background_color = '#000000';
    if (parsed.foreground_color === undefined) parsed.foreground_color = '#ffffff';
    if (parsed.version === undefined && typeof upgrade_v1_to_v2 === 'function') {
      upgrade_v1_to_v2(parsed);
    }
    var previewWidth = parsed.width !== undefined ? parsed.width : 160;
    var previewHeight = parsed.height !== undefined ? parsed.height : 100;
    var sourceFrames = parsed.canvasses || [];
    if (!sourceFrames.length) return '';
    var palette = (typeof palettes !== 'undefined' && palettes && palettes[parsed.palette_name]) || (typeof palettes !== 'undefined' && palettes && palettes['dawnbringer-16']) || null;
    if (!palette) return '';
    var pixels = decodeRleCanvas(sourceFrames[0], previewWidth * previewHeight);
    var canvas = document.createElement('canvas');
    canvas.width = previewWidth;
    canvas.height = previewHeight;
    var ctx = canvas.getContext('2d');
    if (!ctx) return '';
    var imageData = ctx.createImageData(previewWidth, previewHeight);
    var data = imageData.data;
    for (var i = 0; i < pixels.length; i++) {
      var color = palette[pixels[i]] || '#000000';
      var rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
      var off = i << 2;
      data[off] = rgb ? parseInt(rgb[1], 16) : 0;
      data[off + 1] = rgb ? parseInt(rgb[2], 16) : 0;
      data[off + 2] = rgb ? parseInt(rgb[3], 16) : 0;
      data[off + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function previewSrcForProject(project) {
    var cacheKey = (project.id || 'project') + ':' + (project.updatedAt || 0);
    if (previewCache[cacheKey]) return previewCache[cacheKey];
    try {
      if (typeof project.state === 'string' && project.state) {
        previewCache[cacheKey] = renderPreviewFromState(project.state);
        if (previewCache[cacheKey]) return previewCache[cacheKey];
      }
    } catch (e) {}
    previewCache[cacheKey] = project.thumb || '';
    return previewCache[cacheKey];
  }

  function setBusy(projectId) {
    busyProjectId = projectId || null;
    if (grid) renderGrid();
  }

  function isBusy(projectId) {
    return busyProjectId != null && busyProjectId === projectId;
  }

  function closeShareSheet() {
    if (!shareOverlay) return;
    shareOverlay.classList.remove('visible');
    shareOverlay.setAttribute('aria-hidden', 'true');
  }

  function copyToClipboard(url) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(url).then(function () {
          showToast('Link copied to clipboard.');
        });
      }
    } catch (e) {}
    window.prompt('Copy this link:', url);
    return Promise.resolve();
  }

  function openShareSheet(project) {
    if (!shareSheet || !shareOverlay) return;
    while (shareSheet.firstChild) shareSheet.removeChild(shareSheet.firstChild);
    var title = el('h2', { class: 'gallery-share-title', text: 'Share "' + (project.title || 'Untitled') + '"' });
    var shareLinkBtn = el('button', { type: 'button', class: 'gallery-btn', text: 'Share Link' });
    var saveFileBtn = el('button', { type: 'button', class: 'gallery-btn', text: 'Save HTML to Files' });
    var cancelBtn = el('button', { type: 'button', class: 'gallery-btn', text: 'Cancel' });

    shareLinkBtn.addEventListener('click', function () {
      setBusy(project.id);
      window.FlickGalleryStore.getProject(project.id).then(function (full) {
        if (!full || typeof full.state !== 'string') throw new Error('Project not found');
        return new Promise(function (resolve, reject) {
          FlickgameShare.shareStateAsGist(full.state, {
            onUnauthorized: function () { reject(new Error('Log in with GitHub from the editor first.')); },
            onError: function (msg) { reject(new Error(msg)); },
            onSuccess: resolve
          });
        });
      }).then(function (result) {
        var url = FlickgameShare.resolvePlayUrl(result.playUrl);
        if (navigator.share) {
          return navigator.share({ url: url }).catch(function () {
            return copyToClipboard(url);
          });
        }
        return copyToClipboard(url);
      }).then(function () {
        closeShareSheet();
      }).catch(function (err) {
        showToast(err && err.message ? err.message : 'Failed to share');
      }).finally(function () {
        setBusy(null);
      });
    });

    saveFileBtn.addEventListener('click', function () {
      setBusy(project.id);
      window.FlickGalleryStore.getProject(project.id).then(function (full) {
        if (!full || typeof full.state !== 'string') throw new Error('Project not found');
        var safeName = ((full.title || 'flickgame').trim() || 'flickgame').replace(/[^a-z0-9_\-]+/gi, '_');
        return FlickgameShare.downloadStandaloneHtml(full.state, safeName + '.html');
      }).then(function () {
        closeShareSheet();
      }).catch(function (err) {
        showToast(err && err.message ? err.message : 'Failed to export');
      }).finally(function () {
        setBusy(null);
      });
    });

    cancelBtn.addEventListener('click', closeShareSheet);

    shareSheet.appendChild(title);
    shareSheet.appendChild(shareLinkBtn);
    shareSheet.appendChild(saveFileBtn);
    shareSheet.appendChild(cancelBtn);
    shareOverlay.classList.add('visible');
    shareOverlay.setAttribute('aria-hidden', 'false');
  }

  function renderProjectCard(project) {
    var card = el('div', { class: 'gallery-card' });
    var thumb = el('img', { class: 'gallery-thumb', alt: 'thumbnail for ' + (project.title || 'project') });
    var previewSrc = previewSrcForProject(project);
    if (previewSrc) thumb.src = previewSrc;
    thumb.addEventListener('click', function () {
      if (isBusy(project.id)) return;
      navigate('play.html?id=' + encodeURIComponent(project.id));
    });
    var title = el('div', { class: 'gallery-title', text: project.title || 'Untitled' });
    var time = el('div', { class: 'gallery-time', text: 'Modified: ' + formatTime(project.updatedAt || project.createdAt || 0) });
    var actions = el('div', { class: 'gallery-actions' });

    function addAction(label, handler) {
      var btn = el('button', {
        type: 'button',
        class: 'gallery-btn',
        text: label
      });
      btn.disabled = isBusy(project.id);
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (isBusy(project.id)) return;
        handler();
      });
      actions.appendChild(btn);
    }

    addAction('Edit', function () {
      navigate('index.html?id=' + encodeURIComponent(project.id));
    });
    addAction('Share', function () {
      openShareSheet(project);
    });
    addAction('Delete', function () {
      if (!confirm('Delete "' + (project.title || 'Untitled') + '"? This cannot be undone.')) return;
      setBusy(project.id);
      window.FlickGalleryStore.deleteProject(project.id).then(function () {
        closeShareSheet();
        return renderGrid();
      }).catch(function (err) {
        showToast(err && err.message ? err.message : 'Failed to delete');
      }).finally(function () {
        setBusy(null);
      });
    });

    card.appendChild(thumb);
    card.appendChild(title);
    card.appendChild(time);
    card.appendChild(actions);
    return card;
  }

  function renderTile(label, innerText, onClick) {
    var tile = el('div', { class: 'gallery-card gallery-tile', role: 'button', tabindex: '0' }, [
      el('div', { class: 'gallery-tile-inner' }, [
        el('div', { class: innerText === '+' ? 'gallery-tile-plus' : '', text: innerText }),
        el('div', { text: label })
      ])
    ]);
    tile.addEventListener('click', onClick);
    tile.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    });
    return tile;
  }

  function renderGrid() {
    return window.FlickGalleryStore.listProjects().then(function (items) {
      grid.innerHTML = '';
      grid.appendChild(renderTile('New', '+', function () {
        navigate('index.html?new=1');
      }));
      items.forEach(function (project) {
        grid.appendChild(renderProjectCard(project));
      });
      return items;
    }).catch(function (err) {
      grid.innerHTML = '';
      showToast(err && err.message ? err.message : 'Failed to load gallery');
      return [];
    });
  }

  function handleImportFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var text = e.target.result;
      var state;
      try {
        state = FlickgameShare.extractStateFromImportText(text);
      } catch (err) {
        showToast(err && err.message ? err.message : 'Failed to import');
        return;
      }
      window.FlickGalleryStore.listProjects().then(function (items) {
        var baseName = (file.name || 'imported').replace(/\.[^.]+$/, '');
        var title = resolveUniqueTitle(baseName, items, null);
        var thumb = '';
        try {
          thumb = renderPreviewFromState(state);
        } catch (e) {}
        return window.FlickGalleryStore.putProject({
          title: title,
          state: state,
          thumb: thumb
        });
      }).then(function (saved) {
        navigate('index.html?id=' + encodeURIComponent(saved.id));
      }).catch(function (err) {
        showToast(err && err.message ? err.message : 'Failed to import');
      });
    };
    reader.onerror = function () {
      showToast('Failed to read file');
    };
    reader.readAsText(file);
  }

  function init() {
    grid = document.getElementById('gallery-grid');
    toastEl = document.getElementById('gallery-toast');
    importInput = document.getElementById('gallery-import-input');
    importBtn = document.getElementById('gallery-import-btn');
    shareOverlay = document.getElementById('gallery-share-overlay');
    shareSheet = document.getElementById('gallery-share-sheet');

    if (shareOverlay) {
      shareOverlay.addEventListener('click', function (e) {
        if (e.target === shareOverlay) closeShareSheet();
      });
    }
    if (importBtn) {
      importBtn.addEventListener('click', function () {
        if (importInput) importInput.click();
      });
    }
    if (importInput) {
      importInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        e.target.value = '';
        handleImportFile(file);
      });
    }
    renderGrid();
  }

  window.addEventListener('load', init);
})();
