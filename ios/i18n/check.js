// Usage: node ios/i18n/check.js  — verifies every translation file has exactly the source keys.
const fs = require('fs'), path = require('path');
const dir = __dirname;
const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(dir, '_source.json'), 'utf8')));
let bad = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort()) {
  let t;
  try { t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { console.log(f, 'INVALID JSON', e.message); bad++; continue; }
  const partial = f === 'en-us.json';
  const missing = partial ? [] : keys.filter(k => typeof t[k] !== 'string' || !t[k].trim());
  const extra = Object.keys(t).filter(k => !keys.includes(k));
  const lost = Object.keys(t).filter(k => (k.includes('{name}') && !t[k].includes('{name}')) || (k.includes('.flickgame') && !(t[k].includes('.flickgame') && t[k].includes('.html'))));
  if (missing.length || extra.length || lost.length) { bad++; console.log(f, { missing, extra, lost }); }
}
console.log(bad ? bad + ' file(s) with problems' : 'all files ok');
process.exit(bad ? 1 : 0);
