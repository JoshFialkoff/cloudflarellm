#!/usr/bin/env bash
# Launchd-friendly wrapper (no exec) for calendar-task-priority scheduler.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RENDERED_ENV="${HOME}/.infisical/rendered/.env"
if [[ -f "$RENDERED_ENV" ]]; then
    set -a
    source "$RENDERED_ENV" 2>/dev/null
    set +a
fi

if [[ -f "$RENDERED_ENV" ]]; then
    while IFS= read -r line; do
        key=$(echo "$line" | sed -n 's/.*PLANE_API_KEY=['"'"'"]\{0,1\}\(plane_api_[a-f0-9]*\)['"'"'"]\{0,1\}.*/\1/p')
        if [[ -n "$key" && "$key" != "$_last_tested" ]]; then
            code=$(curl -s -o /dev/null -w "%{http_code}" "http://${PLANE_BASE_URL:-23.95.189.106}/api/v1/workspaces/executive/projects/" -H "X-API-Key: $key")
            if [[ "$code" == "200" ]]; then
                export PLANE_API_KEY="$key"
                break
            fi
            _last_tested="$key"
        fi
    done < <(grep -i "PLANE_API_KEY" "$RENDERED_ENV" | head -20)
fi

# Map Infisical Discord webhook secret to the expected env var
if [[ -f "$RENDERED_ENV" ]]; then
    _webhook_line=$(grep -m1 '^8-16-26plane_google_calendar-discord_webhook=' "$RENDERED_ENV" 2>/dev/null || true)
    if [[ -n "$_webhook_line" ]]; then
        _webhook_val=$(echo "$_webhook_line" | sed "s/^8-16-26plane_google_calendar-discord_webhook=//" | sed "s/['\"]//g")
        export DISCORD_CALENDAR_WEBHOOK_URL="$_webhook_val"
    fi
fi

if [[ -z "${PLANE_PROJECT_IDS:-}" ]]; then
    export PLANE_PROJECT_IDS="64a3045d-76e5-4501-a943-11e5fd8718f6,59048c57-f5db-4247-ac61-e6019c012985,1eb938ee-35dc-4c86-93e0-eef03d8912b5"
fi

PYTHON3="${PYTHON3:-$(which python3)}"
if [ -z "$PYTHON3" ]; then
    echo "❌ python3 not found on PATH"
    exit 1
fi

# Run without exec so launchd StandardOutPath/StandardErrorPath capture works reliably
"$PYTHON3" scheduler.py "$@"
