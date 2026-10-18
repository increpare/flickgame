// Store artwork uses the existing icon and starter games, without new visual decisions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { extractGameText, normalizeGame, framePixels, loadPalettes, resolvePalette } from '../../bots/src/core/flickgame.js';
import { encodeIndexedPng } from '../../bots/src/core/png.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dest = path.join(root, 'android/playstore');
const palettes = loadPalettes(path.join(root, 'palettes'));
const cards = [['cat', 546, 90, 2], ['heart', 842, 55, 1], ['icecream', 842, 253, 1]];
let artwork = '';
for (const [name, x, y, scale] of cards) {
  const game = normalizeGame(extractGameText(fs.readFileSync(path.join(root, 'ios/examples', name + '.flickgame'), 'utf8')));
  const png = encodeIndexedPng(framePixels(game, 0), game.width, game.height, resolvePalette(palettes, game), scale);
  const w = game.width * scale, h = game.height * scale;
  artwork += `<rect x="${x-8}" y="${y-8}" width="${w+16}" height="${h+16}" rx="10" fill="black" stroke="#777" stroke-width="2"/><image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${png.toString('base64')}"/>`;
}
const icon = fs.readFileSync(path.join(root, 'favicon.png')).toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
<rect width="1024" height="500" fill="black"/>
<image x="54" y="84" width="80" height="80" href="data:image/png;base64,${icon}"/>
<text x="50" y="254" font-family="Arial,sans-serif" font-size="68" font-weight="bold" fill="white">Flickgame</text>
<text x="54" y="312" font-family="Arial,sans-serif" font-size="28" fill="#ccc">Draw pictures.</text>
<text x="54" y="352" font-family="Arial,sans-serif" font-size="28" fill="#ccc">Link colours. Make games.</text>
${artwork}</svg>`;
fs.writeFileSync(path.join(dest, 'feature-graphic.svg'), svg);
execFileSync('rsvg-convert', ['-o', path.join(dest, 'feature-graphic.png'), path.join(dest, 'feature-graphic.svg')]);
