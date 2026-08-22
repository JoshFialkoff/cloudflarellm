# Plane Authentication Fix (RESOLVED ✓)

## The Problem

Plane REST API returned **401 Unauthenticated** on every call because we were using the **wrong API base path**.

| What we tried | Result |
|--------------|--------|
| `/api/workspaces/` | 401 — old v0 path no longer accepts tokens |
| `/api/v1/workspaces/` | ✅ **200** — correct path |
| `x-api-key` header | ✅ Works (case-insensitive, but docs use `X-API-Key`) |
| `Authorization: Bearer` | Also valid for OAuth tokens |

## Root Cause

Self-hosted Plane 0.15+ uses **v1** REST API namespace. The old `/api/workspaces/` route still exists but is session-only (browser auth). API tokens **must** hit `/api/v1/` endpoints.

## The Fix (Already Applied)

`plane_client.py` has been updated:
- All paths automatically get `/api/v1/` injected by `_url()`
- Header uses `X-API-Key` (matching Plane docs)

## Verified Working Endpoints

```bash
# Projects
curl -H "X-API-Key: $PLANE_API_KEY" \
  "http://23.95.189.106/api/v1/workspaces/executive/projects/"

# Issues (work items) in a project
curl -H "X-API-Key: $PLANE_API_KEY" \
  "http://23.95.189.106/api/v1/workspaces/executive/projects/{project_id}/issues/"

# Cycles
curl -H "X-API-Key: $PLANE_API_KEY" \
  "http://23.95.189.106/api/v1/workspaces/executive/projects/{project_id}/cycles/"
```

## Infisical Secret Mapping

| Infisical Secret | Env Var | Value Example |
|-----------------|---------|---------------|
| `8-13-26GooseSyncBot` | `PLANE_API_KEY` | `plane_api_7319224f84fe4a9492b3b439f5b67bc4` |
| (manual) | `PLANE_PROJECT_IDS` | `64a3045d-...,59048c57-...` |

## Token Generation Notes

- Plane PATs (Personal Access Tokens) have **no scopes UI** — they inherit your user's workspace permissions automatically.
- Create under **Profile → API Tokens** (not workspace settings).
- The token value is shown **once** after creation. Copy it immediately into Infisical.

## Status

- ✅ Discord webhook posting correctly
- ✅ Plane API auth resolved
- ✅ `plane_client.py` lists projects and issues successfully
- ✅ `sync_runner.py` fetches next-action tasks and cycles
- ✅ Scheduled Goose job will pull live data on each run
