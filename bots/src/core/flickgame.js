import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_PALETTE = 'dawnbringer-16';
const MAX_DIM = 1024;

// Port of RLE_decode from flickgame_base.js, returning palette indices.
// Run counts come from an untrusted file, so the output is bounded and padded.
export function rleDecode(encoded, targetLength) {
  if (!Array.isArray(encoded)) encoded = [];
  const limit = Number.isFinite(targetLength) && targetLength >= 0 ? targetLength : 0;
  const out = new Uint8Array(limit);
  let n = 0;
  for (let i = 0; i + 1 < encoded.length && n < limit; i += 2) {
    let count = Number(encoded[i]);
    if (!Number.isFinite(count) || count < 1) continue;
    if (count > limit - n) count = limit - n;
    const value = parseInt(encoded[i + 1], 16);
    const v = value >= 0 && value < 16 ? value : 0;
    for (let j = 0; j < count; j++) out[n++] = v;
  }
  return out;
}

export function parsePaletteText(text) {
  return String(text)
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith(';'))
    .map((l) => l.slice(2).toLowerCase())
    .filter((hex) => /^[0-9a-f]{6}$/.test(hex))
    .map((hex) => '#' + hex);
}

export function loadPalettes(dir) {
  const palettes = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.txt')) continue;
    palettes[file.slice(0, -4)] = parsePaletteText(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  return palettes;
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) return fallback;
  return Math.min(Math.floor(n), max);
}

export function normalizeGame(json) {
  const g = typeof json === 'string' ? JSON.parse(json) : json;
  if (!g || typeof g !== 'object' || Array.isArray(g)) throw new Error('not a flickgame');
  const width = clampInt(g.width, 1, MAX_DIM, 160);
  const height = clampInt(g.height, 1, MAX_DIM, 100);
  const paletteName = typeof g.palette_name === 'string' ? g.palette_name : DEFAULT_PALETTE;
  const canvasses = Array.isArray(g.canvasses) ? g.canvasses : [];
  const backgroundColor = typeof g.background_color === 'string' && /^#[0-9a-f]{6}$/i.test(g.background_color)
    ? g.background_color.toLowerCase() : '#000000';
  const hyperlinks = [];
  for (let f = 0; f < 16; f++) {
    const row = Array.isArray(g.hyperlinks) && Array.isArray(g.hyperlinks[f]) ? g.hyperlinks[f] : [];
    hyperlinks.push(Array.from({ length: 16 }, (_, c) => {
      const t = Number(row[c]);
      return Number.isInteger(t) && t >= 1 && t <= 16 ? t : 0;
    }));
  }
  return { width, height, paletteName, backgroundColor, canvasses, hyperlinks };
}

export function resolvePalette(palettes, game) {
  return palettes[game.paletteName] || palettes[DEFAULT_PALETTE];
}

export function framePixels(game, frame) {
  return rleDecode(game.canvasses[frame], game.width * game.height);
}

export function linksForFrame(game, frame) {
  const row = game.hyperlinks[frame] || [];
  const out = [];
  for (let c = 0; c < 16; c++) {
    if (row[c] > 0) out.push({ colorIndex: c, target: row[c] - 1 });
  }
  return out;
}

// Port of FlickgameShare.extractStateFromImportText: accepts a standalone
// flickgame .html/.flickgame file (JSON embedded between marker comments,
// URI-encoded) or a plain game JSON file. Returns the game JSON text.
export function extractGameText(text) {
  const s = String(text);
  const from = '<!--__EmbedBegin__-->';
  const end = '<!--__EmbedEnd__-->';
  const a = s.indexOf(from);
  const b = s.indexOf(end);
  if (a >= 0 && b > a) {
    const inner = s.slice(a + from.length, b);
    const q1 = inner.indexOf('"');
    if (q1 < 0) throw new Error('embedded flickgame data is malformed');
    const decoded = decodeURI(inner.slice(q1 + 1));
    const q2 = decoded.lastIndexOf('"');
    if (q2 < 0) throw new Error('embedded flickgame data is malformed');
    return decoded.slice(0, q2);
  }
  const parsed = JSON.parse(s);
  if (!parsed || typeof parsed !== 'object' || !parsed.canvasses || !parsed.hyperlinks) {
    throw new Error('not a flickgame');
  }
  return s;
}
