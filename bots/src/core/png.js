import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

// 8-bit indexed-colour PNG, filter type 0 on every row, integer upscaling.
export function encodeIndexedPng(indices, width, height, paletteHex, scale = 1) {
  if (indices.length !== width * height) throw new Error('indices length must equal width*height');
  if (!Number.isInteger(scale) || scale < 1) throw new Error('scale must be a positive integer');
  const W = width * scale;
  const H = height * scale;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 3;  // colour type: indexed
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // no interlace

  const n = Math.max(paletteHex.length, 1);
  const plte = Buffer.alloc(n * 3);
  paletteHex.forEach((hex, i) => {
    const v = parseInt(hex.slice(1), 16);
    plte[i * 3] = (v >> 16) & 255;
    plte[i * 3 + 1] = (v >> 8) & 255;
    plte[i * 3 + 2] = v & 255;
  });

  const stride = W + 1;
  const raw = Buffer.alloc(stride * H);
  const row = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const v = Math.min(indices[y * width + x], n - 1);
      row.fill(v, 1 + x * scale, 1 + (x + 1) * scale);
    }
    for (let s = 0; s < scale; s++) row.copy(raw, (y * scale + s) * stride);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
