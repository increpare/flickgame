// iOS-app-only burger menu controller with embedded gallery.
(function () {
  'use strict';

  function isIosApp() {
    try { return !!(window && (window.FLICKGAME_HOST === 'ios-app' || window.FLICKGAME_IOS_APP)); }
    catch (e) { return false; }
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

  function ensureIosBurgerStyles() {
    if (document.getElementById('ios-burger-styles')) return;
    var css = [
      '#burger-dialog .ios-burger-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;}',
      '#burger-dialog .ios-burger-title{font-size:18px;font-weight:600;}',
      '#burger-dialog .ios-burger-nav{display:flex;gap:8px;align-items:center;}',
      '#burger-dialog .ios-burger-section{margin-top:10px;}',
      '#burger-dialog .ios-burger-row{display:flex;gap:8px;flex-wrap:wrap;}',
      '#burger-dialog .ios-burger-divider{border:0;border-top:2px solid var(--muted-foreground);margin:10px 0;}',
      '#burger-dialog .ios-burger-save-row{margin-bottom:8px;}',
      '#burger-dialog .ios-burger-footer{margin-top:8px;}',
      '#burger-dialog .ios-burger-scroll{max-height:52vh;overflow:auto;border:2px solid var(--muted-foreground);border-radius:10px;padding:8px;background:#0b0b0b;}',
      '#burger-dialog .ios-burger-scroll .gallery-grid{grid-template-columns:1fr !important;}'
    ].join('\n');
    var st = el('style', { id: 'ios-burger-styles', text: css });
    document.head.appendChild(st);
  }

  function ensureElements() {
    var dialog = document.getElementById('burger-dialog');
    var content = dialog ? dialog.querySelector('.burger-dialog-content') : null;
    return { dialog: dialog, content: content };
  }

  function clearContent(content) {
    while (content.firstChild) content.removeChild(content.firstChild);
  }

  function renderHeader(content) {
    var titleWrap = el('div', null, [
      el('div', { class: 'ios-burger-title', text: 'Menu' })
    ]);

    var nav = el('div', { class: 'ios-burger-nav' });
    var close = el('button', { type: 'button', class: 'burger-dialog-btn', text: 'Close' });
    close.addEventListener('click', function () {
      if (typeof closeBurgerDialog === 'function') closeBurgerDialog();
    });
    nav.appendChild(close);

    content.appendChild(el('div', { class: 'ios-burger-header' }, [titleWrap, nav]));
  }

  function renderFooterActions(content) {
    var row = el('div', { class: 'ios-burger-row ios-burger-footer' });
    var btnImport = el('button', { type: 'button', class: 'burger-dialog-btn', text: 'Import…' });
    btnImport.addEventListener('click', function () {
      var f = document.getElementById('my_file');
      if (f) f.click();
    });
    var btnExport = el('button', { type: 'button', class: 'burger-dialog-btn', text: 'Export…' });
    btnExport.addEventListener('click', function () { if (typeof exportClick === 'function') exportClick(); });
    var btnHelp = el('button', { type: 'button', class: 'burger-dialog-btn', text: 'Help' });
    btnHelp.addEventListener('click', function () {
      if (typeof closeBurgerDialog === 'function') closeBurgerDialog();
      window.location.href = 'help.html';
    });
    row.appendChild(btnImport);
    row.appendChild(btnExport);
    row.appendChild(btnHelp);
    content.appendChild(row);
  }

  function renderMenu(content) {
    var section = el('div', { class: 'ios-burger-section' });
    var saveRow = el('div', { class: 'ios-burger-row ios-burger-save-row' });
    var btnSave = el('button', { type: 'button', class: 'burger-dialog-btn', text: 'Save' });
    btnSave.addEventListener('click', function () {
      if (typeof saveCurrentToGallery === 'function') saveCurrentToGallery();
    });
    saveRow.appendChild(btnSave);
    section.appendChild(saveRow);

    var scroll = el('div', { class: 'ios-burger-scroll', id: 'ios-burger-gallery-host' });
    section.appendChild(scroll);
    content.appendChild(section);
    if (!window.FlickGalleryUI || typeof window.FlickGalleryUI.renderEmbedded !== 'function') {
      scroll.appendChild(el('div', { text: 'Gallery UI not available.' }));
      return;
    }
    window.FlickGalleryUI.renderEmbedded(scroll, {
      iosMenuMode: true,
      onOpen: function () {
        if (typeof closeBurgerDialog === 'function') closeBurgerDialog();
      }
    });
    renderFooterActions(content);
  }

  function render() {
    var els = ensureElements();
    if (!els.dialog || !els.content) return;
    ensureIosBurgerStyles();

    var content = els.content;
    clearContent(content);

    renderHeader(content);
    renderMenu(content);
  }

  function init() {
    if (!isIosApp()) return;
    // Re-render when burger is opened.
    var btn = document.getElementById('mobile-burger-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        render();
      }, { capture: true });
    }
    // If it’s already open for some reason, render once.
    render();
  }

  window.addEventListener('load', function () {
    try { init(); } catch (e) {}
  });
})();

