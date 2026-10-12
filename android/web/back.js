// Returns whether Android Back was handled inside the current page.
(function () {
  'use strict';
  window.FlickAndroidHandleBack = function () {
    var help = document.getElementById('ios-help-overlay');
    if (help) { help.remove(); return true; }
    var choice = document.querySelector('.ios-choice-overlay');
    if (choice) {
      var buttons = choice.querySelectorAll('button');
      if (buttons.length) buttons[buttons.length - 1].click();
      return true;
    }
    var pickers = [
      ['.palette-modal', 'closePaletteSelector'],
      ['.background-color-picker', 'closeBackgroundColorPicker'],
      ['.page-picker.visible', 'hidePagePicker'],
      ['#frame-picker.visible', 'hideFramePicker']
    ];
    for (var i = 0; i < pickers.length; i++) {
      if (document.querySelector(pickers[i][0]) && typeof window[pickers[i][1]] === 'function') {
        window[pickers[i][1]]();
        return true;
      }
    }
    var burger = document.getElementById('burger-dialog');
    if (burger && burger.classList.contains('visible')) {
      window.closeBurgerDialog();
      return true;
    }
    if (/\/index\.html$/.test(window.location.pathname) && window.FlickAndroidBackToGallery) {
      window.FlickAndroidBackToGallery();
      return true;
    }
    if (!/\/gallery\.html$/.test(window.location.pathname)) {
      window.location.href = 'gallery.html';
      return true;
    }
    return false;
  };
})();
