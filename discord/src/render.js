import { framePixels } from './flickgame.js';
import { encodeIndexedPng } from './png.js';

export const DEFAULT_SCALE = 4;

export function renderFramePng(game, palette, frame, scale = DEFAULT_SCALE) {
  return encodeIndexedPng(framePixels(game, frame), game.width, game.height, palette, scale);
}
