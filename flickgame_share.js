// Shared share/import/export helpers for Flickgame.
(function () {
  'use strict';

  var OAUTH_CLIENT_ID = 'eb2aad12c63aec0136b1';
  var templatePromise = null;

  function getPlayTemplate() {
    if (templatePromise) return templatePromise;
    templatePromise = new Promise(function (resolve, reject) {
      var req = new XMLHttpRequest();
      req.open('GET', 'play.html');
      req.onreadystatechange = function () {
        if (req.readyState !== 4) return;
        if (req.status >= 200 && req.status < 400) resolve(req.responseText);
        else reject(new Error('Failed to load play.html template (HTTP ' + req.status + ')'));
      };
      req.onerror = function () {
        reject(new Error('Network error loading play.html template'));
      };
      req.send();
    });
    return templatePromise;
  }

  function buildStandaloneHtmlString(stateString) {
    return getPlayTemplate().then(function (template) {
      var encoded = encodeURI(stateString);
      return '<!--Save as html file-->\n ' + template.replace(/__EMBED__/g, encoded);
    });
  }

  function downloadStandaloneHtml(stateString, filename) {
    return buildStandaloneHtmlString(stateString).then(function (html) {
      var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      if (typeof saveAs !== 'function') throw new Error('FileSaver (saveAs) not available');
      saveAs(blob, filename || 'flickgame.html');
      return true;
    });
  }

  function shareStateAsGist(stateString, callbacks) {
    callbacks = callbacks || {};
    var onSuccess = callbacks.onSuccess || function () {};
    var onError = callbacks.onError || function () {};
    var onUnauthorized = callbacks.onUnauthorized || onError;

    var token = window.localStorage.getItem('oauth_access_token');
    if (typeof token !== 'string') {
      onUnauthorized();
      return;
    }

    var gist = {
      description: 'flickgame',
      public: true,
      files: {
        'readme.txt': { content: 'A game made with www.flickgame.org. You can import game.txt there to play the game.' },
        'game.txt': { content: stateString }
      }
    };

    var req = new XMLHttpRequest();
    req.open('POST', 'https://api.github.com/gists');
    req.onreadystatechange = function () {
      if (req.readyState !== 4) return;
      var result;
      try {
        result = JSON.parse(req.responseText);
      } catch (e) {
        result = null;
      }
      if (req.status === 403) {
        onError((result && result.message) || 'Forbidden');
        return;
      }
      if (req.status !== 200 && req.status !== 201) {
        if (req.statusText === 'Unauthorized') {
          window.localStorage.removeItem('oauth_access_token');
          onUnauthorized();
        } else {
          onError('HTTP Error ' + req.status + ' - ' + req.statusText);
        }
        return;
      }
      onSuccess({ id: result.id, playUrl: 'play.html?p=' + result.id });
    };
    req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    req.setRequestHeader('Authorization', 'token ' + token);
    req.send(JSON.stringify(gist));
  }

  function getAuthUrl() {
    var randomState = window.btoa(Array.prototype.map.call(
      window.crypto.getRandomValues(new Uint8Array(24)),
      function (x) { return String.fromCharCode(x); }
    ).join(''));
    return 'https://github.com/login/oauth/authorize'
      + '?client_id=' + OAUTH_CLIENT_ID
      + '&scope=gist'
      + '&state=' + randomState
      + '&allow_signup=true';
  }

  function extractStateFromStandaloneHtml(contents) {
    var fromToken = '<!--__EmbedBegin__-->';
    var endToken = '<!--__EmbedEnd__-->';
    var fromIndex = contents.indexOf(fromToken);
    var endIndex = contents.indexOf(endToken);
    if (fromIndex < 0 || endIndex < 0 || endIndex <= fromIndex) {
      throw new Error("Couldn't find embedded flickgame data in this HTML file.");
    }
    var ss1 = contents.substr(fromIndex + fromToken.length, endIndex - fromIndex - fromToken.length);
    var firstQuoteIndex = ss1.indexOf('"');
    if (firstQuoteIndex < 0) {
      throw new Error('Embedded flickgame data is malformed.');
    }
    var ss2 = ss1.substr(firstQuoteIndex + 1);
    var leftRemoved = decodeURI(ss2);
    var finalQuoteIndex = leftRemoved.lastIndexOf('"');
    if (finalQuoteIndex < 0) {
      throw new Error('Embedded flickgame data is malformed.');
    }
    return leftRemoved.substring(0, finalQuoteIndex);
  }

  function extractStateFromImportText(text) {
    try {
      return extractStateFromStandaloneHtml(text);
    } catch (htmlError) {
      var parsed;
      try {
        parsed = JSON.parse(text);
      } catch (jsonError) {
        throw htmlError;
      }
      if (!parsed || !parsed.canvasses || !parsed.hyperlinks) {
        throw htmlError;
      }
      return text;
    }
  }

  function resolvePlayUrl(playPath) {
    var base = window.location.protocol === 'file:' ? 'https://www.flickgame.org/' : window.location.href;
    return new URL(playPath, base).href;
  }

  window.FlickgameShare = {
    buildStandaloneHtmlString: buildStandaloneHtmlString,
    downloadStandaloneHtml: downloadStandaloneHtml,
    shareStateAsGist: shareStateAsGist,
    getAuthUrl: getAuthUrl,
    extractStateFromStandaloneHtml: extractStateFromStandaloneHtml,
    extractStateFromImportText: extractStateFromImportText,
    resolvePlayUrl: resolvePlayUrl
  };
})();
