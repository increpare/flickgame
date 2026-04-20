// iOS-only editor burger controller.
(function () {
  'use strict';

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
    (children || []).forEach(function (c) {
      if (c == null) return;
      if (typeof c === 'string') n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    });
    return n;
  }

  function ensureStyles() {
    if (document.getElementById('ios-editor-menu-styles')) return;
    var css = [
      '#burger-dialog .ios-editor-grid{display:grid;grid-template-columns:auto 1fr;gap:12px 10px;align-items:center;margin-bottom:14px;}',
      '#burger-dialog .ios-editor-label{font-size:13px;color:#ddd;}',
      '#burger-dialog .ios-editor-input{width:100%;box-sizing:border-box;padding:8px 10px;background:#111;color:#fff;border:1px solid #333;border-radius:8px;font-size:14px;}',
      '#burger-dialog .ios-editor-action{display:block;width:100%;margin-top:8px;}',
      '#burger-dialog .ios-editor-palette-btn{text-align:left;}',
      '#burger-dialog .palette-credit-link, #burger-dialog .palette-name-link, #burger-dialog #palette-credit-link{display:none !important;}',
      '.ios-choice-overlay{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.72);}',
      '.ios-choice-box{width:min(360px,100%);background:#111;border:2px solid var(--muted-foreground);border-radius:12px;padding:14px;box-sizing:border-box;}',
      '.ios-choice-title{margin:0 0 12px;font-size:16px;font-weight:600;color:#fff;}',
      '.ios-choice-btn{display:block;width:100%;margin-top:8px;padding:10px 12px;border:2px solid var(--muted-foreground);border-radius:8px;background:#1a1a1a;color:#fff;font-size:14px;text-align:left;}'
    ].join('\n');
    document.head.appendChild(el('style', { id: 'ios-editor-menu-styles', text: css }));
  }

  function currentProjectId() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('id');
    } catch (e) {
      return null;
    }
  }

  function getCurrentProject() {
    var id = currentProjectId();
    if (!id || !window.FlickGalleryStore) return Promise.resolve(null);
    return window.FlickGalleryStore.getProject(id);
  }

  function showChoiceDialog(message) {
    return new Promise(function (resolve) {
      var overlay = el('div', { class: 'ios-choice-overlay' });
      var box = el('div', { class: 'ios-choice-box' });
      var title = el('p', { class: 'ios-choice-title', text: message });
      var saveBtn = el('button', { type: 'button', class: 'ios-choice-btn', text: 'Save' });
      var discardBtn = el('button', { type: 'button', class: 'ios-choice-btn', text: 'Discard' });
      var cancelBtn = el('button', { type: 'button', class: 'ios-choice-btn', text: 'Cancel' });

      function close(choice) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(choice);
      }

      saveBtn.addEventListener('click', function () { close('save'); });
      discardBtn.addEventListener('click', function () { close('discard'); });
      cancelBtn.addEventListener('click', function () { close('cancel'); });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close('cancel');
      });

      box.appendChild(title);
      box.appendChild(saveBtn);
      box.appendChild(discardBtn);
      box.appendChild(cancelBtn);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  }

  function handleRename() {
    var input = document.getElementById('ios-editor-name-input');
    if (!input || !window.FlickGalleryUI || typeof window.FlickGalleryUI.resolveUniqueTitle !== 'function') return;
    Promise.all([getCurrentProject(), window.FlickGalleryStore.listProjects()]).then(function (pair) {
      var current = pair[0];
      var items = pair[1];
      if (!current) return;
      var resolved = window.FlickGalleryUI.resolveUniqueTitle(input.value, items, current.id);
      if (resolved === current.title) {
        input.value = resolved;
        return;
      }
      current.title = resolved;
      return window.FlickGalleryStore.putProject(current).then(function () {
        input.value = resolved;
      });
    }).catch(function (err) {
      alert(err && err.message ? err.message : 'Rename failed');
    });
  }

  function handleBackToGallery() {
    var isDirty = window.FlickGalleryUI && window.FlickGalleryUI.isDirty ? window.FlickGalleryUI.isDirty() : false;
    if (!isDirty) {
      window.location.href = 'gallery.html';
      return;
    }
    showChoiceDialog('Save changes before returning to the gallery?').then(function (choice) {
      if (choice === 'cancel') return;
      if (choice === 'save') {
        if (typeof saveCurrentToGallery === 'function') {
          saveCurrentToGallery({ silent: true }).then(function (ok) {
            if (ok) window.location.href = 'gallery.html';
          });
        }
        return;
      }
      window.location.href = 'gallery.html';
    });
  }

  function render() {
    var dialog = document.getElementById('burger-dialog');
    var content = dialog ? dialog.querySelector('.burger-dialog-content') : null;
    if (!dialog || !content) return;
    ensureStyles();

    var bgControl = document.getElementById('burger-bg-picker-control') || document.getElementById('bgColorPickerControl') || document.getElementById('burger-bg-select') || document.getElementById('bgColorSelect');
    if (typeof syncBackgroundColorControls === 'function') {
      syncBackgroundColorControls();
    }

    while (content.firstChild) content.removeChild(content.firstChild);

    var closeBtn = el('button', {
      type: 'button',
      class: 'burger-dialog-close',
      id: 'burger-dialog-close',
      'aria-label': 'Close'
    }, ['\u00d7']);
    closeBtn.addEventListener('click', closeBurgerDialog);

    var nameInput = el('input', {
      type: 'text',
      id: 'ios-editor-name-input',
      class: 'ios-editor-input',
      placeholder: 'flickgame'
    });
    nameInput.addEventListener('blur', handleRename);
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameInput.blur();
      }
    });

    var paletteBtn = el('button', {
      type: 'button',
      class: 'burger-dialog-btn ios-editor-action ios-editor-palette-btn'
    }, [typeof palette_name === 'string' ? palette_name : 'Palette']);
    paletteBtn.addEventListener('click', function (evt) {
      evt.stopPropagation();
      if (typeof openPaletteSelector === 'function') openPaletteSelector(evt);
    });

    var grid = el('div', { class: 'ios-editor-grid' }, [
      el('div', { class: 'ios-editor-label', text: 'Name' }),
      nameInput,
      el('div', { class: 'ios-editor-label', text: 'Background' }),
      bgControl || el('div', { text: '(missing)' }),
      el('div', { class: 'ios-editor-label', text: 'Palette' }),
      paletteBtn
    ]);

    var saveBtn = el('button', { type: 'button', class: 'burger-dialog-btn ios-editor-action', text: 'Save' });
    saveBtn.addEventListener('click', function () {
      if (typeof saveCurrentToGallery !== 'function') return;
      saveCurrentToGallery({ silent: false }).then(function (ok) {
        if (ok) closeBurgerDialog();
      });
    });

    var clearBtn = el('button', { type: 'button', class: 'burger-dialog-btn ios-editor-action', text: 'Clear page' });
    clearBtn.addEventListener('click', function () {
      if (!confirm('Clear this page? This cannot be undone.')) return;
      if (typeof clearPalette === 'function') clearPalette();
    });

    var helpBtn = el('button', { type: 'button', class: 'burger-dialog-btn ios-editor-action', text: 'Help' });
    helpBtn.addEventListener('click', function () {
      closeBurgerDialog();
      window.location.href = 'help.html';
    });

    var backBtn = el('button', { type: 'button', class: 'burger-dialog-btn ios-editor-action', text: '< Back to Gallery' });
    backBtn.addEventListener('click', handleBackToGallery);

    content.appendChild(closeBtn);
    content.appendChild(grid);
    content.appendChild(saveBtn);
    content.appendChild(clearBtn);
    content.appendChild(helpBtn);
    content.appendChild(backBtn);

    getCurrentProject().then(function (project) {
      if (project && typeof project.title === 'string') nameInput.value = project.title;
    }).catch(function () {});
  }

  function init() {
    if (!isIosApp()) return;
    var btn = document.getElementById('mobile-burger-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        render();
      }, { capture: true });
    }
    render();
  }

  window.addEventListener('load', function () {
    try {
      init();
    } catch (e) {}
  });
})();
