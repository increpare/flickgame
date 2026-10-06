import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeIndexedPng, crc32 } from '../src/png.js';
import { readPng } from './helpers/readPng.js';

test('crc32 matches the known value for "123456789"', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('encodes a 2x2 indexed image that round-trips', () => {
  const png = encodeIndexedPng(Uint8Array.from([0, 1, 2, 3]), 2, 2, ['#000000', '#ff0000', '#00ff00', '#0000ff']);
  const img = readPng(png);
  assert.equal(img.width, 2);
  assert.equal(img.height, 2);
  assert.deepEqual(img.palette, ['#000000', '#ff0000', '#00ff00', '#0000ff']);
  assert.deepEqual([...img.indices], [0, 1, 2, 3]);
});

test('scales with nearest neighbour', () => {
  const png = encodeIndexedPng(Uint8Array.from([0, 1, 1, 0]), 2, 2, ['#000000', '#ffffff'], 3);
  const img = readPng(png);
  assert.equal(img.width, 6);
  assert.equal(img.height, 6);
  const row = (y) => [...img.indices.subarray(y * 6, y * 6 + 6)];
  assert.deepEqual(row(0), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(row(2), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(row(3), [1, 1, 1, 0, 0, 0]);
  assert.deepEqual(row(5), [1, 1, 1, 0, 0, 0]);
});

test('clamps indices beyond the palette and rejects size mismatches', () => {
  const img = readPng(encodeIndexedPng(Uint8Array.from([9]), 1, 1, ['#111111', '#222222']));
  assert.deepEqual([...img.indices], [1]);
  assert.throws(() => encodeIndexedPng(Uint8Array.from([0, 0]), 1, 1, ['#000000']));
});
