import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  rleDecode, parsePaletteText, loadPalettes, normalizeGame,
  resolvePalette, framePixels, linksForFrame,
} from '../src/core/flickgame.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

test('rleDecode expands runs and pads to the target length', () => {
  assert.deepEqual([...rleDecode([2, 'a', 1, '3'], 5)], [10, 10, 3, 0, 0]);
});

test('rleDecode clamps oversized runs and treats bad digits as 0', () => {
  assert.deepEqual([...rleDecode([99, 'f'], 3)], [15, 15, 15]);
  assert.deepEqual([...rleDecode([2, 'zz', 1, 'b'], 3)], [0, 0, 11]);
  assert.deepEqual([...rleDecode(null, 2)], [0, 0]);
  assert.deepEqual([...rleDecode([0, 'a', -1, 'b', 'x', 'c', 1, 'd'], 2)], [13, 0]);
});

test('parsePaletteText reads paint.net palettes', () => {
  const text = ';paint.net Palette File\r\n;Colors: 2\r\nFF202020\r\nFFE89F6E\r\n\r\nbadline\r\n';
  assert.deepEqual(parsePaletteText(text), ['#202020', '#e89f6e']);
});

test('loadPalettes reads the repo palettes', () => {
  const palettes = loadPalettes(path.join(repoRoot, 'palettes'));
  assert.equal(palettes['dawnbringer-16'].length, 16);
  assert.ok(Object.keys(palettes).length >= 30);
  for (const cols of Object.values(palettes)) {
    for (const c of cols) assert.match(c, /^#[0-9a-f]{6}$/);
  }
});

test('normalizeGame applies defaults and sanitises hyperlinks', () => {
  const g = normalizeGame('{"canvasses":[],"hyperlinks":[[0,"3",17,-1,2.5]]}');
  assert.equal(g.width, 160);
  assert.equal(g.height, 100);
  assert.equal(g.paletteName, 'dawnbringer-16');
  assert.equal(g.backgroundColor, '#000000');
  assert.equal(normalizeGame({ background_color: '#ABCDEF' }).backgroundColor, '#abcdef');
  assert.equal(g.hyperlinks.length, 16);
  assert.deepEqual(g.hyperlinks[0], [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(g.hyperlinks[15], new Array(16).fill(0));
});

test('normalizeGame clamps absurd dimensions and rejects non-objects', () => {
  const g = normalizeGame({ width: 99999, height: 0 });
  assert.equal(g.width, 1024);
  assert.equal(g.height, 100);
  assert.throws(() => normalizeGame('[]'));
  assert.throws(() => normalizeGame('"hi"'));
});

test('testgame.txt parses, renders a frame and lists its links', () => {
  const palettes = loadPalettes(path.join(repoRoot, 'palettes'));
  const game = normalizeGame(fs.readFileSync(path.join(repoRoot, 'testgame.txt'), 'utf8'));
  assert.equal(game.width, 160);
  assert.equal(game.height, 155);
  assert.equal(resolvePalette(palettes, game), palettes['daylight-16']);
  const px = framePixels(game, 0);
  assert.equal(px.length, 160 * 155);
  assert.ok(px.every((v) => v >= 0 && v < 16));
  assert.deepEqual(linksForFrame(game, 0), [
    { colorIndex: 7, target: 1 },
    { colorIndex: 15, target: 1 },
  ]);
  assert.deepEqual(linksForFrame(game, 11), [{ colorIndex: 12, target: 12 }]);
});

test('resolvePalette falls back to dawnbringer-16', () => {
  const palettes = { 'dawnbringer-16': ['#000000'], other: ['#ffffff'] };
  assert.equal(resolvePalette(palettes, { paletteName: 'nope' }), palettes['dawnbringer-16']);
  assert.equal(resolvePalette(palettes, { paletteName: 'other' }), palettes.other);
});
