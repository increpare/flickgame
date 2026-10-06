import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractGameText, normalizeGame } from '../src/core/flickgame.js';
import { pickGameAttachment, fetchAttachmentText, MAX_FILE_BYTES } from '../src/core/upload.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gameJson = fs.readFileSync(path.join(repoRoot, 'testgame.txt'), 'utf8');

function standaloneHtml(stateString) {
  const html = fs.readFileSync(path.join(repoRoot, 'play.html'), 'utf8');
  return '<!--Save as html file-->\n ' + html.split('__EMBED__').join(encodeURI(stateString));
}

test('extractGameText reads the JSON embedded in a standalone .flickgame/.html export', () => {
  const text = extractGameText(standaloneHtml(gameJson));
  assert.equal(text, gameJson);
  assert.equal(normalizeGame(text).height, 155);
});

test('extractGameText accepts plain game JSON and rejects other text', () => {
  assert.equal(extractGameText(gameJson), gameJson);
  assert.throws(() => extractGameText('<html><body>hello</body></html>'));
  assert.throws(() => extractGameText('{"foo":1}'), /not a flickgame/);
  assert.throws(() => extractGameText('not json at all'));
});

test('extractGameText rejects an unfilled play.html template', () => {
  const html = fs.readFileSync(path.join(repoRoot, 'play.html'), 'utf8');
  assert.throws(() => normalizeGame(extractGameText(html)));
});

test('pickGameAttachment picks game-like files and flags .flickgame as strict', () => {
  const atts = new Map([
    ['1', { name: 'photo.png', size: 100, url: 'u1' }],
    ['2', { name: 'huge.flickgame', size: MAX_FILE_BYTES + 1, url: 'u2' }],
    ['3', { name: 'Cat Game.FLICKGAME', size: 5000, url: 'u3' }],
    ['4', { name: 'other.html', size: 10, url: 'u4' }],
  ]);
  const pick = pickGameAttachment(atts.values());
  assert.equal(pick.attachment.url, 'u3');
  assert.equal(pick.strict, true);
  const html = pickGameAttachment([{ name: 'index.html', size: 10, url: 'u' }]);
  assert.equal(html.strict, false);
  assert.equal(pickGameAttachment([{ name: 'a.png', size: 1, url: 'u' }]), null);
  assert.equal(pickGameAttachment([]), null);
});

test('fetchAttachmentText downloads the attachment and surfaces HTTP errors', async () => {
  const ok = async (url) => ({ ok: true, status: 200, text: async () => `body of ${url}` });
  assert.equal(await fetchAttachmentText({ url: 'https://cdn/x' }, ok), 'body of https://cdn/x');
  const bad = async () => ({ ok: false, status: 404 });
  await assert.rejects(fetchAttachmentText({ url: 'u' }, bad), /attachment 404/);
});
