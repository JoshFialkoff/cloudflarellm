#!/usr/bin/env bash
# Discord bot wrapper — sources Infisical env and keeps the bot alive.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RENDERED_ENV="${HOME}/.infisical/rendered/.env"
if [[ -f "$RENDERED_ENV" ]]; then
    set -a
    source "$RENDERED_ENV" 2>/dev/null
    set +a
fi

# Map Infisical Discord webhook secret to the expected env var
if [[ -f "$RENDERED_ENV" ]]; then
    _webhook_line=$(grep -m1 '^8-16-26plane_google_calendar-discord_webhook=' "$RENDERED_ENV" 2>/dev/null || true)
    if [[ -n "$_webhook_line" ]]; then
        _webhook_val=$(echo "$_webhook_line" | sed "s/^8-16-26plane_google_calendar-discord_webhook=//" | sed "s/['\"]//g")
        export DISCORD_CALENDAR_WEBHOOK_URL="$_webhook_val"
    fi
fi

# Correct channel for josh-next-actions (override stale/wrong DISCORD_CHANNEL_ID)
export DISCORD_CHANNEL_ID="1538498665398804590"

export PYTHONUNBUFFERED=1

# Use the system python3 that has discord.py installed
for PY in /usr/bin/python3 /usr/local/bin/python3 "$(which python3 2>/dev/null)"; do
    if [ -x "$PY" ] && "$PY" -c "import discord" 2>/dev/null; then
        PYTHON3="$PY"
        break
    fi
done

if [ -z "${PYTHON3:-}" ]; then
    echo "❌ python3 with discord.py not found"
    exit 1
fi

exec "$PYTHON3" discord_bot.py "$@"
