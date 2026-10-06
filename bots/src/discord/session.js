import { gistIdFromText } from '../core/gist.js';

export const RESET_EMOJI = '🔄';
export const PLAY_BASE = 'https://www.flickgame.org/play.html?p=';
const MAX_SESSIONS = 500;
const FILE_RE = /^frame-(\d{2})\.png$/;

export function playLinkLine(gistId) {
  return `<${PLAY_BASE}${gistId}>`;
}

export function frameFileName(frame) {
  return `frame-${String(frame).padStart(2, '0')}.png`;
}

// A bot message carries its own state: the attachment name holds the frame,
// and the link line names the gist (null for games that came from an
// uploaded file, which are recovered from the message the bot replied to).
// Returns null if the message is not a game message at all.
export function recoverSessionInfo(message) {
  let frame = null;
  for (const a of message.attachments.values()) {
    const m = FILE_RE.exec(a.name || '');
    if (m) frame = Math.min(Number(m[1]), 15);
  }
  if (frame === null) return null;
  return { gistId: gistIdFromText(message.content || ''), frame };
}

export class SessionStore {
  constructor() { this.map = new Map(); }
  get(messageId) { return this.map.get(messageId); }
  set(messageId, session) {
    this.map.set(messageId, session);
    if (this.map.size > MAX_SESSIONS) this.map.delete(this.map.keys().next().value);
  }
}
