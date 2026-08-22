#!/bin/bash
# Daily #1 Key Insight → Discord (6am ET)
set -euo pipefail
cd /Users/joshdev/Assistedly.ai

POSTHOG_API_KEY="$(grep "^POSTHOG_API_KEY=" /Users/joshdev/.infisical/rendered/.env | head -1 | sed 's/^POSTHOG_API_KEY=//' | sed "s/^'//;s/'$//")"
export POSTHOG_API_KEY
export POSTHOG_PROJECT_ID="1360"
export DISCORD_DAILY_INSIGHT_WEBHOOK_URL="https://discord.com/api/webhooks/1538512187088314388/qyJiiZpT8mMTLhVCWdA062tXWzVrsZMtbwbP5N2HTnBKXL1hjvC5LHJdKxYgzWG5FQyp"

node scripts/ci/daily-insight-discord.mjs
