import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFrame, reactionsForFrame } from '../src/bot.js';
import { RESET_EMOJI } from '../src/session.js';

const palette = ['#000000', '#111111', '#222222', '#333333'];
const game = {
  hyperlinks: [
    [0, 2, 0, 3, ...new Array(12).fill(0)], // frame 0: colour 1 -> frame 1, colour 3 -> frame 2
    [0, 0, 0, 0, ...new Array(12).fill(0)], // frame 1: dead end
  ],
};
const session = { gistId: 'x', game, palette, frame: 0, busy: false };
const emojiStore = {
  reactionString: (hex) => (hex === '#111111' ? '<:c_111111:1>' : hex === '#333333' ? '<:c_333333:3>' : null),
};

test('nextFrame follows links for colour emoji and resets on 🔄', () => {
  assert.equal(nextFrame(session, 'c_111111'), 1);
  assert.equal(nextFrame(session, 'c_333333'), 2);
  assert.equal(nextFrame(session, 'c_000000'), null, 'colour without a link');
  assert.equal(nextFrame(session, 'c_abcdef'), null, 'colour not in palette');
  assert.equal(nextFrame(session, '👍'), null);
  assert.equal(nextFrame({ ...session, frame: 1 }, 'c_111111'), null, 'dead end');
  assert.equal(nextFrame({ ...session, frame: 1 }, RESET_EMOJI), 0);
});

test('reactionsForFrame lists link colours in palette order then reset', () => {
  assert.deepEqual(reactionsForFrame(session, emojiStore), ['<:c_111111:1>', '<:c_333333:3>', RESET_EMOJI]);
  assert.deepEqual(reactionsForFrame({ ...session, frame: 1 }, emojiStore), [RESET_EMOJI]);
});
