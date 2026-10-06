import { framePixels } from './flickgame.js';
import { encodeIndexedPng } from './png.js';
import { prefersDarkText } from './color.js';

export const DEFAULT_SCALE = 4;

export function renderFramePng(game, palette, frame, scale = DEFAULT_SCALE) {
  return encodeIndexedPng(framePixels(game, frame), game.width, game.height, palette, scale);
}

// 3x5 pixel digits, one string per row.
const DIGITS = {
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '###', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '..#', '..#', '..#'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
};

export const LEGEND = { swatchW: 14, swatchH: 10, gap: 2, margin: 2 };

// Geometry of the legend strip for n swatches on a game `width` wide.
export function legendLayout(width, n) {
  const { swatchW, gap, margin, swatchH } = LEGEND;
  const perRow = Math.max(1, Math.floor((width - margin) / (swatchW + gap)));
  const rows = n === 0 ? 0 : Math.ceil(n / perRow);
  const height = rows === 0 ? 0 : margin + rows * (swatchH + gap);
  return { perRow, rows, height };
}

function drawDigits(indices, W, x, y, text, colorIndex) {
  let cx = x;
  for (const ch of String(text)) {
    const glyph = DIGITS[ch];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (glyph[r][c] === '#') indices[(y + r) * W + cx + c] = colorIndex;
      }
    }
    cx += 4;
  }
}

// The frame with a strip underneath: one numbered swatch per entry of
// `legendColorIndices` (1-based numbers, in order), on the game's background.
export function renderFrameWithLegendPng(game, palette, frame, legendColorIndices, scale = DEFAULT_SCALE) {
  const W = game.width;
  const layout = legendLayout(W, legendColorIndices.length);
  const H = game.height + layout.height;
  const extended = [...palette, game.backgroundColor || '#000000', '#000000', '#ffffff'];
  const BG = palette.length; const BLACK = palette.length + 1; const WHITE = palette.length + 2;

  const indices = new Uint8Array(W * H);
  indices.set(framePixels(game, frame), 0);
  indices.fill(BG, W * game.height);

  const { swatchW, swatchH, gap, margin } = LEGEND;
  legendColorIndices.forEach((colorIndex, i) => {
    const row = Math.floor(i / layout.perRow);
    const col = i % layout.perRow;
    const x0 = margin + col * (swatchW + gap);
    const y0 = game.height + margin + row * (swatchH + gap);
    for (let y = y0; y < y0 + swatchH; y++) indices.fill(colorIndex, y * W + x0, y * W + x0 + swatchW);
    const label = String(i + 1);
    const textW = label.length * 4 - 1;
    const ink = prefersDarkText(palette[colorIndex] || '#000000') ? BLACK : WHITE;
    drawDigits(indices, W, x0 + Math.floor((swatchW - textW) / 2), y0 + 2, label, ink);
  });

  return encodeIndexedPng(indices, W, H, extended, scale);
}
