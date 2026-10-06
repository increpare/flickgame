SHELL := /bin/sh
DEPLOY_HOST ?= box@192.168.178.69
REMOTE_DIR ?= flickgame-bot
UNIT := flickgame-play.service

.PHONY: test deploy logs status

test:
	npm test

deploy:
	ssh $(DEPLOY_HOST) 'mkdir -p $(REMOTE_DIR)/discord $(REMOTE_DIR)/palettes'
	rsync -az --delete --exclude node_modules --exclude .env --exclude test/out ./ $(DEPLOY_HOST):$(REMOTE_DIR)/discord/
	rsync -az --delete --include '*.txt' --exclude '*' ../palettes/ $(DEPLOY_HOST):$(REMOTE_DIR)/palettes/
	ssh $(DEPLOY_HOST) 'set -e; cd $(REMOTE_DIR)/discord; \
	  npm ci --omit=dev --no-audit --no-fund; \
	  if [ ! -f .env ]; then cp .env.example .env; chmod 600 .env; echo "Created .env on the Pi; fill in DISCORD_TOKEN and PLAY_CHANNEL_ID, then run make deploy again"; exit 2; fi; \
	  chmod 600 .env; \
	  mkdir -p ~/.config/systemd/user; \
	  cp deploy/$(UNIT) ~/.config/systemd/user/$(UNIT); \
	  systemctl --user daemon-reload; \
	  systemctl --user enable --now $(UNIT); \
	  systemctl --user restart $(UNIT); \
	  sleep 3; systemctl --user --no-pager status $(UNIT) | head -12'

logs:
	ssh $(DEPLOY_HOST) 'journalctl --user -u $(UNIT) -n 100 -f'

status:
	ssh $(DEPLOY_HOST) 'systemctl --user --no-pager status $(UNIT)'
