#!/bin/bash
# trigger-partner-pilot.sh
# Wrapper that injects Discord webhook via Infisical before running orchestrator.
# Usage:
#   ./scripts/trigger-partner-pilot.sh <slug> <source> <confidence> [--activate]
#
# Example:
#   ./scripts/trigger-partner-pilot.sh medicalguardian chatbot high --activate

set -euo pipefail

SLUG="${1:-}"
SOURCE="${2:-chatbot}"
CONFIDENCE="${3:-medium}"
ACTIVATE="${4:-}"

if [ -z "$SLUG" ]; then
  echo "Usage: $0 <slug> <source> <confidence> [--activate]"
  exit 1
fi

cd "$(dirname "$0")/.."

# Infisical injects DISCORD_PARTNER_PILOT_WEBHOOK env var
INFISICAL_DOMAIN="https://secrets.assistedly.ai" \
  infisical run --env=dev -- \
  node scripts/partner-pilot-orchestrator.js \
    --partner="$SLUG" \
    --source="$SOURCE" \
    --confidence="$CONFIDENCE" \
    ${ACTIVATE}
