const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function browser(filename, stored = {}) {
  const values = new Map(Object.entries(stored));
  const requests = [];
  const pre = {};
  const window = {
    location: 'https://www.flickgame.org/auth.html?code=test&state=expected',
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    }
  };
  class XMLHttpRequest {
    constructor() { requests.push(this); }
    open() {}
    setRequestHeader() {}
    send() {}
    respond(status, body, statusText = '') {
      Object.assign(this, { readyState: 4, status, statusText, responseText: body });
      this.onreadystatechange();
    }
  }
  let source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  if (filename.endsWith('.html')) source = source.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(source, { window, XMLHttpRequest, URL, document: { getElementById: () => pre } });
  return { window, values, requests, pre };
}

for (const statusText of ['', 'Unauthorized']) {
  test(`401 ${JSON.stringify(statusText)} clears stale login and offers reauthentication`, () => {
    const b = browser('flickgame_share.js', { oauth_access_token: 'expired' });
    const events = [];
    b.window.FlickgameShare.shareStateAsGist('{}', {
      onUnauthorized: () => events.push('login'),
      onError: error => events.push(error),
      onSuccess: () => events.push('success')
    });
    b.requests[0].respond(401, '{"message":"Bad credentials"}', statusText);
    assert.deepEqual(events, ['login']);
    assert.equal(b.values.has('oauth_access_token'), false);
  });
}

test('forbidden requests retain the login and report GitHub’s error', () => {
  const b = browser('flickgame_share.js', { oauth_access_token: 'valid' });
  let error;
  b.window.FlickgameShare.shareStateAsGist('{}', { onError: message => error = message });
  b.requests[0].respond(403, '{"message":"Rate limit exceeded"}');
  assert.equal(error, 'Rate limit exceeded');
  assert.equal(b.values.get('oauth_access_token'), 'valid');
});

test('successful sharing returns the playable gist link', () => {
  const b = browser('flickgame_share.js', { oauth_access_token: 'valid' });
  let result;
  b.window.FlickgameShare.shareStateAsGist('{}', { onSuccess: value => result = value });
  b.requests[0].respond(201, '{"id":"abc123"}');
  assert.equal(result.playUrl, 'play.html?p=abc123');
});

for (const token of [undefined, '', ' ', 'undefined', 'null']) {
  test(`invalid stored token ${JSON.stringify(token)} offers login without uploading`, () => {
    const b = browser('flickgame_share.js', token === undefined ? {} : { oauth_access_token: token });
    let login = false;
    b.window.FlickgameShare.shareStateAsGist('{}', { onUnauthorized: () => login = true });
    assert.equal(login, true);
    assert.equal(b.requests.length, 0);
  });

  test(`login callback rejects invalid token ${JSON.stringify(token)}`, () => {
    const b = browser('auth.html', { oauth_state: 'expected' });
    b.requests[0].respond(200, JSON.stringify({ access_token: token }));
    assert.equal(b.values.has('oauth_access_token'), false);
    assert.match(b.pre.innerText, /did not return a valid access token/);
  });
}

test('verified login saves a valid token', () => {
  const b = browser('auth.html', { oauth_state: 'expected' });
  b.requests[0].respond(200, '{"access_token":"valid"}');
  assert.equal(b.values.get('oauth_access_token'), 'valid');
  assert.match(b.pre.innerText, /all set up/);
});

test('mismatched OAuth state cannot exchange or save a token', () => {
  const b = browser('auth.html', { oauth_state: 'different' });
  assert.equal(b.requests.length, 0);
  assert.match(b.pre.innerText, /state mismatch/);
});
