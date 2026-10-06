import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPalettes, normalizeGame, resolvePalette, linksForFrame } from '../src/core/flickgame.js';
import { renderFrameWithLegendPng, legendLayout, LEGEND } from '../src/core/render.js';
import { nearestSquare, prefersDarkText } from '../src/core/color.js';
import { TelegramApi } from '../src/telegram/tg.js';
import { encodeCallback, decodeCallback, buildKeyboard, RESET } from '../src/telegram/keyboard.js';
import { UploadStore } from '../src/telegram/uploads.js';
import { createTelegramBot } from '../src/telegram/bot.js';
import { readPng } from './helpers/readPng.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const palettes = loadPalettes(path.join(repoRoot, 'palettes'));
const gameJson = fs.readFileSync(path.join(repoRoot, 'testgame.txt'), 'utf8');
const ID = '3f5390b0b2aca7bce1eb4a4f483e2354';

test('nearestSquare and prefersDarkText give sensible answers', () => {
  assert.equal(nearestSquare('#ff0000'), '🟥');
  assert.equal(nearestSquare('#2040ff'), '🟦');
  assert.equal(nearestSquare('#f8f8f8'), '⬜');
  assert.equal(nearestSquare('#101010'), '⬛');
  assert.equal(prefersDarkText('#ffffaa'), true);
  assert.equal(prefersDarkText('#202030'), false);
});

test('callback data round-trips and stays under 64 bytes', () => {
  const d = encodeCallback('g', ID, 12, 7);
  assert.ok(d.length <= 64);
  assert.deepEqual(decodeCallback(d), { kind: 'g', id: ID, frame: 12, colour: 7 });
  assert.deepEqual(decodeCallback(encodeCallback('f', 'abc123', 0, RESET)), { kind: 'f', id: 'abc123', frame: 0, colour: RESET });
  assert.equal(decodeCallback('x:1:2:3'), null);
  assert.equal(decodeCallback('g:zz:0:0'), null);
  assert.equal(decodeCallback('g:ab:16:0'), null);
  assert.equal(decodeCallback('g:ab:0:16'), null);
  assert.equal(decodeCallback(''), null);
});

test('buildKeyboard numbers link colours in order and ends with reset', () => {
  const palette = ['#000000', '#ff0000', '#00ff00'];
  const kb = buildKeyboard({ kind: 'g', id: ID, frame: 3, links: [{ colorIndex: 1 }, { colorIndex: 2 }], palette });
  const row = kb.inline_keyboard[0];
  assert.deepEqual(row.map((b) => b.text), ['1 🟥', '2 🟩', '🔄']);
  assert.equal(row[0].callback_data, `g:${ID}:3:1`);
  assert.equal(row[2].callback_data, `g:${ID}:3:r`);
  const many = buildKeyboard({ kind: 'g', id: ID, frame: 0, links: Array.from({ length: 16 }, (_, i) => ({ colorIndex: i })), palette: palettes['daylight-16'] });
  assert.deepEqual(many.inline_keyboard.map((r) => r.length), [8, 8, 1]);
});

test('legend strip renders numbered swatches under the frame', () => {
  const game = normalizeGame(gameJson);
  const palette = resolvePalette(palettes, game);
  const links = linksForFrame(game, 0).map((l) => l.colorIndex);
  assert.equal(links.length, 2);
  const layout = legendLayout(game.width, 2);
  assert.deepEqual(layout, { perRow: 9, rows: 1, height: LEGEND.margin + LEGEND.swatchH + LEGEND.gap });
  const img = readPng(renderFrameWithLegendPng(game, palette, 0, links, 1));
  assert.equal(img.width, 160);
  assert.equal(img.height, 155 + layout.height);
  assert.equal(img.palette.length, 19);
  assert.equal(img.palette[16], game.backgroundColor);
  const px = (x, y) => img.indices[y * img.width + x];
  // swatch 1 starts at (2, 155+2); its top-left pixel is the colour, the strip corner is background
  assert.equal(px(2, 157), links[0]);
  assert.equal(px(0, 157), 16);
  // the "1" glyph puts ink (black=17 or white=18) inside swatch 1
  let ink = 0;
  for (let y = 157; y < 167; y++) for (let x = 2; x < 16; x++) if (px(x, y) >= 17) ink++;
  assert.equal(ink, 8, 'the 3x5 digit 1 has 8 lit pixels');
  // swatch 2 starts 16px further right
  assert.equal(px(18, 157), links[1]);
  // no links: no strip at all
  assert.equal(readPng(renderFrameWithLegendPng(game, palette, 0, [], 1)).height, 155);
  fs.mkdirSync(path.join(repoRoot, 'bots/test/out'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'bots/test/out/testgame-legend.png'), renderFrameWithLegendPng(game, palette, 0, links, 4));
});

function fakeFetch(handler) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  f.calls = calls;
  return f;
}
const jsonRes = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });

test('TelegramApi sends JSON for plain calls and multipart for files', async () => {
  const fetchImpl = fakeFetch(() => jsonRes({ ok: true, result: { id: 1 } }));
  const api = new TelegramApi('TOKEN', fetchImpl);
  assert.deepEqual(await api.call('getMe'), { id: 1 });
  assert.equal(fetchImpl.calls[0].url, 'https://api.telegram.org/botTOKEN/getMe');
  assert.equal(fetchImpl.calls[0].init.headers['content-type'], 'application/json');
  await api.call('sendPhoto', { chat_id: 5, reply_markup: { a: 1 } }, { photo: { buffer: Buffer.from('png'), filename: 'f.png' } });
  const body = fetchImpl.calls[1].init.body;
  assert.ok(body instanceof FormData);
  assert.equal(body.get('chat_id'), '5');
  assert.equal(body.get('reply_markup'), '{"a":1}');
  assert.equal(body.get('photo').name, 'f.png');
});

test('TelegramApi surfaces API errors with code and retry_after', async () => {
  const fetchImpl = fakeFetch(() => jsonRes({ ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 3 } }));
  const api = new TelegramApi('TOKEN', fetchImpl);
  await assert.rejects(api.call('sendMessage', {}), (err) => err.code === 429 && err.retryAfter === 3 && /sendMessage: Too Many/.test(err.message));
});

test('UploadStore persists short ids to disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flick-'));
  const file = path.join(dir, 'sub', 'uploads.json');
  const store = new UploadStore(file);
  const id = store.add('AgACAgIAAxkBAAIB', 'cat.flickgame');
  assert.match(id, /^[0-9a-f]{10}$/);
  assert.equal(store.add('AgACAgIAAxkBAAIB', 'cat.flickgame'), id);
  const again = new UploadStore(file);
  assert.deepEqual(again.get(id), { fileId: 'AgACAgIAAxkBAAIB', name: 'cat.flickgame' });
  assert.equal(again.get('nope'), null);
});

function fakeApi() {
  const calls = [];
  return {
    calls,
    async call(method, params, files) {
      calls.push({ method, params, files });
      if (method === 'sendPhoto') return { message_id: 10, chat: { id: params.chat_id } };
      if (method === 'getFile') return { file_path: 'documents/x.flickgame' };
      return true;
    },
    async downloadFileText() { return gameJson; },
  };
}
const quiet = { log() {}, error() {} };

test('bot: /play with a link sends the first frame with a keyboard', async () => {
  const api = fakeApi();
  const bot = createTelegramBot({ token: 't', palettes, loadGame: async () => gameJson, uploadStore: new UploadStore(path.join(os.tmpdir(), 'none.json')), api, log: quiet });
  await bot.handleMessage({ message_id: 1, chat: { id: 42, type: 'group' }, text: `/play https://www.flickgame.org/play.html?p=${ID}` });
  const send = api.calls.find((c) => c.method === 'sendPhoto');
  assert.equal(send.params.chat_id, 42);
  assert.equal(send.params.reply_to_message_id, 1);
  assert.equal(send.files.photo.filename, 'frame-00.png');
  const row = send.params.reply_markup.inline_keyboard[0];
  assert.deepEqual(row.map((b) => b.callback_data), [`g:${ID}:0:7`, `g:${ID}:0:15`, `g:${ID}:0:r`]);
  assert.equal(readPng(send.files.photo.buffer).width, 640);
});

test('bot: ignores plain text in groups, accepts bare links in private chats, usage on bad /play', async () => {
  const api = fakeApi();
  const bot = createTelegramBot({ token: 't', palettes, loadGame: async () => gameJson, uploadStore: new UploadStore(path.join(os.tmpdir(), 'none.json')), api, log: quiet });
  await bot.handleMessage({ message_id: 1, chat: { id: 1, type: 'group' }, text: ID });
  assert.equal(api.calls.length, 0);
  await bot.handleMessage({ message_id: 2, chat: { id: 1, type: 'private' }, text: ID });
  assert.equal(api.calls.at(-1).method, 'sendPhoto');
  await bot.handleMessage({ message_id: 3, chat: { id: 1, type: 'group' }, text: '/play@flickbot nonsense' });
  assert.equal(api.calls.at(-1).method, 'sendMessage');
  assert.equal(api.calls.at(-1).params.text, '/play <flickgame link>');
});

test('bot: a tapped colour edits the photo to the target frame; dead colours only answer', async () => {
  const api = fakeApi();
  const bot = createTelegramBot({ token: 't', palettes, loadGame: async () => gameJson, uploadStore: new UploadStore(path.join(os.tmpdir(), 'none.json')), api, log: quiet });
  const message = { message_id: 10, chat: { id: 42 } };
  await bot.handleCallback({ id: 'cq1', data: `g:${ID}:0:7`, message });
  const edit = api.calls.find((c) => c.method === 'editMessageMedia');
  assert.equal(edit.params.message_id, 10);
  assert.equal(edit.files.photo.filename, 'frame-01.png');
  assert.deepEqual(edit.params.media, { type: 'photo', media: 'attach://photo' });
  assert.equal(api.calls.at(-1).method, 'answerCallbackQuery');
  api.calls.length = 0;
  await bot.handleCallback({ id: 'cq2', data: `g:${ID}:0:0`, message });
  assert.deepEqual(api.calls.map((c) => c.method), ['answerCallbackQuery']);
  await bot.handleCallback({ id: 'cq3', data: `g:${ID}:5:r`, message });
  assert.equal(api.calls.find((c) => c.method === 'editMessageMedia').files.photo.filename, 'frame-00.png');
});

test('bot: an uploaded .flickgame starts a game keyed by a short id', async () => {
  const api = fakeApi();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flick-'));
  const store = new UploadStore(path.join(dir, 'u.json'));
  const bot = createTelegramBot({ token: 't', palettes, loadGame: async () => { throw new Error('no'); }, uploadStore: store, api, log: quiet });
  await bot.handleMessage({ message_id: 7, chat: { id: 9, type: 'group' }, document: { file_id: 'FILE1', file_name: 'cat.flickgame', file_size: 1000 } });
  const send = api.calls.find((c) => c.method === 'sendPhoto');
  const id = UploadStore.shortId('FILE1');
  assert.equal(send.params.reply_markup.inline_keyboard[0][0].callback_data, `f:${id}:0:7`);
  assert.equal(store.get(id).fileId, 'FILE1');
  api.calls.length = 0;
  await bot.handleMessage({ message_id: 8, chat: { id: 9, type: 'group' }, document: { file_id: 'FILE2', file_name: 'notes.html', file_size: 10 } });
  api.downloadFileText = async () => '<html>nope</html>';
  await bot.handleMessage({ message_id: 9, chat: { id: 9, type: 'group' }, document: { file_id: 'FILE3', file_name: 'broken.flickgame', file_size: 10 } });
  assert.deepEqual(api.calls.filter((c) => c.method === 'sendMessage').map((c) => c.params.text), ['❌']);
});
