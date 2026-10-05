// Picks the translation table for the device language. FlickT(english) returns the translation,
// or the English text itself when there is none. The tables above are keyed by the English text.
(function () {
  var tables = window.FLICK_I18N || {};
  delete window.FLICK_I18N;

  function tableFor(tag) {
    tag = String(tag || '').replace(/_/g, '-').toLowerCase();
    var parts = tag.split('-');
    var base = { iw: 'he', in: 'id', no: 'nb', nn: 'nb' }[parts[0]] || parts[0];
    var code = base;
    if (base === 'en') code = /-us\b/.test(tag) ? 'en-us' : 'en';
    else if (base === 'zh') code = /hant|-tw\b|-hk\b|-mo\b/.test(tag) ? 'zh-hant' : 'zh-hans';
    else if (base === 'pt') code = /-pt\b/.test(tag) ? 'pt-pt' : 'pt-br';
    else if (base === 'es') code = (parts.length === 1 || /-es\b/.test(tag)) ? 'es-es' : 'es-mx';
    else if (base === 'fr') code = /-ca\b/.test(tag) ? 'fr-ca' : 'fr';
    if (base === 'en') return { code: code, table: tables[code] || {} };
    return tables[code] ? { code: code, table: tables[code] } : null;
  }

  var found = null;
  var wanted = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
  for (var i = 0; i < wanted.length && !found; i++) found = tableFor(wanted[i]);
  if (!found) found = { code: 'en', table: {} };

  window.FLICK_LANG = found.code;
  window.FLICK_RTL = /^(ar|he|ur)$/.test(found.code);
  // Right-to-left languages: let each piece of text take its own direction, so mixed lines such as
  // an Arabic title containing "Flickgame" read in the right order. The layout itself is not mirrored.
  if (window.FLICK_RTL) {
    var style = document.createElement('style');
    style.textContent = 'body * { unicode-bidi: plaintext; }';
    document.documentElement.appendChild(style);
  }
  window.FlickT = function (english) {
    return found.table[english] || english;
  };
})();
