const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
function sync(dest) {
  return spawnSync(process.execPath, [path.join(root, 'android/scripts/sync-web-assets.cjs'), root, dest], { encoding: 'utf8' });
}

test('Android bundle is offline, localized and exports self-contained compatible games', async () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'flick-android-test-'));
  try {
    const result = sync(dest);
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
    for (const name of fs.readdirSync(dest).filter(name => name.endsWith('.js'))) {
      new vm.Script(fs.readFileSync(path.join(dest, name), 'utf8'), { filename: name });
    }
    const examples = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(dest, 'example_game.js'), 'utf8'), examples);
    assert.deepEqual(Array.from(examples.window.FLICKGAME_EXAMPLES, example => example.title), ['icecream', 'heart', 'cat']);
    for (const example of examples.window.FLICKGAME_EXAMPLES) assert.ok(JSON.parse(example.state).canvasses);
    const player = fs.readFileSync(path.join(dest, 'play.html'), 'utf8');
    assert.doesNotMatch(player, /android_bootstrap/);
    const context = { window: {}, TextDecoder, TextEncoder, URL, Promise };
    vm.runInNewContext(fs.readFileSync(path.join(dest, 'flickgame_share.js'), 'utf8'), context);
    const example = fs.readFileSync(path.join(root, 'ios/examples/cat.flickgame'), 'utf8');
    const state = context.window.FlickgameShare.extractStateFromImportText(example);
    assert.ok(JSON.parse(state).canvasses);
    context.window.FLICKGAME_STANDALONE_PLAY_HTML_B64 = Buffer.from(player).toString('base64');
    context.atob = s => Buffer.from(s, 'base64').toString('binary');
    const html = await context.window.FlickgameShare.buildStandaloneHtmlString(state);
    assert.equal(context.window.FlickgameShare.extractStateFromImportText(html), state);
    assert.doesNotMatch(html, /android_bootstrap|FlickAndroid/);
  } finally { fs.rmSync(dest, { recursive: true, force: true }); }
});

test('generated native imports wait for storage and retry without duplicate projects', async () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'flick-android-import-'));
  try {
    const result = sync(dest);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const source = fs.readFileSync(path.join(dest, 'gallery_page.js'), 'utf8');
    const projects = [], navigation = [], errors = [];
    let completeSave;
    const context = {
      window: { FlickGalleryStore: {
        listProjects: async () => projects,
        putProject: project => new Promise(resolve => { completeSave = () => { projects.push(project); resolve(project); }; })
      } },
      FlickgameShare: { extractStateFromImportText: text => { JSON.parse(text); return text; } },
      resolveUniqueTitle: name => name, renderPreviewFromState: () => null,
      navigate: url => navigation.push(url), showToast: message => errors.push(message), T: text => text,
      TextDecoder, atob: text => Buffer.from(text, 'base64').toString('binary')
    };
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf('  function importText('), source.indexOf('\n  function handleImportFile')), context);
    vm.runInContext(source.slice(source.indexOf('  function importIncoming('), source.indexOf('\n  function init()', source.indexOf('  function importIncoming('))), context);
    const data = Buffer.from('{"canvasses":[]}', 'utf8').toString('base64');
    const pending = context.importIncoming(data, '猫.flickgame', 'play.html', 'token-123');
    await Promise.resolve();
    assert.equal(navigation.length, 0, 'navigation must wait for the IndexedDB save');
    completeSave();
    assert.equal(await pending, true);
    assert.equal(projects[0].id, 'incoming-token-123');
    assert.equal(projects[0].title, '猫');
    assert.equal(await context.importIncoming(data, '猫.flickgame', 'play.html', 'token-123'), true);
    assert.equal(projects.length, 1, 'redelivery must reuse the completed import');
    assert.equal(navigation[0], 'play.html?id=incoming-token-123');
    context.window.FlickGalleryStore.listProjects = async () => { throw new Error('storage unavailable'); };
    assert.equal(await context.importIncoming(data, 'cat.flickgame', 'play.html', 'new-token'), false);
    assert.equal(await context.importText('invalid', 'bad.flickgame', 'play.html'), false);
    assert.equal(errors.length, 2);
  } finally { fs.rmSync(dest, { recursive: true, force: true }); }
});

test('asset regeneration removes stale files and refuses to overwrite sources', () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'flick-android-clean-'));
  try {
    fs.writeFileSync(path.join(dest, 'stale.js'), 'fetch("https://example.com")');
    assert.equal(sync(dest).status, 0);
    assert.equal(fs.existsSync(path.join(dest, 'stale.js')), false);
    const before = fs.readFileSync(path.join(root, 'index.html'));
    for (const unsafe of [root, path.join(root, 'android/web'), path.dirname(root)]) {
      const result = sync(unsafe);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Destination must be outside the checkout/);
    }
    assert.deepEqual(fs.readFileSync(path.join(root, 'index.html')), before);
  } finally { fs.rmSync(dest, { recursive: true, force: true }); }
});
