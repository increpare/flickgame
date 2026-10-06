import { Client, GatewayIntentBits, Partials, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { normalizeGame, resolvePalette, linksForFrame, extractGameText } from '../core/flickgame.js';
import { renderFramePng, DEFAULT_SCALE } from '../core/render.js';
import { gistIdFromText } from '../core/gist.js';
import { EmojiStore, hexFromEmojiName } from './emoji.js';
import { SessionStore, RESET_EMOJI, playLinkLine, frameFileName, recoverSessionInfo } from './session.js';
import { pickGameAttachment, fetchAttachmentText } from '../core/upload.js';

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

export const PLAY_COMMAND = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a flickgame here')
  .addStringOption((o) => o.setName('link').setDescription('flickgame link or gist id').setRequired(true));

export function createBot({ token, palettes, loadGame, scale = DEFAULT_SCALE }) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, // needed to see attachments on uploads
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.Channel],
  });
  const sessions = new SessionStore();
  const allHexes = [...new Set(Object.values(palettes).flat().map((h) => h.toLowerCase()))];
  let emojiStore = null;
  let emojiReady = null;

  // loadText yields the game JSON text; gistId is null for uploaded files.
  async function buildSession(loadText, gistId, frame = 0) {
    const game = normalizeGame(await loadText());
    const palette = resolvePalette(palettes, game);
    await emojiReady;
    await emojiStore.ensure(palette);
    return { gistId, game, palette, frame, busy: false };
  }

  async function sessionFromUpload(message, frame = 0) {
    const pick = pickGameAttachment(message.attachments.values());
    if (!pick) return null;
    const text = await fetchAttachmentText(pick.attachment);
    return buildSession(() => extractGameText(text), null, frame);
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
      content: session.gistId ? playLinkLine(session.gistId) : '',
      files: [{ attachment: png, name: frameFileName(session.frame) }],
    };
  }

  async function showFrame(message, session) {
    await message.reactions.removeAll();
    await message.edit({ ...payload(session), attachments: [] });
    await addReactions(message, session);
  }

  async function registerCommands(guild) {
    try {
      await guild.commands.set([PLAY_COMMAND.toJSON()]);
    } catch (err) {
      console.error('command registration failed for', guild.name, err.message);
    }
  }

  client.once('clientReady', () => {
    for (const guild of client.guilds.cache.values()) registerCommands(guild);
    emojiStore = new EmojiStore(client.application.emojis);
    emojiReady = emojiStore.load().then(() => {
      console.log(`ready as ${client.user.tag}; ${emojiStore.size} swatches known`);
      emojiStore.ensure(allHexes)
        .then(() => console.log(`swatch sync done: ${emojiStore.size}`))
        .catch((err) => console.error('swatch sync failed', err.message));
    });
  });

  client.on('guildCreate', (guild) => registerCommands(guild));

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'play') return;
    const gistId = gistIdFromText(interaction.options.getString('link', true));
    if (!gistId) {
      await interaction.reply({ content: '❌', flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }
    try {
      await interaction.deferReply();
      const session = await buildSession(() => loadGame(gistId), gistId);
      const posted = await interaction.editReply(payload(session));
      sessions.set(posted.id, session);
      await addReactions(posted, session);
    } catch (err) {
      console.error('load failed', gistId, err.message);
      await interaction.editReply({ content: '❌' }).catch(() => {});
    }
  });

  // Uploaded .flickgame / standalone .html / game .txt or .json files.
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const pick = pickGameAttachment(message.attachments.values());
    if (!pick) return;
    let session;
    try {
      session = await sessionFromUpload(message);
    } catch (err) {
      if (pick.strict) {
        console.error('upload failed', pick.attachment.name, err.message);
        message.react('❌').catch(() => {});
      }
      return;
    }
    try {
      const posted = await message.reply({ ...payload(session), allowedMentions: { repliedUser: false } });
      sessions.set(posted.id, session);
      await addReactions(posted, session);
    } catch (err) {
      console.error('upload reply failed', err.message);
    }
  });

  client.on('messageReactionAdd', async (reaction, user) => {
    try {
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch();
      const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
      if (message.author?.id !== client.user.id) return;

      let session = sessions.get(message.id);
      if (!session) {
        const info = recoverSessionInfo(message);
        if (!info) return;
        if (info.gistId) {
          session = await buildSession(() => loadGame(info.gistId), info.gistId, info.frame);
        } else if (message.reference?.messageId) {
          const original = await message.channel.messages.fetch(message.reference.messageId);
          session = await sessionFromUpload(original, info.frame);
        }
        if (!session) return;
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
