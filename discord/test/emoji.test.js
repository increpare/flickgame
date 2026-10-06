import test from 'node:test';
import assert from 'node:assert/strict';
import { emojiNameForHex, hexFromEmojiName, swatchPng, EmojiStore } from '../src/emoji.js';
import { readPng } from './helpers/readPng.js';

test('emoji names round-trip hex colours', () => {
  assert.equal(emojiNameForHex('#E89F6E'), 'c_e89f6e');
  assert.equal(hexFromEmojiName('c_e89f6e'), '#e89f6e');
  assert.equal(hexFromEmojiName('c_xyz'), null);
  assert.equal(hexFromEmojiName(undefined), null);
  assert.equal(hexFromEmojiName('🔄'), null);
});

test('swatchPng is a 128x128 single-colour image', () => {
  const img = readPng(swatchPng('#272223'));
  assert.equal(img.width, 128);
  assert.equal(img.height, 128);
  assert.deepEqual(img.palette, ['#272223']);
  assert.ok(img.indices.every((v) => v === 0));
});

function fakeManager(existing = []) {
  let nextId = 1000;
  const created = [];
  return {
    created,
    async fetch() { return new Map(existing.map((e) => [e.id, e])); },
    async create({ attachment, name }) {
      assert.ok(Buffer.isBuffer(attachment));
      const e = { id: String(nextId++), name };
      created.push(e);
      return e;
    },
  };
}

test('EmojiStore loads existing swatches and only creates missing ones', async () => {
  const manager = fakeManager([{ id: '1', name: 'c_000000' }, { id: '2', name: 'not_a_swatch' }]);
  const store = new EmojiStore(manager);
  await store.load();
  assert.equal(store.size, 1);
  await store.ensure(['#000000', '#FFFFFF', '#ffffff']);
  assert.deepEqual(manager.created.map((e) => e.name), ['c_ffffff']);
  assert.equal(store.reactionString('#ffffff'), '<:c_ffffff:1000>');
  assert.equal(store.reactionString('#000000'), '<:c_000000:1>');
  assert.equal(store.reactionString('#123456'), null);
});
