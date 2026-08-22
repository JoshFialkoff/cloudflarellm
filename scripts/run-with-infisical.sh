#!/usr/bin/env bash
#
# run-with-infisical.sh
# =====================
# Thin wrapper that sources Infisical secrets from the rendered .env
# and then executes the provided command.
#
# Usage:
#   bash scripts/run-with-infisical.sh python3 scripts/list-recent-google-docs.py
#   bash scripts/run-with-infisical.sh goose
#   bash scripts/run-with-infisical.sh bash scripts/setup-google-workspace-mcp.sh
#

set -euo pipefail

RENDERED_ENV="${HOME}/.infisical/rendered/.env"

if [[ ! -f "$RENDERED_ENV" ]]; then
    echo "ERROR: Rendered secrets not found at $RENDERED_ENV" >&2
    echo "Run:  bash ~/.infisical/export-secrets.sh" >&2
    exit 1
fi

# Source the rendered secrets into current shell
set -a
# shellcheck source=/dev/null
source "$RENDERED_ENV"
set +a

# Execute the remainder of the command line
exec "$@"
