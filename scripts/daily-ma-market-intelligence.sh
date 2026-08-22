#!/usr/bin/env bash
# =============================================================================
# daily-ma-market-intelligence.sh
# =============================================================================
# Daily Firecrawl + NocoDB + Discord pipeline for Massachusetts
# assisted living competitive intelligence.
#
# Usage: ./daily-ma-market-intelligence.sh
# Cron: 0 9 * * * cd /Users/joshdev/Assistedly.ai && ./scripts/daily-ma-market-intelligence.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FIRECRAWL_DIR="$PROJECT_DIR/.firecrawl"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
RUN_DATE=$(date +%Y-%m-%d)

echo "=== Assistedly.ai MA Market Intelligence — $RUN_DATE ==="

# ---------------------------------------------------------------------------
# 1. Load secrets from Infisical
# ---------------------------------------------------------------------------
export FIRECRAWL_API_KEY INFISICAL_TOKEN NOCODB_TOKEN NOCODB_URL DISCORD_WEBHOOK_URL

# If Infisical agent rendered .env exists, source it
if [[ -f "$HOME/.infisical/rendered/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$HOME/.infisical/rendered/.env"
  set +a
fi

# Fallback: export from service token if needed
if [[ -z "${NOCODB_TOKEN:-}" ]]; then
  echo "ERROR: NOCODB_TOKEN not set. Run Infisical export first."
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. Firecrawl: Search for MA directory changes
# ---------------------------------------------------------------------------
echo "[1/4] Running Firecrawl search for MA assisted living updates..."
mkdir -p "$FIRECRAWL_DIR"

firecrawl search \
  "Massachusetts assisted living directory updates availability pricing "$(date +%B)" "$(date +%Y)" \
  --limit 10 \
  --scrape \
  -o "$FIRECRAWL_DIR/search-ma-$RUN_DATE.json" \
  --json || echo "WARN: Firecrawl search failed, continuing..."

# ---------------------------------------------------------------------------
# 3. Firecrawl Agent: Competitor gap analysis (focused, low credit)
# ---------------------------------------------------------------------------
echo "[2/4] Running Firecrawl agent for competitor gap analysis..."

COMPETITOR_SCHEMA='{"type":"object","properties":{"competitor_analysis":{"type":"array","items":{"type":"object","properties":{"source_name":{"type":"string"},"source_url":{"type":"string"},"key_metrics_displayed":{"type":"array","items":{"type":"string"}},"data_gaps":{"type":"array","items":{"type":"string"}},"unique_features":{"type":"array","items":{"type":"string"}}}}}}}}'

firecrawl agent \
  "Analyze A Place for Mom, Caring.com, and Seniorly for Massachusetts assisted living. List key metrics displayed, data gaps vs state regulatory data, and unique features." \
  --schema "$COMPETITOR_SCHEMA" \
  --model spark-1-mini \
  --wait \
  -o "$FIRECRAWL_DIR/competitor-analysis-$RUN_DATE.json" || echo "WARN: Competitor agent failed, continuing..."

# ---------------------------------------------------------------------------
# 4. Post summary to Discord
# ---------------------------------------------------------------------------
echo "[3/4] Posting intelligence summary to Discord..."

curl -s -X POST -H "Content-Type: application/json" \
  -d "{
    \"username\": \"Assistedly.ai MA Market Intelligence\",
    \"embeds\": [{
      \"title\": \"📊 Daily MA Market Intelligence — $RUN_DATE\",
      \"description\": \"Firecrawl search and competitor gap analysis completed.\",
      \"color\": 3447003,
      \"fields\": [
        {
          \"name\": \"🔍 Search Results\",
          \"value\": \"Saved to: search-ma-$RUN_DATE.json\",
          \"inline\": false
        },
        {
          \"name\": \"📁 Local Output\",
          \"value\": \"$FIRECRAWL_DIR\",
          \"inline\": false
        }
      ],
      \"footer\": {
        \"text\": \"assistedly.ai | NocoDB: pfeipqmy5ybhs71\"
      },
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
    }]
  }" \
  "$DISCORD_WEBHOOK_URL" || echo "WARN: Discord post failed"

# ---------------------------------------------------------------------------
# 5. Archive & cleanup
# ---------------------------------------------------------------------------
echo "[4/4] Archiving..."
find "$FIRECRAWL_DIR" -name "*.json" -mtime +30 -delete 2>/dev/null || true

echo "=== Done: $TIMESTAMP ==="
