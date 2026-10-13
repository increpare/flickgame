// Compatibility adapter for the shared mobile pages. Only bundled pages see it.
(function () {
  'use strict';
  var native = window.FlickAndroid;
  if (!native) return;
  window.FLICKGAME_HOST = 'android-app';
  window.FLICKGAME_ANDROID_APP = true;
  window.FLICKGAME_LANGUAGES = JSON.parse(native.getLanguages());
  window.FLICKGAME_STANDALONE_PLAY_HTML_B64 = native.getPlayTemplate();
  // Reuse the existing page message channels; Android supplies their implementation.
  var handlers = {};
  ['flickExport', 'flickImport', 'flickIncoming', 'flickSupporter'].forEach(function (name) {
    handlers[name] = { postMessage: function (body) { native.postMessage(name, JSON.stringify(body)); } };
  });
  window.webkit = { messageHandlers: handlers };
  document.documentElement.setAttribute('data-supporter', String(native.isSupporter()));
  // Material icon paths, in the CSS slots already used by the mobile layout.
  var icons = {
    folder: 'M10 4H2v16h20V6H12l-2-2z',
    edit: 'M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 0 1.66 1.34 3 3 3 2.21 0 4-1.79 4-4 0-1.66-.9-4-2-4zm13.71-9.37-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z',
    share: 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.3 3.3 0 0 0 0-1.4l7.05-4.11A3 3 0 1 0 15 5c0 .24.03.47.09.7L8.04 9.81a3 3 0 1 0 0 4.38l7.12 4.16A3 3 0 1 0 18 16.08z',
    play: 'M8 5v14l11-7z'
  };
  Object.keys(icons).forEach(function (name) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="' + icons[name] + '"/></svg>';
    document.documentElement.style.setProperty('--ios-icon-' + name, 'url(data:image/svg+xml,' + encodeURIComponent(svg) + ')');
  });
})();
