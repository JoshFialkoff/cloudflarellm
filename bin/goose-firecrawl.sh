#!/usr/bin/env bash
# goose-firecrawl — launch Goose with Firecrawl MCP.
#
# Baseline: the keyless hosted Firecrawl MCP is registered in
# ~/.config/goose/config.yaml (see `firecrawl setup mcp --keyless -a goose -y`).
# This launcher gives full-credit Firecrawl tools by materializing the API key
# from the CLI's stored credentials (never persisted in goose config) and, for
# one-shot runs, attaching a local Firecrawl MCP server with that key.
#
# Usage:
#   bin/goose-firecrawl.sh                      # interactive session (keyless MCP baseline)
#   bin/goose-firecrawl.sh run "<task>"         # one-shot with full-key local MCP server
set -euo pipefail

ENV_FILE="${FIRECRAWL_ENV_FILE:-.firecrawl-env}"
if [[ ! -f "$ENV_FILE" ]]; then
  firecrawl env -f "$ENV_FILE" >/dev/null 2>&1 || {
    echo "could not materialize FIRECRAWL_API_KEY — run 'firecrawl login' first" >&2
    exit 1
  }
  chmod 600 "$ENV_FILE"
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ "${1:-}" == "run" ]]; then
  shift
  exec goose run \
    --with-extension "FIRECRAWL_API_KEY=$FIRECRAWL_API_KEY npx -y firecrawl-mcp-server" \
    "$@"
fi

exec goose "$@"