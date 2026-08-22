# Calendar ↔ Plane Task Priority Agent

## What it does

1. Reads your Google Calendar for the next N hours.
2. Identifies contiguous free-time blocks.
3. Fetches open stories/tasks from Plane (self-hosted).
4. Ranks tasks by urgency × importance × due-date × state.
5. Maps the highest-priority tasks into your free blocks.
6. Tells you what to work on next.

## Files

| File | Purpose |
|------|---------|
| `calendar_client.py` | Google Calendar API client with OAuth flow |
| `priority_engine.py` | Plane task scoring and ranking engine |
| `scheduler.py` | Main orchestrator and output formatter |
| `run.sh` | Convenience wrapper script |
| `.env.example` | Environment variables template |

## Setup

### 1. Install Python dependencies

```bash
pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

### 2. Google Calendar OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** (Desktop app type).
3. Download the JSON and save it as `client_secret.json` next to `scheduler.py`.
4. On first run, the script will open a browser for OAuth consent and cache the token in `token.json`.

> ⚠️ The `token.json` caches your refresh token. Keep it safe and `.gitignore` it.

### 3. Plane API credentials

These reuse the same environment variables as `scripts/plane-discord-sync`:

- `PLANE_BASE_URL` — self-hosted Plane instance URL
- `PLANE_API_KEY` — API token from Plane UI (Settings → API Tokens)
- `PLANE_WORKSPACE` — workspace slug
- `PLANE_PROJECT_IDS` — comma-separated list of project UUIDs

### 4. Environment variables

Copy `.env.example` to `.env` and fill values, or manage them via Infisical.

## Running

```bash
# Show next 12 hours in console
cd scripts/calendar-task-priority
python3 scheduler.py

# Or use the convenience wrapper from anywhere
./run.sh --hours 12

# Show next 8 hours, JSON output
python3 scheduler.py --hours 8 --output json

# Write JSON snapshot
python3 scheduler.py --snapshot data/last_schedule.json

# Also post to Discord
python3 scheduler.py --output all
```

## Scheduling with Goose

The accompanying recipe `recipes/calendar-task-priority.yaml` lets Goose run this automatically:

```bash
# Run once now
cd /Users/joshdev/Assistedly.ai
scripts/calendar-task-priority/run.sh

# Or schedule it as a Goose job
goose platform --schedule create \
  --recipe_path /Users/joshdev/Assistedly.ai/recipes/calendar-task-priority.yaml \
  --cron "0 9,13 * * *"
```
