#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_DIR"

# Load local env vars for tokens/webhooks.
[ -f ".env.local" ] && set -a && source ".env.local" && set +a

NODE_BIN="${NODE_BIN:-/opt/homebrew/bin/node}"
if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="$(command -v node)"
fi

"$NODE_BIN" "scripts/reddit-structure-optimizer-agent.cjs"
