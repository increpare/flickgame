# Anonymous Sharing: Brotli JSON Store

Status: design and implementation plan, approved direction, not yet implemented.
An October 2026 exploration benchmarked several storage formats, including a custom context-mixing coder. Section 3 keeps the numbers that decided this design. The prototypes themselves were not kept.

## 1. Summary

Pressing Share in the editor or the gallery uploads the game, with no GitHub account, and returns a `play.html?p=<id>` link in the same shape as today. The server validates the game, rewrites it as canonical flickgame JSON, compresses it once with brotli at quality 11, and writes it to disk. The web server serves that file as is, with `Content-Encoding: br`, and the browser decompresses it natively. Nothing runs at play time.

Old gist links keep working through the existing proxy. The GitHub sign-in path is retired from the share UI.

## 2. Goals and non-goals

Goals:

- Share without an account, from the desktop editor, the mobile editor and the gallery.
- Store only well-formed flickgames: no arbitrary text, no HTML, no binary blobs.
- Serve games as static files, with no per-play compute.
- Little disk, but simple ahead of minimal. That is why brotli JSON, at about 11 KB per game, wins over the 4.7 KB context mixer.
- Keep every existing link, export, bot and app working.

Non-goals:

- Accounts, profiles, a public listing or search.
- Editing a shared game in place. A changed game is a new share with a new id.
- flickuboy and flickscript. They have their own gist formats and share code. They can adopt the endpoint later.
- Importing the existing gists into the store. This is optional and listed in section 13.

## 3. Why brotli JSON

Mean per game from the October 2026 benchmarks. Corpus A is 495 complete, deduplicated games from the gist archive in `D:\Projects\flickgames\lib`, keeping only games where all 16 pages are reachable. Corpus B is 64 games linked from increpare.com/categories/flickgame.html. Every ratio between schemes agreed across the two corpora to within 2%.

| option | A | B | encode | serving |
|---|---|---|---|---|
| raw JSON | 118.0 KB | 89.9 KB | none | static |
| JSON + gzip 9 | 14.5 KB | 9.4 KB | 32 ms | static |
| **JSON + brotli 11** | **10.8 KB** | **7.3 KB** | **120 ms, once** | **static** |
| packed nibbles + brotli 11 | 8.7 KB | 5.7 KB | 113 ms | needs a rebuild to JSON on every request |
| context mixer | 4.7 KB | 3.0 KB | 200 ms | 200 ms decode, plus a cache |

The stored file is byte for byte what the player fetches. There is no custom format to keep bit-exact, and any stored game can be inspected with the stock `brotli -d`. At realistic volumes the context mixer would save tens to hundreds of megabytes, which doesn't pay for a node service, a cache and a private bitstream. If disk ever becomes the constraint, the store can be re-encoded offline without any client noticing.

## 4. Current state, as found in the code

- `www.flickgame.org`, `flickgame.org` and `ded.increpare.com` all resolve to the same server, 95.211.62.202. Its `Alt-Svc: h3` header suggests Caddy. Confirm this before writing config.
- The site is deployed by the repo's `upload` script: `rsync -avz --checksum` with no `--delete` into `/home/locus/sites/flickgame`, followed by `perl gzipper`.
- The live CSP already permits everything this plan needs: `connect-src 'self' https://ded.increpare.com https://api.github.com`.
- Games load through `https://ded.increpare.com/cgi-bin/gist_proxy.py?id=<id>`, which returns `{"content": "<game json as a string>"}` with `Access-Control-Allow-Origin: https://www.flickgame.org`. The source of `gist_proxy.py` and `access_token_fg.py` is not in this repo.
- The loader is `flickgame_base.js`. The editor and other pages load it with `<script src>`. `play.html` carries its own **inlined copy**, which has diverged by about 230 lines. Changes to the loader must be made in both places.
- Sharing is `FlickgameShare.shareStateAsGist(stateString, {onSuccess, onError, onUnauthorized})` in `flickgame_share.js`. Its call sites are `shareClick()` in `index.html` and the "Share Link" button in `gallery_page.js`. `onSuccess` receives `{id, playUrl: 'play.html?p=' + id}`.
- Share code sits inside `/*ios-strip*/` blocks, so the iOS app doesn't share through the web path. That stays the same.
- The bots in `bots/src/core/gist.js` try GitHub first, then the proxy from `GIST_PROXY_URL`. `PLAY_RE` accepts 8 to 64 hex characters after `p=`. `BARE_RE` accepts a bare id of exactly 32 hex characters.
- Master already has a node test suite in `test/`, run with `node --test test/`. `share-auth.test.cjs` loads `flickgame_share.js` and `auth.html` into a `vm` sandbox with fake `localStorage` and `XMLHttpRequest`. New client tests follow the same pattern.
- The player renders the game link with `textContent` and prefixes `http://` to anything that isn't already `http(s)://`, so a `javascript:` link can't execute. It sets no `rel` attribute.

## 5. Architecture

```
SHARE
editor / gallery ──POST game JSON (gzip)──▶ https://ded.increpare.com/cgi-bin/flickgame_share.py
                                              │ CORS, size cap, rate limit
                                              │ parse, normalise, canonical JSON
                                              │ brotli 11, atomic write
                                              ▼
                              /home/locus/flickgame-store/games/ab/abcdef….json.br
                              /home/locus/flickgame-store/store.sqlite   (rate limits, log, takedowns)

PLAY, new ids (24 hex characters)
play.html?p=<id> ──GET /g/<id>.json──▶ Caddy, static file, Content-Encoding: br ──▶ browser inflates

PLAY, old ids (20 or 32 hex characters)
play.html?p=<id> ──▶ gist_proxy.py ──▶ GitHub   (unchanged)

BOTS and stale cached players
any id ──▶ gist_proxy.py ──▶ store first if the id is 24 hex, else GitHub
```

### 5.1 Ids

A new id is **24 lowercase hex characters**, 96 random bits from `secrets.token_hex(12)`.

- Gist ids are 20 or 32 hex characters, or purely numeric for very old gists. A length of 24 can never collide with one, and it tells the client where to fetch from without a wasted request.
- Bot `PLAY_RE` and the bots' internal `ID_RE` already accept it. `BARE_RE` needs widening to 24 or 32 characters.
- 96 random bits can't be enumerated or guessed.

### 5.2 Where the store lives

`/home/locus/flickgame-store/`, **outside** the rsync target. The `upload` script must never be able to touch it. Today it can't, because rsync runs without `--delete`, but a future `--delete` would wipe every anonymous game. Unlike gists, the store is the only copy, hence the backups in section 10.

Layout:

```
flickgame-store/
  games/<id[0:2]>/<id>.json.br     one file per game, sharded by the first two hex characters
  store.sqlite                     uploads log, rate-limit counters, takedown tombstones
  tmp/                             atomic-write staging on the same filesystem
```

## 6. Server: upload endpoint

A Python 3 CGI script, `flickgame_share.py`, deployed next to `gist_proxy.py` and served the same way. Uploads are rare, so per-request process startup is acceptable.

Source lives in the repo under `server/`, with `--exclude='/server'` added to `upload`. It's deployed by hand, the same way the existing CGI scripts are.

Dependencies: the stdlib, plus `brotli` from the `python3-brotli` distro package or `pip install --user brotli`. If neither is possible, run `brotli -q 11 -c` as a subprocess.

### 6.1 HTTP interface

`OPTIONS /cgi-bin/flickgame_share.py`, the CORS preflight. It's triggered because the request sets `Content-Type: application/json` and `Content-Encoding`:

```
204
Access-Control-Allow-Origin: <echo if in allowlist>
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: Content-Type, Content-Encoding
Access-Control-Max-Age: 86400
Vary: Origin
```

The allowlist is `https://www.flickgame.org` and `https://flickgame.org`, plus `http://localhost:*` behind a development flag that is off in production.

`POST /cgi-bin/flickgame_share.py`

- Body: the editor's `stateToString()` output, as `application/json`. Optionally `Content-Encoding: gzip`.
- `201 {"id": "<24 hex>", "playUrl": "play.html?p=<id>"}` on success.
- `400 {"error": "<human-readable reason>"}` for invalid games. The editor shows the message to the user.
- `413` for an oversized body, `415` for a wrong content type or encoding, `429 {"error": ..., "retryAfter": <seconds>}` when rate limited, and `500` with a generic message, with details going to the server log only.

All responses send `Content-Type: application/json`, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

### 6.2 Request pipeline

Each step fails fast. Nothing is written until step 7.

1. **Method and origin.** Only `POST` and `OPTIONS`. Reject origins not on the allowlist with 403. That isn't a security boundary, since curl can forge Origin, but it stops casual cross-site use.
2. **Rate limit**, recorded per salted IP hash in SQLite:
   - 10 uploads per hour per IP, and 50 per day per IP.
   - 2,000 uploads per day globally, as a circuit breaker for a botnet. Over that, everyone gets 429 and the log shows an alert line.
   - The IP comes from `REMOTE_ADDR`. **Verify** that the CGI host passes the real client address and not 127.0.0.1. If it's behind a local reverse proxy, use the proxy's forwarded header and nothing else.
3. **Body limits.** Raw body at most 1 MB by `CONTENT_LENGTH`, read with a hard limit. If gzip-encoded, inflate with `zlib.decompressobj(16 + zlib.MAX_WBITS)` and `max_length` set to 2 MB, and reject if output remains. This guards against a decompression bomb. The editor's largest real output is about 300 KB.
4. **Parse.** UTF-8, `json.loads`. The result must be a dict.
5. **Normalise and validate** per section 7. This produces the canonical state or a 400 with a reason.
6. **Serialise and compress.** Canonical JSON (section 7.4), then `brotli.compress(data, quality=11, lgwin=22)`. Check that `brotli.decompress(compressed) == data`. That costs 0.2 ms and catches a broken library build.
7. **Write atomically.** Generate an id. Write the file to `tmp/`, `fsync`, then `os.rename` to `games/<shard>/<id>.json.br`, creating the shard directory if needed. Files are mode 0644. If the id somehow exists, generate a new one.
8. **Log** one row: timestamp, id, IP hash, compressed bytes, raw bytes, width x height, origin. Commit.
9. **Respond** 201 with `{id, playUrl}`.

Expected cost per upload is about 150 ms of CPU: interpreter start, about 20 ms of run-level normalisation and about 120 ms of brotli.

### 6.3 IP hashing

`sha256(daily_salt + ip)`. The salt is random, regenerated each UTC day and kept in SQLite for 30 days, so per-IP limits work across a day and abuse can be traced for 30 days. After that the salts are deleted and old hashes become unlinkable. Log rows older than 30 days have their hash column cleared by the nightly job.

## 7. Normalisation and validation

This mirrors `stringToState`, `decodeCanvasRLE` and `normalizeHyperlinkPage` in `index.html`, so the store accepts what the editor accepts. It is stricter where a public store must be. The output is rebuilt from scratch. Nothing from the input is copied through unvalidated.

### 7.1 Dimensions

- `width`, `height`: if absent, 160 and 100. Otherwise each must be an integer (a JSON number with no fractional part, or a numeric string, as `Number()` would accept) from 1 to 2048.
- Public-store cap: **width x height at most 25,600** (160 x 160). The desktop editor is fixed at 160x100, and the mobile editor pins the long side at 160 and the short side at 50 or more. Anything larger is rejected with "This game is larger than the sharing limit". Imported oversized files can still be saved as standalone HTML.

### 7.2 Pages

- `canvasses` must be a list. More than 16 entries is rejected with "not a flickgame (too many pages)", since such files are usually flickscript or flickuboy games. Fewer than 16 are padded with blank pages, as the editor does.
- Each page is normalised **at the run level**, without expanding to pixels, so it's O(runs):
  - Walk pairs `[count, hex]`. Skip a pair whose count is not a finite number of 1 or more. Floor fractional counts the way `Number()` plus the editor's clamp would treat them, and clamp to the remaining cells.
  - `hex` must be one character `0`-`9a`-`f`, case-insensitive. Anything else reads as `0`, as the editor does.
  - Merge adjacent runs of the same colour.
  - If the page ends short, pad with a run of `0`, merged if the last run is already `0`.
  - Stop at exactly width x height cells. A trailing odd element is ignored.
- Output per page: a list of `[int, "x"]` pairs with lowercase hex and counts summing to width x height. This matches `stateToString`'s `RLE_encode`.

### 7.3 Hyperlinks and metadata

- `hyperlinks`: if not a list, 16 pages of 16 zeros. Each of the first 16 pages that is a list contributes its first 16 entries. An entry becomes `floor(n)` if it is a number or numeric string `n` with 1 ≤ n ≤ 16, else `0`. Strings matter because version-1 games store targets as `"2"`. Output is 16 lists of 16 integers.
- Metadata is whitelisted. **Unknown keys are dropped** and the event is logged. Dropping is lossless for the game itself, and stray keys may come from future or older editors.

| key | rule | if invalid |
|---|---|---|
| `gameLink` | string, trimmed, at most 200 characters, no control characters (U+0000–U+001F, U+007F–U+009F) and no bidi overrides | reject: "The game's link is too long or contains invalid characters" |
| `activeIndex` | integer 0–15 after the editor's flooring | set to 0 |
| `palette_name` | one of the palette files in the deployed site's `palettes/` directory, read at startup | reject: "Unknown palette" |
| `background_color`, `foreground_color` | `^#[0-9a-fA-F]{6}$`, stored lowercase | drop the key; the editor and player use their defaults |
| `version` | integer 1–100 | drop the key |

A missing `palette_name` stays missing, because the editor defaults it to `dawnbringer-16`. A missing `version` stays missing, because the editor and player upgrade v1 palettes on load. The server never rewrites colours.

### 7.4 Canonical serialisation

Key order follows `stateToString`: `gameLink, activeIndex, canvasses, palette_name, background_color, foreground_color, version, width, height, hyperlinks`, skipping absent keys. `width` and `height` are always written. Encoding is `json.dumps(obj, separators=(',', ':'), ensure_ascii=False).encode('utf-8')`.

The result loads in the editor exactly as the original would. Section 12.2 has a differential test that proves this across the corpus.

## 8. Serving

### 8.1 Static route for new ids

In the `www.flickgame.org` site block, and the bare-domain block if it serves the site:

```caddyfile
@storegame path_regexp storegame ^/g/([0-9a-f]{2})([0-9a-f]{22})\.json$
handle @storegame {
	root * /home/locus/flickgame-store/games
	rewrite * /{re.storegame.1}/{re.storegame.1}{re.storegame.2}.json.br
	header Content-Type "application/json; charset=utf-8"
	header Content-Encoding br
	header Cache-Control "public, max-age=86400"
	header Vary Accept-Encoding
	header X-Content-Type-Options nosniff
	file_server
}
```

Notes for the implementer:

- Check with `curl -sD - https://www.flickgame.org/g/<id>.json --compressed` that the content type isn't overridden by `file_server` from the `.br` extension, and that no `encode` directive compresses the response a second time. Caddy's `encode` skips responses that already carry `Content-Encoding`, but confirm it.
- A missing id must return a plain 404 and must not fall through to other site handlers.
- `max-age=86400` rather than `immutable` for a year, so a takedown stops propagating from browser caches within a day. The files are tiny, so revalidating is cheap.
- Brotli is sent regardless of the request's `Accept-Encoding`. Every client of this route accepts br: all browsers over HTTPS, and node's `fetch` in the bots. Anything else should use the proxy, which decompresses (section 8.2).
- The CSP's `connect-src 'self'` already covers `/g/`.

### 8.2 Proxy support for new ids

First copy the live `gist_proxy.py` into `server/` so it's under version control. Then add this branch at the top: if the id matches `^[0-9a-f]{24}$`, read the store file, decompress it with `brotli.decompress`, and return the usual `{"content": <json string>}` response. Return a 404-style `{"error": "not found"}` if the file is missing. Otherwise keep the existing GitHub path untouched.

This keeps the bots, stale browser-cached copies of `play.html` and any third-party embed working for new ids without any change.

## 9. Client changes

### 9.1 `flickgame_share.js`

Add `shareStateAnonymously(stateString, callbacks)`, with the same callback contract as `shareStateAsGist` minus `onUnauthorized`:

```js
var SHARE_ENDPOINT = 'https://ded.increpare.com/cgi-bin/flickgame_share.py';
var LAST_SHARE_KEY = 'flickgame_last_share'; // {hash, id} for re-share without upload

function shareStateAnonymously(stateString, callbacks) {
  // 1. sha256 of stateString (crypto.subtle); if it equals the stored hash, onSuccess
  //    with the stored id. Pressing Share twice on an unchanged game costs nothing.
  // 2. body = gzip(stateString) when CompressionStream exists, else the plain string.
  // 3. fetch POST, headers: Content-Type: application/json, Content-Encoding: gzip if gzipped.
  // 4. 201: store {hash, id}; onSuccess({id, playUrl}).
  //    4xx: onError(response.error). 429: onError("Too many shares, try again in N minutes").
  //    network: onError("Couldn't reach the sharing server").
}
```

- Gzip brings a typical upload from about 118 KB to about 14.5 KB, which matters on phones.
- The last-share cache is in `localStorage`, wrapped in try/catch. It only spares the server and gives a stable link. It isn't needed for correctness.
- Export it on `window.FlickgameShare`, inside the `/*ios-strip*/` block like the gist functions.
- Keep `shareStateAsGist` and `getAuthUrl` for one release, unused, so a rollback is a one-line change. Delete them afterwards (section 11).

### 9.2 `index.html`

- `shareClick()` calls `shareStateAnonymously`. On success it shows the link as it does now, minus the "log out of GitHub" span. While uploading it shows "Sharing…" in the same element. On error it shows the message inline rather than in an `alert`, so the mobile layout doesn't jump.
- `printUnauthorized` and `githubLogOut` become unused. Remove them with the gist code in the cleanup release.

### 9.3 `gallery_page.js`

The "Share Link" button uses `shareStateAnonymously`. Remove the "Log in with GitHub from the editor first." rejection. The rest of the flow, with `navigator.share` and the clipboard fallback, stays as it is.

### 9.4 Loader, in both `flickgame_base.js` and the inlined copy in `play.html`

In the `?p=` branch, before building the proxy URL:

```js
if (/^[0-9a-f]{24}$/.test(id)) {
  var base = location.protocol === 'file:' ? 'https://www.flickgame.org/' : location.href;
  url = new URL('g/' + id + '.json', base).href;
  // XHR as today; on 200 the body *is* the game JSON (no {content} wrapper): onSuccess(responseText).
  // 404: onError("This game doesn't exist or was removed.")
}
```

The editor's `index.html?p=<id>` and the player's Edit link (`hackLink`) work through the same loader with no further change.

### 9.5 `play.html`, link attributes

Set `homepageLink.rel = 'nofollow ugc noopener noreferrer'` in the game-link setup. This removes the SEO payoff that drives most drive-by spam uploads.

### 9.6 `upload`

Add `--exclude='/server'`.

### 9.7 Bots

- `gist.js`: widen `BARE_RE` to `^\s*([0-9a-f]{24}|[0-9a-f]{32})\s*$` (case-insensitive). Add `fromStore(id)`, which fetches `https://www.flickgame.org/g/<id>.json` for 24-character ids and skips GitHub. The proxy fallback stays.
- Tests: in `bots/test/gist.test.js`, add cases for a 24-character id in a play URL, a bare 24-character id, a store 404, and that GitHub is never called for a 24-character id.
- Uploading from the bots through the endpoint is out of scope for now. If wanted later, it gets a bot API key with its own rate limit, not an exemption from validation.

## 10. Operations

### 10.1 Backups

The store is the only copy of every anonymous game.

- Nightly, back up `games/` plus a consistent SQLite snapshot (`sqlite3 store.sqlite ".backup tmp/store-backup.sqlite"`) to a different machine with `restic` or `rsync --link-dest` snapshots. Keep 30 daily and 12 monthly snapshots.
- At 11 KB per game the whole store is small: 100,000 games is about 1.2 GB on disk once 4 KB blocks are counted.
- Restore drill before launch: delete a test game, restore it from backup, and load it in the player.

### 10.2 Nightly job (cron)

- Rotate the IP salt and clear IP hashes older than 30 days.
- Write a one-line summary to the log: uploads, rejections by reason, 429s, total store bytes.
- If uploads in the last 24 hours exceed 3 times the 7-day median, write an alert line. Optionally mail it.

### 10.3 Takedown

`server/store_admin.py`:

- `rm <id> [reason]` deletes the file, records a tombstone row, and prints the upload log row, which lets you see other uploads from the same IP hash within 30 days.
- `ban-ip-hash <hash> [days]` makes uploads from that hash get 403 for the period.
- `stats` prints counts, bytes, and the largest and newest games.
- `verify` decompresses and re-validates every stored game and reports failures. Run it after every server change and monthly from cron.

After `rm`, the route returns 404 and browser caches expire within a day (section 8.1).

### 10.4 Reporting

The help page gets a line: "To report a shared game, email analytic@gmail.com with its link." The player stays uncluttered. Revisit if reports become frequent.

### 10.5 Privacy policy

Update the flickgame privacy policy on increpare.com to say that shared games are public to anyone with the link, are stored on the flickgame server, and that a salted hash of the uploader's IP address is kept for 30 days for abuse prevention.

## 11. Implementation plan

Each phase ends in a working, deployable state. Server work ships and is tested with curl before any client change goes live.

### Phase 1: server library and tests

1. Create `server/flickgame_store/normalise.py` with section 7 as pure functions: `normalise_state(dict) -> (canonical_dict | raises InvalidGame(reason))` and `canonical_bytes(dict) -> bytes`.
2. Create `server/flickgame_store/store.py` with the SQLite schema, rate limiting, salted hashing and atomic writes.
3. Create `server/tests/` with the unit and differential tests from section 12, runnable with `python3 -m unittest`.

Done when all tests pass and the differential test is clean on all 5,051 files in the atlas corpus `lib/` and on corpus B.

### Phase 2: endpoint and serving

1. `server/flickgame_share.py`, the CGI wrapper: CORS, limits, gzip, pipeline, responses.
2. Copy the live `gist_proxy.py` into `server/` and add the store branch.
3. Create the store directory on the server, install `python3-brotli`, deploy both scripts.
4. Add the Caddy route (section 8.1) and reload Caddy.
5. Set up backups and the nightly cron, and run the restore drill.

Done when an upload with `curl` returns an id, `/g/<id>.json` serves the expected headers, `play.html?p=<id>` plays the game, the proxy returns it for the same id, and a backup snapshot contains it.

```bash
curl -s -X POST -H "Origin: https://www.flickgame.org" -H "Content-Type: application/json" --data-binary @testgame.txt https://ded.increpare.com/cgi-bin/flickgame_share.py
```

### Phase 3: client

1. Add `shareStateAnonymously` to `flickgame_share.js`.
2. Change the share flow in `index.html` and `gallery_page.js`.
3. Make the loader change in `flickgame_base.js` and the inlined copy in `play.html`.
4. Add the game-link `rel` attribute in `play.html`.
5. Add the client tests from section 12.5.
6. Add the `upload` exclude, then deploy.

Done when `node --test test/` passes and the manual test matrix in section 12.4 passes.

### Phase 4: bots

Change `gist.js` and its tests. Deploy the bots. Done when posting a new share link in Discord and Telegram plays the game.

### Phase 5: launch watch, about two weeks

Read the nightly summary daily. Decide whether rate limits need tuning and whether Turnstile is needed (section 13).

### Phase 6: cleanup

Remove `shareStateAsGist`, `getAuthUrl`, `printUnauthorized`, `githubLogOut`, `auth.html` and the OAuth client id from the web code. Retire `access_token_fg.py` and revoke the GitHub OAuth app. Keep `gist_proxy.py` indefinitely for old links.

## 12. Testing

### 12.1 Unit tests for the normaliser

Fixtures in `server/tests/fixtures/`:

- `testgame.txt` (160x155, current format), a version-1 file with string link targets and no `version`, `palette_name` or dimensions, and a file with 17 pages, which must be rejected.
- Hostile inputs:
  - run counts of `1e308`, `-5`, `"abc"`, `NaN` and floats
  - colour digits `"g"`, `"10"` and `""`
  - a page summing to far more cells than the page holds
  - nested objects where lists are expected
  - `width: 2049`, `width: 1.5`, `width: "160"`, 161x160, 1x1
  - a 200-character game link and a 201-character one, a game link with `‮` or `\n`, a `javascript:` game link (accepted, because the player neutralises it), unicode and emoji game links
  - unknown keys, including `__proto__`
  - a 1 MB body, and a gzip bomb that inflates to 1 GB
- For each fixture, assert the expected canonical bytes or the expected rejection reason.

### 12.2 Differential test against the editor's semantics

A node script extracts the editor's own `readCanvasDimension`, `decodeCanvasRLE` and `normalizeHyperlinkPage` from `index.html` at test time and evaluates them in a `vm` sandbox, so the test tracks future editor changes. For every file in the atlas corpus `lib/` and in corpus B, it decodes both the original JSON and the Python normaliser's output with those functions and asserts identical dimensions, pixels and links. It also asserts that the metadata differs only in documented ways: dropped unknown keys, explicit width and height, lowercased colours, and dropped invalid colours.

Files the normaliser rejects are listed with reasons and reviewed by hand. The expected rejections are only those with more than 16 pages or more than 25,600 cells.

### 12.3 Size and timing check

Over both corpora, report the mean, median and maximum compressed size, and the normalise and compress time per game. Expect a mean of about 10.8 KB on A and 7.3 KB on B, and under 200 ms per game. A large deviation means the canonical serialisation differs from the benchmark's.

### 12.4 Manual end-to-end matrix

Use the browser pane against production after phase 3, plus one real phone:

| case | expect |
|---|---|
| desktop editor, Share | link appears; opening it plays the game; Edit opens it in the editor |
| Share again, unchanged | same id, and no new row in the upload log |
| edit one pixel, Share | new id |
| mobile editor at 160x50 and 50x160 | link plays at the right aspect |
| gallery, Share Link | share sheet or clipboard, link plays |
| old gist link | still plays through the proxy |
| 11 shares in an hour | the 11th shows the rate-limit message |
| `play.html?p=` with an unknown 24-hex id | "doesn't exist or was removed" |
| takedown with `store_admin.py rm` | 404 after a cache-busting reload |
| bot: post the new link | the bot plays it |
| iOS app | no change; share stays stripped |

### 12.5 Client unit tests

`test/share-anonymous.test.cjs`, in the style of `share-auth.test.cjs`:

- `shareStateAnonymously` posts gzip when `CompressionStream` exists and plain JSON when it doesn't.
- A 201 response calls `onSuccess` with `{id, playUrl}` and records the last share.
- Sharing the same state again calls `onSuccess` with the same id and makes no request.
- 400 passes the server's message to `onError`. 429 produces the retry message. A network failure produces the "couldn't reach" message.
- The loader sends a 24-hex id to `g/<id>.json` and passes the body straight to `onSuccess`. A 20- or 32-hex id still goes to the proxy. A 404 for a store id produces the "doesn't exist" message.
- The `play.html` inlined loader gets the same routing test, so the two copies can't drift on this point.

## 13. Open questions and later options

- **Delete tokens.** Return a random token with each upload, store its hash, keep the token in the editor's `localStorage` or gallery record, and add an "Unshare" action that calls a delete endpoint. This gives authors control without accounts. It's not in version 1, but the SQLite schema should leave room for a `delete_token_hash` column.
- **Turnstile.** Add it only if the launch watch shows automated abuse that rate limits don't stop. It's one widget on the share button and one server-side verification call in step 2 of the pipeline.
- **Dimension cap.** 25,600 cells matches today's editors. If an editor ever allows larger canvases, raise the cap with it.
- **Gist import.** Pull every known gist through the proxy once and store it under its gist id. Store support in the proxy and the loader would then need to accept 20- and 32-character ids too. This protects old games against gist deletion. About 5,000 games is about 55 MB.
- **flickuboy and flickscript.** The same endpoint pattern would work with their own normalisers. Do it if anyone asks.
- **Smaller storage later.** Re-encode the store offline with a purpose-built context-mixing coder, which was prototyped at about 4.7 KB per game, and serve through a decode-and-cache layer. This is only worth it if disk becomes a real constraint. Clients wouldn't change.
