SHELL := /bin/sh
DEPLOY_HOST ?= box@192.168.178.69
REMOTE_DIR ?= flickgame-bot
DISCORD_UNIT := flickgame-play.service
TELEGRAM_UNIT := flickgame-telegram.service

.PHONY: test deploy logs logs-telegram status

test:
	npm test

deploy:
	ssh $(DEPLOY_HOST) 'mkdir -p $(REMOTE_DIR)/bots $(REMOTE_DIR)/palettes'
	rsync -az --delete --exclude node_modules --exclude .env --exclude data --exclude test/out ./ $(DEPLOY_HOST):$(REMOTE_DIR)/bots/
	rsync -az --delete --include '*.txt' --exclude '*' ../palettes/ $(DEPLOY_HOST):$(REMOTE_DIR)/palettes/
	ssh $(DEPLOY_HOST) 'set -e; cd $(REMOTE_DIR)/bots; \
	  npm ci --omit=dev --no-audit --no-fund; \
	  if [ ! -f .env ]; then cp .env.example .env; chmod 600 .env; echo "Created .env on the Pi; fill in the tokens, then run make deploy again"; exit 2; fi; \
	  chmod 600 .env; \
	  mkdir -p ~/.config/systemd/user; \
	  cp deploy/$(DISCORD_UNIT) deploy/$(TELEGRAM_UNIT) ~/.config/systemd/user/; \
	  systemctl --user daemon-reload; \
	  if grep -q "^DISCORD_TOKEN=.\+" .env && ! grep -q "^DISCORD_TOKEN=replace" .env; then systemctl --user enable --now $(DISCORD_UNIT); systemctl --user restart $(DISCORD_UNIT); else echo "DISCORD_TOKEN not set; $(DISCORD_UNIT) not started"; fi; \
	  if grep -q "^TELEGRAM_TOKEN=.\+" .env && ! grep -q "^TELEGRAM_TOKEN=replace" .env; then systemctl --user enable --now $(TELEGRAM_UNIT); systemctl --user restart $(TELEGRAM_UNIT); else echo "TELEGRAM_TOKEN not set; $(TELEGRAM_UNIT) not started"; fi; \
	  sleep 3; systemctl --user --no-pager status $(DISCORD_UNIT) $(TELEGRAM_UNIT) 2>/dev/null | grep -E "service -|Active:" || true'

logs:
	ssh $(DEPLOY_HOST) 'journalctl --user -u $(DISCORD_UNIT) -n 100 -f'

logs-telegram:
	ssh $(DEPLOY_HOST) 'journalctl --user -u $(TELEGRAM_UNIT) -n 100 -f'

status:
	ssh $(DEPLOY_HOST) 'systemctl --user --no-pager status $(DISCORD_UNIT) $(TELEGRAM_UNIT)'
