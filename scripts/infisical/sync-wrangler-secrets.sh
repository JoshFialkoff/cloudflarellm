#!/bin/zsh
set -euo pipefail
# =============================================================================
# Infisical → Wrangler Secret Sync for assistedly-slot4 (main app)
# =============================================================================
# Source of truth: Infisical (secrets.assistedly.ai)
# Target: Cloudflare Workers secrets for assistedly-slot4
#
# Usage:
#   ./scripts/infisical/sync-wrangler-secrets.sh
#
# Prerequisites:
#   - Infisical CLI and Wrangler CLI installed
#   - Valid Infisical auth (service token or `infisical login` session)
#   - `wrangler whoami` shows the ForwardJump account
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
TOKEN_FILE="${HOME}/.infisical/machine-identity/service-token"
RENDERED_ENV="${HOME}/.infisical/rendered/.env"
PROJECT_ID="e9cab1b7-b17c-4502-bc30-64ae61c21e63"
INFISICAL_DOMAIN="https://secrets.assistedly.ai/api"
WORKER_NAME="assistedly-slot4"

# Keys that MUST live as Wrangler secrets (not public vars)
# Add more here as needed. Exclude NEXT_PUBLIC_* (those belong in [vars]).
WRANGLER_SECRET_KEYS=(
  DEEP_DIVE_AUTOMATION_DIFY_API_KEY
  DIFY_API_BASE_URL
  TWENTY_API_KEY
  OPENAI_API_KEY
  # Add other sensitive keys here
)

# ---------------------------------------------------------------------------
# 1. Validate prerequisites
# ---------------------------------------------------------------------------
if ! command -v infisical &>/dev/null; then
  echo "❌ Infisical CLI not found."
  exit 1
fi

if ! command -v wrangler &>/dev/null; then
  echo "❌ Wrangler CLI not found."
  exit 1
fi

TOKEN=""
if [[ -n "${INFISICAL_TOKEN:-}" ]]; then
  TOKEN="$INFISICAL_TOKEN"
elif [[ -f "$TOKEN_FILE" ]]; then
  TOKEN="$(cat "$TOKEN_FILE" | tr -d '\n')"
fi

# ---------------------------------------------------------------------------
# 2. Export secrets from Infisical
# ---------------------------------------------------------------------------
TMP_ENV=$(mktemp)
trap "rm -f '$TMP_ENV'" EXIT

echo "📥 Pulling secrets from Infisical (project=$PROJECT_ID, env=dev)..."
if [[ -n "$TOKEN" ]]; then
  infisical export \
    --token "$TOKEN" \
    --projectId "$PROJECT_ID" \
    --env dev \
    --format dotenv \
    --domain "$INFISICAL_DOMAIN" \
    --output-file "$TMP_ENV" 2>/dev/null
else
  infisical export \
    --projectId "$PROJECT_ID" \
    --env dev \
    --format dotenv \
    --domain "$INFISICAL_DOMAIN" \
    --output-file "$TMP_ENV" 2>/dev/null
fi

# ---------------------------------------------------------------------------
# 3. Push each relevant key to Wrangler
# ---------------------------------------------------------------------------
MISSING_COUNT=0

for key in "${WRANGLER_SECRET_KEYS[@]}"; do
  value=""
  if grep -q "^${key}=" "$TMP_ENV"; then
    value="$(grep "^${key}=" "$TMP_ENV" | cut -d'=' -f2-)"
  fi

  if [[ -z "$value" ]]; then
    echo "⚠️  $key not found in Infisical — skipping"
    MISSING_COUNT=$((MISSING_COUNT + 1))
    continue
  fi

  echo -n "🔐 Syncing $key → Wrangler ($WORKER_NAME)... "
  echo "$value" | wrangler secret put "$key" --config wrangler-slot4.toml --name "$WORKER_NAME" >/dev/null 2>&1
  echo "✅"
done

if [[ $MISSING_COUNT -gt 0 ]]; then
  echo ""
  echo "⚠️  $MISSING_COUNT secret(s) were missing from Infisical."
  echo "   Add them at: https://secrets.assistedly.ai/project/$PROJECT_ID/dev"
fi

echo ""
echo "🎉 Infisical → Wrangler sync complete for $WORKER_NAME."
