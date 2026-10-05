// Shared share/import/export helpers for Flickgame.
(function () {
  'use strict';

  /*ios-strip*/
  var OAUTH_CLIENT_ID = 'eb2aad12c63aec0136b1';
  /*/ios-strip*/
  var templatePromise = null;

  function getPlayTemplate() {
    if (templatePromise) return templatePromise;
    if (typeof window.FLICKGAME_STANDALONE_PLAY_HTML_B64 === 'string' && window.FLICKGAME_STANDALONE_PLAY_HTML_B64.length > 0) {
      templatePromise = new Promise(function (resolve, reject) {
        try {
          var b64bin = atob(window.FLICKGAME_STANDALONE_PLAY_HTML_B64);
          var b64bytes = new Uint8Array(b64bin.length);
          for (var i = 0; i < b64bin.length; i++) {
            b64bytes[i] = b64bin.charCodeAt(i) & 0xff;
          }
          resolve(new TextDecoder('utf-8').decode(b64bytes));
        } catch (e) {
          reject(e);
        }
      });
      return templatePromise;
    }
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
      var encodedState = encodeURI(stateString);
      var html = template.split('__EMBED__').join(encodedState);
      return '<!--Save as html file-->\n ' + html;
    });
  }

  // Characters that are actually illegal in a filename on Windows/macOS/Linux.
  // Everything else - accents, kana, hangul, cyrillic, emoji - is left alone, so a
  // non-Latin link still produces a meaningful filename.
  var FILENAME_ILLEGAL = /[\u0000-\u001f\u007f\/\\:*?"<>|]/g;
  // Invisible characters. Bidi overrides in particular can be used to make a file
  // look like it has a different extension than it does, so drop them outright.
  var FILENAME_INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;
  var FILENAME_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
  var FILENAME_MAX_BYTES = 120;

  function isHighSurrogate(c) { return c >= 0xd800 && c <= 0xdbff; }
  function isLowSurrogate(c) { return c >= 0xdc00 && c <= 0xdfff; }

  // Deliberately arithmetic rather than encodeURIComponent, which throws URIError on
  // an unpaired surrogate - and user text pasted into a link field can contain one.
  function utf8ByteLength(str) {
    var bytes = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) bytes += 1;
      else if (c < 0x800) bytes += 2;
      else if (isHighSurrogate(c) && i + 1 < str.length && isLowSurrogate(str.charCodeAt(i + 1))) {
        bytes += 4;
        i++;
      } else bytes += 3;
    }
    return bytes;
  }

  function truncateToBytes(str, maxBytes) {
    var out = str;
    while (out.length > 0 && utf8ByteLength(out) > maxBytes) {
      // a trailing low surrogate belongs to the pair before it, so drop both
      var drop = (out.length > 1 && isLowSurrogate(out.charCodeAt(out.length - 1))) ? 2 : 1;
      out = out.slice(0, out.length - drop);
    }
    return out;
  }

  // Turn arbitrary user text (a game link, a gallery title) into a filename stem.
  // Callers append their own '.html' afterwards, so a trailing .htm/.html is dropped here to
  // avoid names like "example.com_game.html.html".
  function sanitizeFilename(name, fallback) {
    var stem = (name === null || name === undefined) ? '' : String(name);
    if (typeof stem.normalize === 'function') stem = stem.normalize('NFC');
    stem = stem.replace(/^[a-z][a-z0-9+.\-]*:\/\//i, '');   // drop http:// etc
    stem = stem.replace(FILENAME_INVISIBLE, '');
    stem = stem.replace(FILENAME_ILLEGAL, '_');
    stem = stem.replace(/\s+/g, '_');
    stem = stem.replace(/\.(html?)$/i, '');
    stem = stem.replace(/\./g, '_');                        // dots read as separators too
    stem = stem.replace(/_+/g, '_');                         // must follow the dot pass, or "a..b" keeps both
    stem = stem.replace(/^[_.\-]+/, '').replace(/[_.\-]+$/, '');
    stem = truncateToBytes(stem, FILENAME_MAX_BYTES);
    stem = stem.replace(/[_.\-]+$/, '');                     // truncation may expose a new trailing separator
    if (FILENAME_RESERVED.test(stem)) stem = '_' + stem;
    if (!stem) stem = fallback || 'flickgame';
    return stem;
  }

  function downloadStandaloneHtml(stateString, filename) {
    return buildStandaloneHtmlString(stateString).then(function (html) {
      if (window.FLICKGAME_IOS_APP && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flickExport) {
        var enc = new TextEncoder();
        var u8 = enc.encode(html);
        var bin = '';
        for (var j = 0; j < u8.length; j++) {
          bin += String.fromCharCode(u8[j]);
        }
        window.webkit.messageHandlers.flickExport.postMessage({
          // same HTML, but .flickgame opens in the app when tapped on another phone
          filename: (filename || 'flickgame.html').replace(/\.html$/, '.flickgame'),
          dataBase64: btoa(bin)
        });
        return true;
      }
      var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      if (typeof saveAs !== 'function') throw new Error('FileSaver (saveAs) not available');
      saveAs(blob, filename || 'flickgame.html');
      return true;
    });
  }

  /*ios-strip*/
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
    // URL-safe hex state, persisted so the OAuth callback (auth.html) can verify it (CSRF protection).
    var bytes = window.crypto.getRandomValues(new Uint8Array(24));
    var randomState = Array.prototype.map.call(bytes, function (x) {
      return ('0' + x.toString(16)).slice(-2);
    }).join('');
    try {
      window.localStorage.setItem('oauth_state', randomState);
    } catch (e) {}
    return 'https://github.com/login/oauth/authorize'
      + '?client_id=' + OAUTH_CLIENT_ID
      + '&scope=gist'
      + '&state=' + randomState
      + '&allow_signup=true';
  }
  /*/ios-strip*/

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

  /*ios-strip*/
  function resolvePlayUrl(playPath) {
    var base = window.location.protocol === 'file:' ? 'https://www.flickgame.org/' : window.location.href;
    return new URL(playPath, base).href;
  }
  /*/ios-strip*/

  window.FlickgameShare = {
    /*ios-strip*/
    shareStateAsGist: shareStateAsGist,
    getAuthUrl: getAuthUrl,
    resolvePlayUrl: resolvePlayUrl,
    /*/ios-strip*/
    buildStandaloneHtmlString: buildStandaloneHtmlString,
    downloadStandaloneHtml: downloadStandaloneHtml,
    sanitizeFilename: sanitizeFilename,
    extractStateFromStandaloneHtml: extractStateFromStandaloneHtml,
    extractStateFromImportText: extractStateFromImportText
  };
})();
