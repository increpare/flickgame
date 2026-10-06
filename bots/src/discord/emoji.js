import { encodeIndexedPng } from '../core/png.js';

const NAME_RE = /^c_([0-9a-f]{6})$/;
const SWATCH_SIZE = 128;
const SWATCH_PIXELS = new Uint8Array(SWATCH_SIZE * SWATCH_SIZE);

export function emojiNameForHex(hex) {
  return 'c_' + String(hex).slice(1).toLowerCase();
}

export function hexFromEmojiName(name) {
  const m = NAME_RE.exec(String(name || ''));
  return m ? '#' + m[1] : null;
}

export function swatchPng(hex) {
  return encodeIndexedPng(SWATCH_PIXELS, SWATCH_SIZE, SWATCH_SIZE, [hex.toLowerCase()], 1);
}

// Keeps one application-owned emoji per distinct palette colour.
// `manager` is discord.js's client.application.emojis (or a fake in tests).
export class EmojiStore {
  constructor(manager) {
    this.manager = manager;
    this.byHex = new Map();
  }

  get size() { return this.byHex.size; }

  async load() {
    const all = await this.manager.fetch();
    for (const e of all.values()) {
      const hex = hexFromEmojiName(e.name);
      if (hex) this.byHex.set(hex, { id: e.id, name: e.name });
    }
  }

  async ensure(hexes) {
    for (const raw of hexes) {
      const hex = raw.toLowerCase();
      if (this.byHex.has(hex)) continue;
      const e = await this.manager.create({ attachment: swatchPng(hex), name: emojiNameForHex(hex) });
      this.byHex.set(hex, { id: e.id, name: e.name });
    }
  }

  reactionString(hex) {
    const e = this.byHex.get(String(hex).toLowerCase());
    return e ? `<:${e.name}:${e.id}>` : null;
  }
}
