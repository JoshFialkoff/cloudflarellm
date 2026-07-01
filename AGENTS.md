# AGENTS.md

## Quick Reference
- **App**: `assistedly` (Next.js) → `assistedly.ai`
- **Server**: `75.127.14.185` (Dify co-located), `104.168.38.162` (legacy Traefik)
- **Deploy (manual)**: `git archive HEAD | ssh opencode@75.127.14.185 "tar -xf- -C ~/deploy-$(git rev-parse --short HEAD) && cd ~/deploy-$(git rev-parse --short HEAD) && docker build -t assistedly-web:local . && docker compose -f compose.dify-host.yaml -p assistedlyai up -d --force-recreate"`
- **Key env file**: `/opt/assistedly/.env.production` (copied into deploy dir before build)
- **Full CI deploy**: `node scripts/ci/trigger-deploy.mjs --host <ip>` (needs CI secrets)
- **Connect**: `ssh opencode@75.127.14.185`
- **Smoke**: `curl -IL https://assistedly.ai/`

## Topology

| Host | Proxy | Compose File | Container |
|------|-------|-------------|-----------|
| 75.127.14.185 (current) | `dify-nginx-1` (port 80/443) | `compose.dify-host.yaml` | `assistedlyai-web-1` on `dify_default` → `assistedly-web:3003` |
| 104.168.38.162 (legacy) | Traefik 3.6 via Docker socket | `compose.yaml` | `assistedlyai-web-1` port 3003 on `assistedly` net |

**Key routing**: App runs on port 3003 internally. `/guide` excluded from Next.js (WordPress).

## Deploy Flow

### Manual (via opencode)
```bash
# 1. From local repo, create archive and upload
SHA=$(git rev-parse --short HEAD)
git archive --format=tar HEAD | ssh opencode@75.127.14.185 "set -euo pipefail; DIR=~/assistedly-deploy-${SHA}; rm -rf \$DIR; mkdir -p \$DIR; tar -xf- -C \$DIR; cp /opt/assistedly/.env.production \$DIR/"

# 2. On host: build & recreate
ssh opencode@75.127.14.185 "cd ~/assistedly-deploy-${SHA} && docker build --no-cache -t assistedly-web:local . && docker compose -f compose.dify-host.yaml -p assistedlyai up -d --force-recreate"

# 3. Verify
ssh opencode@75.127.14.185 "docker inspect assistedlyai-web-1 --format '{{.Image}}|{{.Status}}'"
```

### CI (`scripts/ci/trigger-deploy.mjs`)
- Uploads git archive → temp worktree on host → copies `.env.production` → `docker build` → `docker compose up -d --force-recreate`
- Preserves previous dir for rollback; cleans older ones
- Env: `DEPLOY_HOST`, `DEPLOY_USER` (default `opencode`), `DEPLOY_COMPOSE_FILE`, `DEPLOY_KEY`

**⚠️ Cache**: Use `docker build --no-cache` when modifying `lib/` or `components/`.

### Post-deploy
```bash
node scripts/ci/purge-cloudflare.mjs
npm run smoke:production
```

## Commands
- `npm ci` — install deps
- `npm run build` — `next build --webpack` + `opennextjs-cloudflare build`
- `npm run start` — prod server on port 3003
- `npm run lint` — lint + routing guard
- `npm run guard:compose` — enforce `/guide` exclusion
- `npm run guard:empty-libs` — check libs ≥2 bytes
- `npm run smoke:production` — 5xx fail check

## Routing Contract
- Traefik host: labels on `services.web` in `compose.yaml`. Rule: `Host(assistedly.ai|www|agent2|agent3|agent4.assistedly.ai) && !PathPrefix(/guide)`
- Dify co-located: `compose.dify-host.yaml`, nginx at `scripts/deploy/nginx-assistedly.conf`
- Set `REQUIRE_GUIDE_EXCLUSION=0` only if Next.js fully owns `/guide`

## Deploy Script (`scripts/ci/trigger-deploy.mjs`)
Connects via SSH to the production host, uploads the current git commit as an archive to a temp worktree, copies `/opt/assistedly/.env.production`, and runs `docker compose` build + up.

**Usage (legacy Traefik host):**
```bash
node scripts/ci/trigger-deploy.mjs --host 75.127.14.185
# or export DEPLOY_HOST=75.127.14.185 and omit --host
```

**Usage (Dify co-located host, after prep):**
```bash
DEPLOY_HOST=75.127.14.185 DEPLOY_COMPOSE_FILE=compose.dify-host.yaml DEPLOY_USER=opencode \
  node scripts/ci/trigger-deploy.mjs
```

**Environment:**
- `DEPLOY_HOST` — SSH host (fallback if `--host` not passed)
- `DEPLOY_COMPOSE_FILE` — `compose.yaml` (default) or `compose.dify-host.yaml`
- `DEPLOY_KEY` — optional SSH private key content (defaults to `~/.ssh/id_ed25519`)
- `DEPLOY_USER` — SSH user (default: `opencode`)

**Behavior:**
- Connects as `opencode`
- Uses Compose project `assistedlyai`
- Creates temp worktrees under `$HOME/assistedly-deploy-<sha>`
- Copies `/opt/assistedly/.env.production` into the temp worktree before building
- Preserves the previous temp worktree for rollback and cleans up older temp worktrees
- Timeout: 600s (accommodates long `docker compose build --pull`)
- Cleans up temporary key file in `finally` block

**⚠️ Docker build cache:** The Dockerfile uses `COPY . .` after `npm ci`. If you modify a lib file
(e.g., `lib/facilityChatFallback.js`), Docker's layer cache may serve the old version.
Always rebuild with `--no-cache` when modifying lib/ or components/:
```bash
docker build --no-cache -t assistedly-web:local .
docker compose -f compose.dify-host.yaml -p assistedly up -d --force-recreate
```

## Incident Checks (502 / wrong app version)
1. Confirm edge health:
   - `curl -I https://assistedly.ai/`
2. Confirm origin via local resolve:
   - `curl -k --resolve assistedly.ai:443:127.0.0.1 https://assistedly.ai/ -I`
3. Confirm active router/service in Traefik logs:
   - `sudo docker logs --since 30m $(docker ps --format '{{.Names}}' | grep -i traefik | head -1) 2>&1 | grep assistedly-web`
4. Validate compose contract:
   - `cd /opt/assistedly && npm run guard:compose`
5. Validate production returns non-5xx:
   - `cd /opt/assistedly && PRODUCTION_SMOKE_URL=https://assistedly.ai/ npm run smoke:production`

## Dify API Failure ("AI has gone AWOL" — homepage wizard)

When the homepage wizard shows "Our AI has gone AWOL", there are four known
root causes. Triage them in order:

### Cause A: `DIFY_API_BASE_URL` points to external URL through Cloudflare (redirect loop)
- **On the Dify co-located host (75.127.14.185)**, use the internal Docker network:
  - **CORRECT**:   `DIFY_API_BASE_URL=http://api:5001/v1`  ✓ (internal, bypasses nginx/Cloudflare)
  - **WRONG**:     `DIFY_API_BASE_URL=https://dify.forwardjump.com/v1`  ✗ (external, goes through Cloudflare → nginx → redirect loop)
- The Dify API service (`api:5001`) is on the `dify_default` Docker network alongside the web container.
- If `dify.forwardjump.com` must work externally (non-Docker testing), ensure `dify.forwardjump.com` is in nginx's `server_name` inside `dify-nginx-1` and nginx is reloaded.

### Cause B: `DIFY_API_BASE_URL` contains `/api/v1` instead of `/v1`
- **CORRECT**:   `DIFY_API_BASE_URL=http://api:5001/v1` or `https://dify.forwardjump.com/v1`  ✓
- **WRONG**:     `https://dify.forwardjump.com/api/v1`  ✗ (hits Console API, not Public API → 404 → 502)
- A runtime guard in `lib/difyEndpoints.js` logs `CRITICAL CONFIG ERROR` to the server console if it detects `/api/v1`.

### Cause C: `lib/facilityChatFallback.js` is empty (0 bytes)
- **2026-07-01 incident**: This file was accidentally 0 bytes. Three functions imported from it
  (`replyIncludesTop3Matches`, `buildCompleteNativeTop3Reply`, `buildLocalFacilityChatFallback`)
  resolved as `undefined`, causing `TypeError: X is not a function` in the client-side bundle.
- **Guard**: `npm run guard:empty-libs` (included in `npm run lint`) checks that all imported lib files have content ≥ 2 bytes.
- **Fix**: Populate the file with proper stub implementations or restore the real functions.

### Cause D: `streamDifyChatResponse()` return value treated as string
- This function returns `{ answer: string, kbFacilities: array }`, not a plain string.
- Callers must extract `.answer` from the returned object:
  ```javascript
  const streamResult = await streamDifyChatResponse(...)
  const finalText = typeof streamResult === 'string' ? streamResult : streamResult?.answer || ''
  ```
- **Affected files**: `components/AssistedlyWizard.js` (fixed 2026-07-01), `wizard.js` (already correct)

### Triage (full sequence)

1. Check the configured URL on the server:
   ```bash
   ssh opencode@75.127.14.185 "grep DIFY_API_BASE /opt/assistedly/.env.production"
   ```
   - On Dify co-located host: must be `http://api:5001/v1` (internal Docker network).
   - Must NOT contain `/api/v1`.
2. Test the Dify parameters endpoint directly (bypasses Cloudflare):
   ```bash
   DIFY_KEY=$(ssh opencode@75.127.14.185 'grep ^DIFY_API_KEY= /opt/assistedly/.env.production | cut -d= -f2')
   curl -sI -H "Authorization: Bearer $DIFY_KEY" "http://api:5001/v1/parameters"
   ```
   - Expected: HTTP 200
3. Test the `/api/chat` probe from outside:
   ```bash
   curl -s "https://assistedly.ai/api/chat?probe=1" | jq .
   ```
4. Check server console for CRITICAL or TypeError errors:
   ```bash
   docker logs assistedly-web-1 2>&1 | grep -iE "CRITICAL|TypeError|Error"
   ```
5. Run the empty-libs guard locally:
   ```bash
   cd /Users/joshfialkoff/Documents/Coding\ Workspaces/Assistedly.ai && npm run guard:empty-libs
   ```
6. If errors persist, check for client-side errors sent to `/api/chat-failure-contact`:
   ```bash
   docker logs assistedly-web-1 2>&1 | grep "chat-failure-contact"
   ```
7. Fix, rebuild with `--no-cache`, restart container, purge Cloudflare cache, smoke test.

## SSH Access Notes
- SSH user: `opencode` (both hosts)
- Key label: `opencode-25-march` / `7-5-25kuroit`
- Server IPs:
  - `75.127.14.185` — current production (Dify + dify-nginx)
  - `104.168.38.162` — legacy production (Traefik)

## Operational Notes
- Traefik may regenerate some file-provider config; prefer fixing public app routing in compose labels for this stack.
- Cloudflare purge alone cannot fix stale/incorrect origin build; always verify origin build and route health.
- Keep backups before editing routing files.

## Dify Chat Alerts (Discord)
When `/api/chat` returns a 502/error, the server fires a fire-and-forget Discord alert
via `lib/difyChatAlert.js` with a structured goose triage prompt.

**Webhook config** (checked in order):
1. `DISCORD_CHAT_ALERT_WEBHOOK_URL` (dedicated chat alert webhook)
2. `DISCORD_SERVER_OPS_WEBHOOK_URL` (ops channel)
3. `DISCORD_CONCIERGE_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL` (legacy fallback)

The Discord embed includes:
- Error details (HTTP status, attempted URL, mode, upstream body)
- Detection of the `/api/v1` wrong-prefix bug
- A `## goose — triage this Dify chat failure` prompt with exact SSH commands
- Quick-fix command if `/api/v1` is detected

This runs asynchronously and does NOT block the error response to the client.

## Cursor Cloud specific instructions
- Stack: Next.js 16 (pages router) on Node 22; dependencies are installed automatically at VM startup via `.cursor/environment.json` (`npm ci`), so you normally do not need to install anything by hand.
- Dev server: run `npm run dev` (see `scripts/next-dev-free-port.js`). It does NOT use port 3000 — it picks the first free port starting at **3010** and binds `0.0.0.0`. Use the URL printed after `✓ Ready` (e.g. `http://localhost:3010/`); do not test `localhost:3000`.
- Health/smoke endpoints with no secrets required: `GET /api/health` → `{"ok":true}`, `GET /api/facilities` → JSON facility list. The homepage `/`, `/search`, and `/facility/[slug]` pages render fully without any env vars.
- Secret-gated flows: the homepage AI questionnaire's later "Continue" step, `/api/chat` (Dify), `/api/bots/llm-stream` (OpenAI), and magic-link email (`/api/auth/request-magic-link`, Resend) require keys from `.env.local` (see `.env.example`). Without those, those specific flows won't complete, but core browsing/search works — don't treat that as a setup failure.
- Build (`npm run build`) runs `next build --webpack` then `opennextjs-cloudflare build` (Cloudflare Workers bundle); it is heavier than a plain Next build. `next build` output also drives `npm start`.
- `.cursor/environment.json` `install` also runs `.cursor/setup-ssh.sh` (non-fatal); that only provisions deploy SSH keys/host config and is unrelated to running the app locally.
- Do not run `docker compose` or deploy locally — deploys are SSH-based to the production host (see deploy sections above).
