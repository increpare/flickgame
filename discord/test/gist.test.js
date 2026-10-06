import test from 'node:test';
import assert from 'node:assert/strict';
import { gistIdFromText, fetchGameJson } from '../src/gist.js';

const ID = '9dad50f8a7a20878adaca64febc32b62';

test('gistIdFromText finds play links and bare ids', () => {
  assert.equal(gistIdFromText(`look https://www.flickgame.org/play.html?p=${ID} !`), ID);
  assert.equal(gistIdFromText(`flickgame.org/play.html?a=1&p=${ID.toUpperCase()}`), ID);
  assert.equal(gistIdFromText(`  ${ID}  `), ID);
  assert.equal(gistIdFromText('https://www.flickgame.org/play.html'), null);
  assert.equal(gistIdFromText('hello 1234'), null);
});

function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, init });
    for (const [prefix, respond] of routes) {
      if (url.startsWith(prefix)) return respond(url, init);
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  f.calls = calls;
  return f;
}
const json = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj, text: async () => JSON.stringify(obj) });

test('fetchGameJson reads the first gist file from GitHub', async () => {
  const fetchImpl = fakeFetch([
    ['https://api.github.com/gists/' + ID, () => json({ files: { 'game.txt': { content: '{"a":1}', truncated: false } } })],
  ]);
  assert.equal(await fetchGameJson(ID, { fetchImpl, githubToken: 'tok' }), '{"a":1}');
  assert.equal(fetchImpl.calls[0].init.headers.authorization, 'Bearer tok');
});

test('fetchGameJson follows raw_url when the file is truncated', async () => {
  const fetchImpl = fakeFetch([
    ['https://api.github.com/gists/' + ID, () => json({ files: { g: { content: '', truncated: true, raw_url: 'https://gist.githubusercontent.com/raw/x' } } })],
    ['https://gist.githubusercontent.com/raw/x', () => ({ ok: true, status: 200, text: async () => '{"full":true}' })],
  ]);
  assert.equal(await fetchGameJson(ID, { fetchImpl }), '{"full":true}');
});

test('fetchGameJson falls back to the proxy when GitHub fails', async () => {
  const fetchImpl = fakeFetch([
    ['https://api.github.com/', () => json({ message: 'rate limited' }, 403)],
    ['http://127.0.0.1:8081/cgi-bin/gist_proxy.py', (url, init) => {
      assert.equal(init.headers.origin, 'https://www.flickgame.org');
      assert.ok(url.endsWith('?id=' + ID));
      return json({ content: '{"p":1}' });
    }],
  ]);
  assert.equal(await fetchGameJson(ID, { fetchImpl, proxyUrl: 'http://127.0.0.1:8081/cgi-bin/gist_proxy.py' }), '{"p":1}');
});

test('fetchGameJson rejects bad ids and surfaces errors', async () => {
  await assert.rejects(fetchGameJson('../etc', { fetchImpl: fakeFetch([]) }), /bad gist id/);
  await assert.rejects(fetchGameJson(ID, { fetchImpl: fakeFetch([]) }), /github 404/);
  const fetchImpl = fakeFetch([
    ['https://api.github.com/', () => json({}, 500)],
    ['http://proxy', () => json({ error: 'invalid origin' })],
  ]);
  await assert.rejects(fetchGameJson(ID, { fetchImpl, proxyUrl: 'http://proxy' }), /invalid origin/);
});
