import { nearestSquare } from '../core/color.js';

export const RESET = 'r';
const MAX_PER_ROW = 8;
const DATA_RE = /^([gf]):([0-9a-f]{1,48}):(\d{1,2}):(\d{1,2}|r)$/;

// Callback data carries the whole game state, so the bot stays stateless:
// kind g = gist id, f = uploaded-file short id; colour is an index or 'r'.
export function encodeCallback(kind, id, frame, colour) {
  const data = `${kind}:${id}:${frame}:${colour}`;
  if (data.length > 64) throw new Error('callback data too long');
  return data;
}

export function decodeCallback(data) {
  const m = DATA_RE.exec(String(data || ''));
  if (!m) return null;
  const frame = Number(m[3]);
  if (frame > 15) return null;
  const colour = m[4] === RESET ? RESET : Number(m[4]);
  if (colour !== RESET && colour > 15) return null;
  return { kind: m[1], id: m[2], frame, colour };
}

// links: [{ colorIndex }] in legend order; buttons are numbered to match.
export function buildKeyboard({ kind, id, frame, links, palette }) {
  const buttons = links.map(({ colorIndex }, i) => ({
    text: `${i + 1} ${nearestSquare(palette[colorIndex] || '#000000')}`,
    callback_data: encodeCallback(kind, id, frame, colorIndex),
  }));
  buttons.push({ text: '🔄', callback_data: encodeCallback(kind, id, frame, RESET) });
  const rows = [];
  for (let i = 0; i < buttons.length; i += MAX_PER_ROW) rows.push(buttons.slice(i, i + MAX_PER_ROW));
  return { inline_keyboard: rows };
}
