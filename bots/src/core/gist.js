const PLAY_RE = /play\.html\?(?:[^\s]*?&)?p=([0-9a-fA-F]{8,64})/;
const BARE_RE = /^\s*([0-9a-fA-F]{32})\s*$/;
const ID_RE = /^[0-9a-f]{8,64}$/;
const UA = 'flickgame-discord-bot (+https://github.com/increpare/flickgame)';

export function gistIdFromText(text) {
  const s = String(text || '');
  const m = PLAY_RE.exec(s);
  if (m) return m[1].toLowerCase();
  const b = BARE_RE.exec(s);
  return b ? b[1].toLowerCase() : null;
}

export async function fetchGameJson(id, { githubToken, proxyUrl, fetchImpl = fetch } = {}) {
  if (!ID_RE.test(id)) throw new Error('bad gist id');
  try {
    return await fromGithub(id, githubToken, fetchImpl);
  } catch (err) {
    if (!proxyUrl) throw err;
    return fromProxy(id, proxyUrl, fetchImpl);
  }
}

async function fromGithub(id, token, fetchImpl) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': UA };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetchImpl(`https://api.github.com/gists/${id}`, { headers });
  if (!res.ok) throw new Error(`github ${res.status}`);
  const gist = await res.json();
  const files = Object.values(gist.files || {});
  if (!files.length) throw new Error('gist has no files');
  const file = files[0];
  if (file.truncated) {
    const raw = await fetchImpl(file.raw_url, { headers: { 'user-agent': UA } });
    if (!raw.ok) throw new Error(`github raw ${raw.status}`);
    return raw.text();
  }
  if (typeof file.content !== 'string') throw new Error('gist file has no content');
  return file.content;
}

async function fromProxy(id, proxyUrl, fetchImpl) {
  const res = await fetchImpl(`${proxyUrl}?id=${id}`, {
    headers: { origin: 'https://www.flickgame.org', 'user-agent': UA },
  });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`proxy: ${data.error}`);
  if (typeof data.content !== 'string') throw new Error('proxy: no content');
  return data.content;
}
