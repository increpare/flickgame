const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const sourcePath = path.join(__dirname, '../web/bootstrap.js');
function boot() {
  const messages = [], attributes = {}, properties = {};
  const window = { FlickAndroid: {
    postMessage: (name, body) => messages.push([name, JSON.parse(body)]),
    getPlayTemplate: () => 'template', getLanguages: () => '["de-DE"]',
    isSupporter: () => true
  }};
  vm.runInNewContext(fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : '', {
    window, document: { documentElement: {
      setAttribute: (k,v) => attributes[k] = v,
      style: { setProperty: (k,v) => properties[k] = v }
    }}, JSON
  });
  return { window, messages, attributes, properties };
}
test('Android bootstrap enables the existing mobile UI and device translations', () => {
  const b = boot();
  assert.equal(b.window.FLICKGAME_HOST, 'android-app');
  assert.equal(b.window.FLICKGAME_ANDROID_APP, true);
  assert.deepEqual(Array.from(b.window.FLICKGAME_LANGUAGES), ['de-DE']);
  assert.equal(b.attributes['data-supporter'], 'true');
  assert.match(b.properties['--ios-icon-share'], /^url\(data:image\/svg\+xml/);
});
test('existing page message channels deliver typed native messages', () => {
  const b = boot();
  assert.ok(b.window.webkit, 'native message adapter is installed');
  b.window.webkit.messageHandlers.flickExport.postMessage({ filename: '猫.flickgame', dataBase64: 'YWJj' });
  b.window.webkit.messageHandlers.flickImport.postMessage('pick');
  b.window.webkit.messageHandlers.flickIncoming.postMessage('ready');
  b.window.webkit.messageHandlers.flickSupporter.postMessage('restore');
  assert.deepEqual(b.messages, [
    ['flickExport', { filename: '猫.flickgame', dataBase64: 'YWJj' }],
    ['flickImport', 'pick'], ['flickIncoming', 'ready'], ['flickSupporter', 'restore']
  ]);
});

test('Back dismisses the actual link, frame, palette and background pickers before leaving', () => {
  const source = fs.readFileSync(path.join(__dirname, '../web/back.js'), 'utf8');
  for (const [selector, closeName] of [
    ['.page-picker.visible', 'hidePagePicker'],
    ['#frame-picker.visible', 'hideFramePicker'],
    ['.palette-modal', 'closePaletteSelector'],
    ['.background-color-picker', 'closeBackgroundColorPicker']
  ]) {
    let closed = false, left = false;
    const window = { location: { pathname: '/www/index.html' },
      FlickAndroidBackToGallery: () => left = true };
    window[closeName] = () => closed = true;
    vm.runInNewContext(source, { window, document: {
      getElementById: () => null,
      querySelector: s => s === selector ? {} : null
    }});
    assert.equal(window.FlickAndroidHandleBack(), true);
    assert.equal(closed, true, selector + ' must close');
    assert.equal(left, false, 'Back must preserve the editor');
  }
});
