// Colour maths shared by the bots (ported from flickgame_base.js).

export function hexToRgb(hex) {
  const v = parseInt(String(hex).slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function rgbToLab(r, g, b) {
  const lin = (c) => {
    c /= 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const R = lin(r); const G = lin(g); const B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  const fx = f(x); const fy = f(y); const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function colorDistance(hex1, hex2) {
  const c1 = hexToRgb(hex1); const c2 = hexToRgb(hex2);
  const l1 = rgbToLab(c1.r, c1.g, c1.b); const l2 = rgbToLab(c2.r, c2.g, c2.b);
  return Math.hypot(l1.L - l2.L, l1.a - l2.a, l1.b - l2.b);
}

// True when dark text reads better on this colour than light text.
export function prefersDarkText(hex) {
  return colorDistance(hex, '#ffffff') < colorDistance(hex, '#000000');
}

// Unicode colour squares with representative colours, for button labels.
export const COLOR_SQUARES = [
  ['🟥', '#e02020'], ['🟧', '#f08020'], ['🟨', '#f0d020'], ['🟩', '#30b040'],
  ['🟦', '#3060e0'], ['🟪', '#9040c0'], ['🟫', '#80502a'], ['⬛', '#202020'], ['⬜', '#e8e8e8'],
];

export function nearestSquare(hex) {
  let best = COLOR_SQUARES[0][0];
  let bestD = Infinity;
  for (const [emoji, ref] of COLOR_SQUARES) {
    const d = colorDistance(hex, ref);
    if (d < bestD) { bestD = d; best = emoji; }
  }
  return best;
}
