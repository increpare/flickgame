#!/bin/sh
# Compatibility entry point; the portable builder needs only Node.js.
set -eu
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/sync-web-assets.cjs" "$@"
