import { gistIdFromText } from './gist.js';

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

// A bot message carries its own state: the link line names the game and the
// attachment name holds the frame, so sessions survive restarts.
export function recoverSessionInfo(message) {
  const gistId = gistIdFromText(message.content || '');
  if (!gistId) return null;
  let frame = 0;
  for (const a of message.attachments.values()) {
    const m = FILE_RE.exec(a.name || '');
    if (m) frame = Math.min(Number(m[1]), 15);
  }
  return { gistId, frame };
}

export class SessionStore {
  constructor() { this.map = new Map(); }
  get(messageId) { return this.map.get(messageId); }
  set(messageId, session) {
    this.map.set(messageId, session);
    if (this.map.size > MAX_SESSIONS) this.map.delete(this.map.keys().next().value);
  }
}
