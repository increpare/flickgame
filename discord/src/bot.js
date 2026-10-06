import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { normalizeGame, resolvePalette, linksForFrame } from './flickgame.js';
import { renderFramePng, DEFAULT_SCALE } from './render.js';
import { gistIdFromText } from './gist.js';
import { EmojiStore, hexFromEmojiName } from './emoji.js';
import { SessionStore, RESET_EMOJI, playLinkLine, frameFileName, recoverSessionInfo } from './session.js';

// Which frame a reaction leads to, or null if it does nothing.
export function nextFrame(session, emojiName) {
  if (emojiName === RESET_EMOJI) return 0;
  const hex = hexFromEmojiName(emojiName);
  if (!hex) return null;
  const colorIndex = session.palette.findIndex((p) => p.toLowerCase() === hex);
  if (colorIndex < 0) return null;
  const target = session.game.hyperlinks[session.frame][colorIndex];
  return target > 0 ? target - 1 : null;
}

export function reactionsForFrame(session, emojiStore) {
  const out = [];
  for (const { colorIndex } of linksForFrame(session.game, session.frame)) {
    const r = emojiStore.reactionString(session.palette[colorIndex]);
    if (r && !out.includes(r)) out.push(r);
  }
  out.push(RESET_EMOJI);
  return out;
}

export function createBot({ token, playChannelId, palettes, loadGame, scale = DEFAULT_SCALE }) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.Channel],
  });
  const sessions = new SessionStore();
  const allHexes = [...new Set(Object.values(palettes).flat().map((h) => h.toLowerCase()))];
  let emojiStore = null;
  let emojiReady = null;

  async function buildSession(gistId, frame = 0) {
    const game = normalizeGame(await loadGame(gistId));
    const palette = resolvePalette(palettes, game);
    await emojiReady;
    await emojiStore.ensure(palette);
    return { gistId, game, palette, frame, busy: false };
  }

  async function addReactions(message, session) {
    for (const r of reactionsForFrame(session, emojiStore)) {
      try {
        await message.react(r);
      } catch (err) {
        console.error('react failed', r, err.message);
      }
    }
  }

  function payload(session) {
    const png = renderFramePng(session.game, session.palette, session.frame, scale);
    return {
      content: playLinkLine(session.gistId),
      files: [{ attachment: png, name: frameFileName(session.frame) }],
    };
  }

  async function postNew(userMessage, session) {
    const posted = await userMessage.reply({ ...payload(session), allowedMentions: { repliedUser: false } });
    sessions.set(posted.id, session);
    await addReactions(posted, session);
    return posted;
  }

  async function showFrame(message, session) {
    await message.reactions.removeAll();
    await message.edit({ ...payload(session), attachments: [] });
    await addReactions(message, session);
  }

  client.once('clientReady', () => {
    emojiStore = new EmojiStore(client.application.emojis);
    emojiReady = emojiStore.load().then(() => {
      console.log(`ready as ${client.user.tag}; ${emojiStore.size} swatches known`);
      emojiStore.ensure(allHexes)
        .then(() => console.log(`swatch sync done: ${emojiStore.size}`))
        .catch((err) => console.error('swatch sync failed', err.message));
    });
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channelId !== playChannelId) return;
    const gistId = gistIdFromText(message.content);
    if (!gistId) return;
    try {
      await postNew(message, await buildSession(gistId));
    } catch (err) {
      console.error('load failed', gistId, err.message);
      message.react('❌').catch(() => {});
    }
  });

  client.on('messageReactionAdd', async (reaction, user) => {
    try {
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch();
      const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
      if (message.channelId !== playChannelId || message.author?.id !== client.user.id) return;

      let session = sessions.get(message.id);
      if (!session) {
        const info = recoverSessionInfo(message);
        if (!info) return;
        session = await buildSession(info.gistId, info.frame);
        sessions.set(message.id, session);
      }

      const next = nextFrame(session, reaction.emoji.name);
      if (next === null || session.busy) {
        await reaction.users.remove(user.id).catch(() => {});
        return;
      }
      session.busy = true;
      try {
        session.frame = next;
        await showFrame(message, session);
      } finally {
        session.busy = false;
      }
    } catch (err) {
      console.error('reaction failed', err.message);
    }
  });

  client.on('error', (err) => console.error('client error', err.message));

  return { client, sessions, start: () => client.login(token) };
}
