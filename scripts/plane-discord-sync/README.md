# Plane ↔ Discord Sync

Automated project-management status updates from your self-hosted Plane instance
(http://23.95.189.106/executive) to your Discord channel.

## Architecture

- **Plane** — Source of truth for tasks, issues, and cycles/goals.
- **Discord Webhook** — Receives rich embed summaries twice daily.
- **Goose Recipe** — Runs `sync_runner.py` on a schedule via Goose Platform.

## Files

| File | Purpose |
|---|---|
| `plane_client.py` | Plane REST API wrapper (workspaces, projects, issues, cycles) |
| `discord_webhook.py` | Discord webhook poster + embed builder |
| `sync_runner.py` | Main entry point: fetch Plane data → post Discord |
| `.env.example` | Environment variable template |
| `data/last_sync_snapshot.json` | Local JSON cache of last sync |
| `../../recipes/plane-discord-sync.yaml` | Goose recipe for scheduled execution |

## Setup

### 1. Credentials

This system reads secrets exclusively from **Infisical** (`/Users/joshdev/.infisical/rendered/.env`).
Do NOT create a local `.env` file with real secrets.

Required variables (managed in Infisical):

- `PLANE_BASE_URL` — `http://23.95.189.106`
- `PLANE_API_KEY` — Valid Plane **user API token** (see troubleshooting below)
- `PLANE_WORKSPACE` — `executive`
- `PLANE_PROJECT_IDS` — Comma-separated project UUIDs
- `DISCORD_WEBHOOK_URL` — Use the `discord project management url` secret

To source manually:
```bash
source /Users/joshdev/.infisical/rendered/.env
```

### 2. Manual Test

```bash
# Test Plane connectivity
python3 plane_client.py workspaces

# Test Discord connectivity
python3 discord_webhook.py test

# Run a dry-run sync
python3 sync_runner.py --dry-run

# Full live sync (posts to Discord)
python3 sync_runner.py
```

### 3. Scheduled Job

The Goose recipe is already registered and will run:

- **Cadence:** Every weekday at 9:00 AM and 5:00 PM ET
- **Recipe:** `recipes/plane-discord-sync.yaml`
- **Goose Job ID:** `agent_created_1786581374`

To check:
```bash
goose task list
```

To verify job is active:
```bash
goose task inspect agent_created_1786581374
```

## Current Status

| Component | Status | Details |
|---|---|---|
| Discord Webhook | ✅ **Working** | Connected to `discord project management url` from Infisical |
| Plane API Auth | ⚠️ **Needs Fix** | `PLANE_API_KEY` returns 401 on all endpoints |
| Scheduled Job | ✅ **Active** | Runs Mon–Fri at 9:00 AM & 5:00 PM ET |
| Fallback Behavior | ✅ **Working** | Posts graceful "Plane unavailable" notice to Discord when auth fails |

## Known Issues & Troubleshooting

### ⚠️ Plane API Authentication (401 / "Authentication credentials were not provided")

The `PLANE_API_KEY` value (`plane_api_89d0d5ca63854fac9416ccd58772466f`) stored in Infisical and `.env.server-23-95-189-106.plane` does **not authenticate** against the Plane REST API (`/api/workspaces/`). We tested every known auth method (Bearer, Token, cookie, query params, `x-api-key`, `Authorization` headers) — all return 401.

**Root Cause:** This key is most likely a system-level secret (internal API key or Django SECRET_KEY prefix), not a user-generated API token.

**Fix Required:**
1. Log into Plane at http://23.95.189.106/executive
2. Go to **Settings → API Tokens** (or **User Profile → Settings → API Tokens**)
3. Generate a new token with **read** access to **Projects** and **Issues**
4. Update `PLANE_API_KEY` in Infisical (`secrets.assistedly.ai`)
   so the Agent re-renders `/Users/joshdev/.infisical/rendered/.env`
5. Re-run `python3 sync_runner.py` (or wait for next scheduled run) to verify

**Alternative (if API tokens are not available):**
- Provide a Plane **user email + password** and we can script a session login to extract a temporary session token for API access.

### ⚠️ Discord Webhook — Already Fixed

The original webhook (`webhooks/1518331460631789652/...`) was invalid. We use the working `discord project management url` from Infisical. If it ever rotates:
- Update the `discord project management url` secret in Infisical
- Let the Infisical Agent re-render the env file

## Quick Test Commands

```bash
cd /Users/joshdev/Assistedly.ai/scripts/plane-discord-sync

# Test Discord connectivity (confirms webhook is live)
python3 discord_webhook.py test

# Test Plane connectivity (will show 401 until new token is set)
python3 plane_client.py workspaces

# Dry-run sync (shows what would post without hitting Discord)
python3 sync_runner.py --dry-run

# Full live sync (posts to Discord, falls back gracefully if Plane fails)
python3 sync_runner.py
```

## Customization

### Change frequency
Edit the cron in `recipes/plane-discord-sync.yaml` and recreate the schedule:

```yaml
schedule:
  cron: "0 9,17 * * 1-5"   # Currently: 9 AM & 5 PM weekdays
```

### Filter which tasks to report
Edit `get_next_action_tasks()` in `plane_client.py`:
- Add more `state` filters (e.g., `"in progress"`, `"review"`)
- Filter by `priority`, `assignee`, or custom labels

### Add more projects
Update `PLANE_PROJECT_IDS` in `.env`:
```
PLANE_PROJECT_IDS=64a3045d-76e5-4501-a943-11e5fd8718f6,59048c57-f5db-4247-ac61-e6019c012985
```

### Change Discord format
Edit `build_status_embed()` in `discord_webhook.py` to:
- Add custom branding / colors
- Include assignee mentions
- Add links back to Plane issues

## Roadmap / Future Ideas

1. **Cross-platform sync** — Also read GitHub issues / PRs and Discord channel pins,
   and mirror them into Plane as issues (or vice versa).
2. **Bidirectional** — When someone reacts to a Discord status post,
   update the corresponding Plane issue state.
3. **Smart Alerts** — Only post when task state changes (diff snapshot against
   `data/last_sync_snapshot.json`).
4. **AI Summaries** — Use an LLM to write a brief narrative of blockers,
   deliverables, and next steps instead of a bullet list.

## License

Internal use at Assistedly.ai.