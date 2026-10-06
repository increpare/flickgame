import zlib from 'node:zlib';
import assert from 'node:assert/strict';

// Minimal reader for the PNGs this project writes: 8-bit indexed, filter 0.
export function readPng(buf) {
  assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'png signature');
  const chunks = {};
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    chunks[type] = chunks[type] ? Buffer.concat([chunks[type], data]) : Buffer.from(data);
    off += 12 + len;
  }
  const width = chunks.IHDR.readUInt32BE(0);
  const height = chunks.IHDR.readUInt32BE(4);
  assert.equal(chunks.IHDR[8], 8, 'bit depth');
  assert.equal(chunks.IHDR[9], 3, 'indexed colour type');
  const raw = zlib.inflateSync(chunks.IDAT);
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * (width + 1)], 0, 'filter byte');
    indices.set(raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)), y * width);
  }
  const palette = [];
  for (let i = 0; i < chunks.PLTE.length; i += 3) {
    palette.push('#' + chunks.PLTE.subarray(i, i + 3).toString('hex'));
  }
  return { width, height, palette, indices };
}
