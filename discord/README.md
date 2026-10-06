# flickgame Discord play bot

Type `/play <link or gist id>` in any channel, or upload a `.flickgame` file
(or a standalone flickgame `.html`, or the game's `.txt`/`.json`); the bot
posts the first frame and one reaction per colour that links somewhere, plus
🔄. Tap a colour to follow its link. Anyone in the channel can play.

Colours are exact: the app owns one custom emoji per palette colour
(`c_rrggbb`), created on first start. Game data comes from the share link's
GitHub gist, so the bot works even if flickgame.org is down.

Smoke-tested 2026-10-06: reactions with application emoji work; the app owns
485 swatches after the first sync.

## Setup (once)

1. https://discord.com/developers/applications → New Application → "flickgame".
2. Bot tab: enable **Message Content Intent** (needed to see uploaded files).
   Reset Token and keep it for `.env`.
3. OAuth2 → URL Generator: scopes `bot` and `applications.commands`;
   permissions View Channels, Send Messages, Read Message History, Attach
   Files, Add Reactions, Manage Messages (permissions integer `109632`). Open
   the URL and add the bot to the flickgame server. The `/play` command is
   registered per server when the bot starts or joins.

## Run on musicbox

    make deploy          # first run creates ~/flickgame-bot/discord/.env on the Pi and stops
    ssh box@192.168.178.69 nano flickgame-bot/discord/.env   # paste DISCORD_TOKEN
    make deploy          # installs and starts the user unit flickgame-play.service
    make logs

## Run locally

    npm install
    cp .env.example .env   # fill in
    set -a; . ./.env; set +a; npm start

## Tests

    npm test
