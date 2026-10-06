import test from 'node:test';
import assert from 'node:assert/strict';
import { playLinkLine, frameFileName, recoverSessionInfo, SessionStore, RESET_EMOJI } from '../src/discord/session.js';

const ID = '9dad50f8a7a20878adaca64febc32b62';

test('message text and file name carry the state', () => {
  assert.equal(playLinkLine(ID), `<https://www.flickgame.org/play.html?p=${ID}>`);
  assert.equal(frameFileName(0), 'frame-00.png');
  assert.equal(frameFileName(12), 'frame-12.png');
  assert.equal(RESET_EMOJI, '🔄');
});

test('recoverSessionInfo rebuilds gist id and frame from a bot message', () => {
  const message = {
    content: playLinkLine(ID),
    attachments: new Map([['a1', { name: 'frame-07.png' }]]),
  };
  assert.deepEqual(recoverSessionInfo(message), { gistId: ID, frame: 7 });
  // uploaded-file games have no link line; the frame file alone marks a game message
  assert.deepEqual(recoverSessionInfo({ content: '', attachments: new Map([['a', { name: 'frame-02.png' }]]) }), { gistId: null, frame: 2 });
  assert.equal(recoverSessionInfo({ content: playLinkLine(ID), attachments: new Map() }), null);
  assert.equal(recoverSessionInfo({ content: 'hello', attachments: new Map() }), null);
});

test('SessionStore evicts the oldest entry past 500', () => {
  const store = new SessionStore();
  for (let i = 0; i < 501; i++) store.set(String(i), { frame: i });
  assert.equal(store.get('0'), undefined);
  assert.deepEqual(store.get('500'), { frame: 500 });
  assert.deepEqual(store.get('1'), { frame: 1 });
});
