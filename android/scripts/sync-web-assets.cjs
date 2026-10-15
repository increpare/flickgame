#!/usr/bin/env node
// Build the shared offline bundle without platform-specific shell tools.
const fs = require('node:fs');
const path = require('node:path');

const [repoArg, destArg] = process.argv.slice(2);
if (!repoArg || !destArg) throw new Error('Usage: sync-web-assets.cjs <repo root> <destination www dir>');
const root = fs.realpathSync(repoArg);
const dest = path.resolve(destArg);
const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};
// Refuse to clean source directories or an ancestor of the checkout.
if (inside(dest, root) || (inside(root, dest) && !inside(path.join(root, 'android/app/build'), dest))) {
  throw new Error('Destination must be outside the checkout or inside android/app/build');
}
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symbolic link: ${file}`);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const write = (name, text) => fs.writeFileSync(path.join(dest, name), text);
function replaceRequired(text, pattern, replacement, label) {
  if (!text.match(pattern)) throw new Error(`Missing source hook: ${label}`);
  return text.replace(pattern, replacement);
}

const manifest = read(path.join(root, 'ios/flickgame-web-manifest.txt'))
  .split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'))
  .map(line => {
    const separator = line.indexOf('=');
    const name = separator < 0 ? line : line.slice(0, separator);
    const source = path.resolve(root, separator < 0 ? line : line.slice(separator + 1));
    const target = path.resolve(dest, name);
    if (!inside(root, source) || !inside(dest, target)) throw new Error(`Invalid manifest path: ${line}`);
    if (!fs.statSync(source).isFile()) throw new Error(`Missing asset: ${source}`);
    return { source, target };
  });
fs.mkdirSync(dest, { recursive: true });
// Resolve existing paths too, so a symlinked destination cannot clean sources.
const actualDest = fs.realpathSync(dest);
if (inside(actualDest, root) || (inside(root, actualDest) && !inside(path.join(root, 'android/app/build'), actualDest))) {
  throw new Error('Destination resolves to a source directory');
}
for (const file of files(dest)) if (path.basename(file) !== '.gitkeep') fs.unlinkSync(file);
for (const { source, target } of manifest) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
// Keep the in-app policy identical to the public document submitted to Play.
const privacyPage = read(path.join(root, 'android/playstore/privacy-policy.html'));
const privacyContent = privacyPage.match(/<main>([\s\S]*?)<\/main>/);
if (!privacyContent) throw new Error('Privacy policy content not found');
write('help.html', replaceRequired(read(path.join(dest, 'help.html')), /<\/main>/,
  '<p class="small"><a href="#privacy-policy" onclick="document.getElementById(\'privacy-policy\').open = true;" data-t>Privacy policy</a></p>\n'
  + '<details id="privacy-policy"><summary data-t>Privacy policy</summary>'
  + privacyContent[1].replace(/<h1>/g, '<h2>').replace(/<\/h1>/g, '</h2>')
  + '</details>\n  </main>', 'Help privacy policy'));

const examples = ['icecream', 'heart', 'cat'].map(name => {
  const game = read(path.join(root, 'ios/examples', `${name}.flickgame`));
  const match = game.match(/__EmbedBegin__-->\s*var embeddedDat="([^"]*)"/);
  if (!match) throw new Error(`No embedded game data in ${name}.flickgame`);
  return `{ title: "${name}", state: decodeURI("${match[1]}") },\n`;
});
write('example_game.js', `window.FLICKGAME_EXAMPLES = [\n${examples.join('')}];\n`);
const translations = fs.readdirSync(path.join(root, 'ios/i18n')).sort()
  .filter(name => name.endsWith('.json') && !name.startsWith('_'))
  .map(name => `"${path.basename(name, '.json')}": ${read(path.join(root, 'ios/i18n', name))},\n`);
write('i18n.js', `window.FLICK_I18N = {\n${translations.join('')}};\n${read(path.join(root, 'ios/i18n/runtime.js'))}`);

for (const file of files(dest).filter(file => /\.(html|js)$/.test(file))) {
  let text = read(file)
    .replace(/[ \t]*(?:<!--|\/\*)ios-strip(?:-->|\*\/)[\s\S]*?(?:<!--|\/\*)\/ios-strip(?:-->|\*\/)[ \t]*\n?/g, '')
    .replace(/https:\/\/github\.com\/increpare\/flickgame\/issues\//g, 'issue ')
    .replace(/ios-app/g, 'android-app')
    .replace(/FLICKGAME_IOS_APP/g, 'FLICKGAME_ANDROID_APP')
    .replace(/flickgame_ios_example/g, 'flickgame_android_example')
    .replace(/the App Store/g, 'Google Play')
    .replace(/App\s*Store/g, 'Google Play')
    .replace(/var wanted = /g, 'var wanted = window.FLICKGAME_LANGUAGES || ');
  fs.writeFileSync(file, text);
}
for (const file of files(dest).filter(file => /\.(html|js|css)$/.test(file))) {
  for (const [index, line] of read(file).split('\n').entries()) {
    if (/ios-strip|(https?:)?\/\/(www\.)?[a-z0-9.-]+\.[a-z]{2,}\/?|mailto:/.test(line)
        && !/\/\/(www\.)?(w3\.org|flickgame\.org|purl\.eligrey\.com)/.test(line)) {
      throw new Error(`Outside-world URL left in offline bundle: ${file}:${index + 1}`);
    }
  }
}
// play.html remains the standalone export template; the native host injects its bootstrap.
for (const page of ['index', 'gallery', 'help']) {
  write(`${page}.html`, replaceRequired(read(path.join(dest, `${page}.html`)), /<head>/,
    '<head>\n  <script src="android_bootstrap.js"></script>\n  <script src="i18n.js"></script>\n  <script src="android_back.js"></script>', `${page} head`));
}
write('index.html', replaceRequired(read(path.join(dest, 'index.html')),
  /if \(isProjectBlank\(\)\) newFlickgame\(true\);\n      else if \(isMobileLayout\(\)\)/,
  'if (isMobileLayout())', 'editor layout refresh'));
write('ios_editor_menu.js', replaceRequired(read(path.join(dest, 'ios_editor_menu.js')) + '\n',
  /  function init\(\) \{/, '  window.FlickAndroidBackToGallery = handleBackToGallery;\n\n  function init() {', 'editor Back'));

// Acknowledge the IndexedDB save and reuse import IDs after interrupted delivery.
let gallery = read(path.join(dest, 'gallery_page.js'));
const start = gallery.indexOf('  function importText(');
const end = gallery.indexOf('\n  function handleImportFile', start);
if (start < 0 || end < 0) throw new Error('Gallery import function not found');
let block = gallery.slice(start, end);
for (const [pattern, replacement, label] of [
  [/function importText\(text, fileName, page\)/, 'function importText(text, fileName, page, token)', 'import arguments'],
  [/      return;/, '      return Promise.resolve(false);', 'empty import'],
  [/    window.FlickGalleryStore.listProjects/, '    return window.FlickGalleryStore.listProjects', 'import promise'],
  [/(then\(function \(items\) \{)/, "$1\n      var importedId = token ? 'incoming-' + token : undefined;\n      var existing = importedId && items.filter(function (p) { return p.id === importedId; })[0];\n      if (existing) return existing;", 'import retry'],
  [/(return window.FlickGalleryStore.putProject\(\{)/, '$1\n        id: importedId,', 'import ID'],
  [/(      navigate\(page \+ '\?id=' \+ encodeURIComponent\(saved.id\)\);)/, '$1\n      return true;', 'import success'],
  [/(      showToast\(err && err.message \? err.message : T\('Failed to import'\)\);\n)(    \}\);)/, '$1      return false;\n$2', 'import failure'],
]) block = replaceRequired(block, pattern, replacement, label);
gallery = gallery.slice(0, start) + block + gallery.slice(end);
gallery = replaceRequired(gallery, /function importIncoming\(base64, fileName, page\)/,
  'function importIncoming(base64, fileName, page, token)', 'incoming arguments');
gallery = replaceRequired(gallery, /    importText\(new TextDecoder\('utf-8'\).decode\(bytes\), fileName, page\);/,
  "    return importText(new TextDecoder('utf-8').decode(bytes), fileName, page, token);", 'incoming promise');
write('gallery_page.js', gallery);
fs.copyFileSync(path.join(root, 'android/web/bootstrap.js'), path.join(dest, 'android_bootstrap.js'));
fs.copyFileSync(path.join(root, 'android/web/back.js'), path.join(dest, 'android_back.js'));
console.log(`Synced offline Android assets to ${dest}`);
