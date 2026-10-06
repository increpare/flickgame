import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPalettes, normalizeGame, resolvePalette } from '../src/flickgame.js';
import { renderFramePng } from '../src/render.js';
import { readPng } from './helpers/readPng.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('renders testgame frame 0 at 4x with its palette', () => {
  const palettes = loadPalettes(path.join(repoRoot, 'palettes'));
  const game = normalizeGame(fs.readFileSync(path.join(repoRoot, 'testgame.txt'), 'utf8'));
  const palette = resolvePalette(palettes, game);
  const png = renderFramePng(game, palette, 0);
  const img = readPng(png);
  assert.equal(img.width, 640);
  assert.equal(img.height, 620);
  assert.deepEqual(img.palette, palette);
  assert.ok(png.length < 60_000, `png is ${png.length} bytes`);
  fs.mkdirSync(path.join(repoRoot, 'discord/test/out'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'discord/test/out/testgame-frame-00.png'), png);
});
