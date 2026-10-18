const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
test('Android bundle is offline, localized and exports self-contained compatible games', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'flick-android-test-'));
  try {
    const result = spawnSync('sh', [path.join(root, 'android/scripts/sync-web-assets.sh'), root, dest], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const gallery = fs.readFileSync(path.join(dest, 'gallery.html'), 'utf8');
    assert.match(gallery, /android_bootstrap\.js/);
    assert.ok(gallery.indexOf('android_bootstrap.js') < gallery.indexOf('FLICKGAME_HOST'));
    assert.match(gallery, /android-app/);
    const i18n = fs.readFileSync(path.join(dest, 'i18n.js'), 'utf8');
    assert.match(i18n, /FLICKGAME_LANGUAGES/);
    assert.doesNotMatch(i18n, /Couldn't reach the App Store/);
    assert.match(i18n, /Google Play/);
    assert.match(i18n, /Couldn't reach Google Play/);
    const player = fs.readFileSync(path.join(dest, 'play.html'), 'utf8');
    assert.doesNotMatch(player, /android_bootstrap/);
    const context = { window: {}, TextDecoder, TextEncoder, URL, Promise };
    vm.runInNewContext(fs.readFileSync(path.join(dest, 'flickgame_share.js'), 'utf8'), context);
    const example = fs.readFileSync(path.join(root, 'ios/examples/cat.flickgame'), 'utf8');
    const state = context.window.FlickgameShare.extractStateFromImportText(example);
    assert.ok(JSON.parse(state).canvasses);
    context.window.FLICKGAME_STANDALONE_PLAY_HTML_B64 = Buffer.from(player).toString('base64');
    context.atob = s => Buffer.from(s, 'base64').toString('binary');
    return context.window.FlickgameShare.buildStandaloneHtmlString(state).then(html => {
      assert.equal(context.window.FlickgameShare.extractStateFromImportText(html), state);
      assert.doesNotMatch(html, /android_bootstrap|FlickAndroid/);
    });
  } finally { fs.rmSync(dest, { recursive: true, force: true }); }
});
