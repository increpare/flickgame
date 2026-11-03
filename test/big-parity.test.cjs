const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function editor() {
  const html = fs.readFileSync(path.join(root, 'index_big.html'), 'utf8');
  const source = html.match(/<script type="text\/javascript">([\s\S]*?)<\/script>/)[1];
  const saved = new Map();
  const context = vm.createContext({
    console,
    document: { addEventListener() {} },
    XMLHttpRequest: class { open() {} send() {} },
    nearest_color_in_palette: palette => palette[0],
    window: { localStorage: {
      getItem: key => saved.get(key) || null,
      setItem: (key, value) => saved.set(key, value)
    } },
    palettes: { 'dawnbringer-16': new Array(16).fill('#000000') },
    colorPalette: new Array(16).fill('#000000')
  });
  vm.runInContext(source, context);
  context.set_modal_panel_selected_item = () => {};
  context.set_color_palette = () => {};
  context.changeBackgroundColor = () => {};
  return { context, saved };
}

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' exists');
  const opening = source.indexOf('{', start);
  let depth = 0;
  for (let i = opening; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed ' + name);
}

test('Big imports variable-resolution games and keeps all 128 pages and links', () => {
  const { context } = editor();
  const cells = 80 * 60;
  const state = {
    width: 80, height: 60, version: '2', palette_name: 'dawnbringer-16',
    background_color: '#000000', foreground_color: '#ffffff',
    gameLink: 'www.flickgame.org', activeIndex: 127,
    canvasses: Array.from({ length: 128 }, (_, i) => [cells, (i % 16).toString(16)]),
    hyperlinks: Array.from({ length: 128 }, () => new Array(16).fill(0))
  };
  state.hyperlinks[127][3] = 128;
  context.stringToState(JSON.stringify(state));
  assert.equal(context.width, 80);
  assert.equal(context.height, 60);
  assert.equal(context.canvasses.length, 128);
  assert.equal(context.canvasses[127].length, cells);
  assert.equal(context.canvasses[127][0], 15);
  assert.equal(context.hyperlinks[127][3], 128);
  const savedState = JSON.parse(context.stateToString());
  assert.equal(savedState.width, 80);
  assert.equal(savedState.height, 60);
  assert.equal(savedState.canvasses.length, 128);
  assert.equal(savedState.hyperlinks[127][3], 128);
});

test('Big saves its draft separately from the standard editor', () => {
  const { context, saved } = editor();
  context.width = 1;
  context.height = 1;
  context.canvasses = Array.from({ length: 128 }, () => new Uint8Array(1));
  context.hyperlinks = Array.from({ length: 128 }, () => new Array(16).fill(0));
  context.saveFlickgameState();
  assert.equal(saved.has('flickgame_editor_state'), false);
  assert.equal(JSON.parse(saved.get('flickgame_big_editor_state')).canvasses.length, 128);
});

test('Big uses the larger draft store when available', async () => {
  const { context, saved } = editor();
  let storedState = null;
  context.window.FlickBigDraft = {
    save: async state => { storedState = state; },
    load: async () => storedState
  };
  context.width = 1;
  context.height = 1;
  context.canvasses = Array.from({ length: 128 }, () => new Uint8Array(1));
  context.hyperlinks = Array.from({ length: 128 }, () => new Array(16).fill(0));
  await context.saveFlickgameState();
  assert.equal(JSON.parse(storedState).canvasses.length, 128);
  assert.equal(saved.has('flickgame_editor_state'), false);
  assert.equal(await context.loadFlickgameState(), storedState);
});

test('Big prefers a newer local fallback after a draft store failure', async () => {
  const { context, saved } = editor();
  saved.set('flickgame_big_editor_state', 'newer-local-draft');
  context.window.FlickBigDraft = { load: async () => 'older-database-draft' };
  assert.equal(await context.loadFlickgameState(), 'newer-local-draft');
});

test('Big blocks keyboard edits and drawing while a draft loads', () => {
  const { context } = editor();
  let pastes = 0, strokes = 0;
  context.draftLoading = true;
  context.updateCursor = () => {};
  context.doPaste = () => { pastes++; };
  context.beginDrawStroke = () => { strokes++; };
  context.press({ keyCode: 86, target: null });
  context.mouseDown({ pointerType: 'mouse', preventDefault() {} });
  assert.equal(pastes, 0);
  assert.equal(strokes, 0);
});

test('mobile page icon previews the active group of 16 Big pages', () => {
  const { context } = editor();
  const previews = new Map();
  context.canvasIndex = 127;
  context.isMobileLayout = () => true;
  context.thumbnailCanvas = Array.from({ length: 128 }, (_, i) => ({
    toDataURL: () => 'page-' + (i + 1)
  }));
  context.document.getElementById = id => ({
    setAttributeNS: (_namespace, _name, value) => previews.set(id, value)
  });
  context.updateMobileGridIconThumbnails();
  assert.equal(previews.get('mobile-grid-thumb-0'), 'page-113');
  assert.equal(previews.get('mobile-grid-thumb-15'), 'page-128');
});

test('mobile page icon keeps the active border within its 16-page group', () => {
  const { context } = editor();
  const position = {};
  const border = { setAttribute: (name, value) => { position[name] = value; } };
  const cells = Array.from({ length: 16 }, () => ({
    classList: { add() {}, remove() {} }
  }));
  context.document.getElementById = id => {
    if (id === 'mobile-grid-icon') return {};
    if (id === 'mobile-grid-active-border') return border;
    if (id === 'mobile-frame-btn') return { setAttribute() {} };
    const match = /^grid-cell-(\d+)$/.exec(id);
    return match ? cells[Number(match[1])] : null;
  };
  context.isCanvasEmpty = () => false;
  context.canvasIndex = 16;
  context.updateGridIconHighlight();
  assert.equal(position.y, 0.25);
  context.canvasIndex = 127;
  context.updateGridIconHighlight();
  assert.equal(position.x, 12.25);
  assert.equal(position.y, 12.25);
});

test('modern player renders every page of a Big game', () => {
  const html = fs.readFileSync(path.join(root, 'play.html'), 'utf8');
  const renderImages = extractFunction(html, 'renderImages');
  const context = vm.createContext({
    gameState: { canvasses: Array.from({ length: 128 }, (_, i) => [1, (i % 16).toString(16)]) },
    images: [], imageCtxts: [],
    getGameWidth: () => 1, getGameHeight: () => 1,
    RLE_decode: pairs => pairs[1],
    printCanvas: pixels => [pixels, {}],
    redraw: () => {}
  });
  vm.runInContext(renderImages, context);
  context.renderImages();
  assert.equal(context.gameState.imageDats.length, 128);
  assert.equal(context.images[127], 'f');
});

test('modern player bounds imported page counts at Big capacity', () => {
  const html = fs.readFileSync(path.join(root, 'play.html'), 'utf8');
  const loadState = extractFunction(html, 'loadState');
  const context = vm.createContext({
    document: { documentElement: { style: { setProperty() {} } } },
    palettes: { 'dawnbringer-16': new Array(16).fill('#000000') },
    updateFooterLinks() {},
    upgrade_v1_to_v2(state) { state.version = '2'; }
  });
  vm.runInContext(loadState, context);
  context.loadState(JSON.stringify({
    width: 1, height: 1,
    canvasses: new Array(1000).fill([1, '0']),
    hyperlinks: []
  }));
  assert.equal(context.gameState.canvasses.length, 128);
  assert.equal(context.gameState.hyperlinks.length, 128);
  assert.equal(context.gameState.originalPageCount, 1000);
});

test('native player does not offer an editor for Big games absent from its bundle', () => {
  const html = fs.readFileSync(path.join(root, 'play.html'), 'utf8');
  const updateFooterLinks = extractFunction(html, 'updateFooterLinks');
  const edit = {
    href: 'index_big.html?p=example', style: {},
    querySelector: () => ({ innerHTML: '' }),
    removeAttribute(name) { if (name === 'href') delete this.href; }
  };
  const context = vm.createContext({
    gameState: { canvasses: new Array(128).fill([]) },
    document: { getElementById: id => id === 'hackLink' ? edit : null },
    isIosAppHost: () => true,
    t: value => value
  });
  vm.runInContext(updateFooterLinks, context);
  context.updateFooterLinks();
  assert.equal(edit.style.display, 'none');
  assert.equal(edit.href, undefined);
});

test('player does not offer a lossy edit route for projects beyond Big capacity', () => {
  const html = fs.readFileSync(path.join(root, 'play.html'), 'utf8');
  const updateFooterLinks = extractFunction(html, 'updateFooterLinks');
  const edit = {
    href: 'index_big.html?p=example', style: {},
    querySelector: () => ({ innerHTML: '' }),
    removeAttribute(name) { if (name === 'href') delete this.href; }
  };
  const context = vm.createContext({
    gameState: { canvasses: new Array(128).fill([]), originalPageCount: 129 },
    document: { getElementById: id => id === 'hackLink' ? edit : null },
    isIosAppHost: () => false,
    t: value => value
  });
  vm.runInContext(updateFooterLinks, context);
  context.updateFooterLinks();
  assert.equal(edit.style.display, 'none');
  assert.equal(edit.href, undefined);
});

test('web gallery opens 128-page projects in Big and 16-page projects in standard', () => {
  const source = fs.readFileSync(path.join(root, 'gallery_page.js'), 'utf8');
  const choose = extractFunction(source, 'editorPageForState');
  const context = vm.createContext({ isIosApp: () => false });
  vm.runInContext(choose, context);
  assert.equal(context.editorPageForState(JSON.stringify({ canvasses: new Array(128).fill([]) })), 'index_big.html');
  assert.equal(context.editorPageForState(JSON.stringify({ canvasses: new Array(16).fill([]) })), 'index.html');
  assert.equal(context.editorPageForState('{broken'), 'index.html');
  context.isIosApp = () => true;
  assert.equal(context.editorPageForState(JSON.stringify({ canvasses: new Array(128).fill([]) })), null);
  context.isIosApp = () => false;
  assert.equal(context.editorPageForState(JSON.stringify({ canvasses: new Array(129).fill([]) })), null);
});

test('embedded gallery cannot load a Big project into the 16-page editor', async () => {
  const source = fs.readFileSync(path.join(root, 'gallery_ui.js'), 'utf8');
  const openProjectById = extractFunction(source, 'openProjectById');
  const state = JSON.stringify({ canvasses: new Array(128).fill([]) });
  let loads = 0;
  const context = vm.createContext({
    window: {
      location: { href: 'index.html' },
      FlickGalleryStore: { getProject: async () => ({ id: 'big-id', state }) }
    },
    isIosApp: () => false,
    loadProjectStateString: () => { loads++; },
    setCurrentProjectIdentity() {}
  });
  vm.runInContext(openProjectById, context);
  await context.openProjectById('big-id');
  assert.equal(loads, 0);
  assert.equal(context.window.location.href, 'index_big.html?id=big-id');
  context.isIosApp = () => true;
  context.window.location.href = 'index.html';
  await assert.rejects(context.openProjectById('big-id'), /Big Flickgames/);
  assert.equal(loads, 0);
  assert.equal(context.window.location.href, 'index.html');
});
