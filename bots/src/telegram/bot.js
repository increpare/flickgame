import { normalizeGame, resolvePalette, linksForFrame, extractGameText } from '../core/flickgame.js';
import { renderFrameWithLegendPng, DEFAULT_SCALE } from '../core/render.js';
import { gistIdFromText } from '../core/gist.js';
import { pickGameAttachment } from '../core/upload.js';
import { TelegramApi } from './tg.js';
import { buildKeyboard, decodeCallback, RESET } from './keyboard.js';

const CACHE_MAX = 200;
const COMMAND_RE = /^\/play(?:@\w+)?(?:\s+(.*))?$/s;
const USAGE = '/play <flickgame link>';

export function createTelegramBot({ token, palettes, loadGame, uploadStore, api, scale = DEFAULT_SCALE, log = console }) {
  api = api || new TelegramApi(token);
  const cache = new Map(); // key -> { game, palette }

  function remember(key, entry) {
    cache.set(key, entry);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    return entry;
  }

  function prepare(text) {
    const game = normalizeGame(text);
    return { game, palette: resolvePalette(palettes, game) };
  }

  async function loadByKey(kind, id) {
    const key = `${kind}:${id}`;
    if (cache.has(key)) return cache.get(key);
    if (kind === 'g') return remember(key, prepare(await loadGame(id)));
    const rec = uploadStore.get(id);
    if (!rec) throw new Error('unknown upload');
    return remember(key, prepare(extractGameText(await api.downloadFileText(rec.fileId))));
  }

  function framePayload(kind, id, { game, palette }, frame) {
    const links = linksForFrame(game, frame);
    const png = renderFrameWithLegendPng(game, palette, frame, links.map((l) => l.colorIndex), scale);
    const reply_markup = buildKeyboard({ kind, id, frame, links, palette });
    return { png, reply_markup, filename: `frame-${String(frame).padStart(2, '0')}.png` };
  }

  async function startGame(chatId, replyToMessageId, kind, id) {
    const entry = await loadByKey(kind, id);
    const { png, reply_markup, filename } = framePayload(kind, id, entry, 0);
    await api.call('sendPhoto', {
      chat_id: chatId,
      reply_to_message_id: replyToMessageId,
      allow_sending_without_reply: true,
      reply_markup,
    }, { photo: { buffer: png, filename } });
  }

  async function fail(chatId, replyToMessageId, text = '❌') {
    await api.call('sendMessage', {
      chat_id: chatId, reply_to_message_id: replyToMessageId, allow_sending_without_reply: true, text,
    }).catch(() => {});
  }

  async function handleMessage(msg) {
    const chatId = msg.chat.id;
    if (msg.document) {
      const doc = msg.document;
      const pick = pickGameAttachment([{ name: doc.file_name, size: doc.file_size }]);
      if (!pick) return;
      let id;
      try {
        const entry = prepare(extractGameText(await api.downloadFileText(doc.file_id)));
        id = uploadStore.add(doc.file_id, doc.file_name);
        remember(`f:${id}`, entry);
      } catch (err) {
        if (pick.strict) {
          log.error('upload failed', doc.file_name, err.message);
          await fail(chatId, msg.message_id);
        }
        return;
      }
      await startGame(chatId, msg.message_id, 'f', id);
      return;
    }

    const text = msg.text || '';
    const cmd = COMMAND_RE.exec(text);
    const isPrivate = msg.chat.type === 'private';
    if (!cmd && !isPrivate) return;
    if (/^\/start(?:@\w+)?$/.test(text)) {
      await api.call('sendMessage', { chat_id: chatId, text: USAGE });
      return;
    }
    const arg = cmd ? (cmd[1] || '') : text;
    const gistId = gistIdFromText(arg);
    if (!gistId) {
      if (cmd) await fail(chatId, msg.message_id, USAGE);
      return;
    }
    try {
      await startGame(chatId, msg.message_id, 'g', gistId);
    } catch (err) {
      log.error('load failed', gistId, err.message);
      await fail(chatId, msg.message_id);
    }
  }

  const busy = new Set(); // "chatId:messageId" with an edit in flight
  const seen = new Map(); // callback ids answered recently, to drop client retries

  function alreadySeen(id) {
    const now = Date.now();
    for (const [k, t] of seen) if (now - t > 60000) seen.delete(k);
    if (seen.has(id)) return true;
    seen.set(id, now);
    return false;
  }

  async function handleCallback(cq) {
    if (alreadySeen(cq.id)) return;
    // Answer first: the client stops its spinner and will not retry the tap.
    api.call('answerCallbackQuery', { callback_query_id: cq.id }).catch(() => {});
    const data = decodeCallback(cq.data);
    if (!data || !cq.message) return;
    const key = `${cq.message.chat.id}:${cq.message.message_id}`;
    if (busy.has(key)) return; // a move is already being drawn; ignore extra taps
    busy.add(key);
    const started = Date.now();
    try {
      const entry = await loadByKey(data.kind, data.id);
      let next = 0;
      if (data.colour !== RESET) {
        const target = entry.game.hyperlinks[data.frame][data.colour];
        if (!(target > 0)) return;
        next = target - 1;
      }
      const { png, reply_markup, filename } = framePayload(data.kind, data.id, entry, next);
      await api.call('editMessageMedia', {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        media: { type: 'photo', media: 'attach://photo' },
        reply_markup,
      }, { photo: { buffer: png, filename } });
      log.log(`move ${cq.data} -> frame ${next} in ${Date.now() - started} ms (${png.length} bytes)`);
    } catch (err) {
      if (!/not modified/i.test(err.message)) log.error('callback failed', cq.data, err.message, `after ${Date.now() - started} ms`);
    } finally {
      busy.delete(key);
    }
  }

  async function handleUpdate(update) {
    try {
      if (update.message) await handleMessage(update.message);
      else if (update.callback_query) await handleCallback(update.callback_query);
    } catch (err) {
      log.error('update failed', err.message);
    }
  }

  let running = false;
  async function poll() {
    let offset = 0;
    let backoff = 1000;
    while (running) {
      try {
        const updates = await api.call('getUpdates', {
          offset, timeout: 50, allowed_updates: ['message', 'callback_query'],
        });
        backoff = 1000;
        for (const u of updates) {
          offset = u.update_id + 1;
          handleUpdate(u); // not awaited: one slow game must not block the rest
        }
      } catch (err) {
        log.error('poll failed', err.message);
        await new Promise((r) => setTimeout(r, backoff));
        backoff = Math.min(backoff * 2, 30000);
      }
    }
  }

  async function start() {
    const me = await api.call('getMe');
    await api.call('setMyCommands', { commands: [{ command: 'play', description: 'play a flickgame link' }] }).catch(() => {});
    log.log(`telegram ready as @${me.username}`);
    running = true;
    poll();
  }

  return { start, stop: () => { running = false; }, handleMessage, handleCallback, handleUpdate };
}
