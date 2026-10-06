import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPalettes } from '../core/flickgame.js';
import { fetchGameJson } from '../core/gist.js';
import { UploadStore } from './uploads.js';
import { createTelegramBot } from './bot.js';

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing ${name}`);
    process.exit(1);
  }
  return v;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const palettesDir = process.env.PALETTES_DIR || path.resolve(here, '../../../palettes');
const palettes = loadPalettes(palettesDir);
console.log(`loaded ${Object.keys(palettes).length} palettes from ${palettesDir}`);

const bot = createTelegramBot({
  token: need('TELEGRAM_TOKEN'),
  palettes,
  loadGame: (id) => fetchGameJson(id, {
    githubToken: process.env.GITHUB_TOKEN,
    proxyUrl: process.env.GIST_PROXY_URL,
  }),
  uploadStore: new UploadStore(process.env.TELEGRAM_UPLOADS || path.resolve(here, '../../data/telegram-uploads.json')),
});

bot.start().catch((err) => {
  console.error('telegram start failed', err.message);
  process.exit(1);
});
