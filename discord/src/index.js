import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPalettes } from './flickgame.js';
import { fetchGameJson } from './gist.js';
import { createBot } from './bot.js';

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing ${name}`);
    process.exit(1);
  }
  return v;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const palettesDir = process.env.PALETTES_DIR || path.resolve(here, '../../palettes');
const palettes = loadPalettes(palettesDir);
console.log(`loaded ${Object.keys(palettes).length} palettes from ${palettesDir}`);

const bot = createBot({
  token: need('DISCORD_TOKEN'),
  playChannelId: need('PLAY_CHANNEL_ID'),
  palettes,
  loadGame: (id) => fetchGameJson(id, {
    githubToken: process.env.GITHUB_TOKEN,
    proxyUrl: process.env.GIST_PROXY_URL,
  }),
});

bot.start().catch((err) => {
  console.error('login failed', err.message);
  process.exit(1);
});
