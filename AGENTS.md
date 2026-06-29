# AGENTS.md

## Repository
- Name: `assistedly` (Next.js app for `assistedly.ai`)
- Server path: `/opt/assistedly`
- Primary branch on host: `main`
- Runtime mode: Docker Compose (Traefik on legacy host; dify-nginx on co-located host)

## Production Topology

### Current origin (until DNS cutover): 75.127.14.185

- Public domain: `https://assistedly.ai`
- Public edge: Cloudflare
- Reverse proxy: Traefik (`compose.yaml`)
- App container: `assistedlyai-web-1`
- App internal port: `3003`
- Local bind: `127.0.0.1:3003:3003`
- Docker network: `assistedly`

### Target origin (migration): 75.127.14.185 (racknerd-9a7a1c2)

- Public edge: Cloudflare (same zone; DNS A records change at cutover)
- Reverse proxy: `dify-nginx-1` (existing Dify stack on 80/443)
- App container: `assistedlyai-web-1` via `compose.dify-host.yaml` (web-only, no Traefik)
- App internal port: `3003`; nginx upstream: `assistedly-web:3003` on `dify_default`
- Local bind: `127.0.0.1:3003:3003`
- Nginx vhost: `scripts/deploy/nginx-assistedly.conf` → `/etc/dify/nginx/conf.d/assistedly.conf`
- Runbook: `docs/deploy/migration-to-dify-host.md`

## Routing Contract (Critical)

### Legacy Traefik host (`compose.yaml`)

- Source of truth for Traefik routing is `compose.yaml` labels on `services.web`.
- Required labels:
  - `traefik.enable=true`
  - `traefik.http.routers.assistedly-web.entrypoints=https`
  - `traefik.http.services.assistedly-web-svc.loadbalancer.server.port=3003`
- Current rule excludes WordPress guide paths from Next.js:
  - `traefik.http.routers.assistedly-web.rule=(Host(assistedly.ai) || Host(www.assistedly.ai) || Host(agent2.assistedly.ai) || Host(agent3.assistedly.ai)) && !PathPrefix(/guide)`

### Dify co-located host (`compose.dify-host.yaml`)

- No Traefik service (port 80/443 conflict with `dify-nginx-1`).
- Web joins external `dify_default` with alias `assistedly-web`.
- Nginx `server_name`: `assistedly.ai`, `www.assistedly.ai`, `agent2.assistedly.ai`, `agent3.assistedly.ai`.
- `/guide` returns 404 at nginx (same intent as Traefik `!PathPrefix(/guide)`).

## WordPress /guide Interop
- If WordPress owns `/guide`, keep the Next.js route exclusion (`!PathPrefix(/guide)`).
- If WordPress is fully retired from `/guide`, decide intentionally and update:
  - `compose.yaml` rule
  - `scripts/guard-compose-traefik.cjs`
  - `.cursor/rules/traefik-compose-routing.mdc`
- Guard behavior:
  - `npm run guard:compose` enforces `/guide` exclusion by default.
  - Set `REQUIRE_GUIDE_EXCLUSION=0` only for intentional full Next.js ownership of `/guide`.

## Commands
- Install deps: `npm ci`
- Build: `npm run build`
- Start prod server: `npm run start`
- Lint + routing guard: `npm run lint`
- Dedicated routing guard: `npm run guard:compose`
- Production smoke check (5xx fail): `npm run smoke:production`

## CI/CD Expectations
- Deploy flow should include:
   1. Trigger deploy (upload commit archive + temp-worktree compose rebuild + restart)
  2. Cloudflare cache purge
  3. Production smoke check with retries
- Existing scripts:
  - `scripts/ci/trigger-deploy.mjs`
  - `scripts/ci/purge-cloudflare.mjs`
  - `scripts/smoke-production-url.cjs`
- Required GitHub secrets for deploy:
  - `DEPLOY_KEY`: SSH private key for `opencode`
  - `CLOUDFLARE_ZONE_ID`: Cloudflare zone id for purge requests
  - `CLOUDFLARE_API_TOKEN`: Cloudflare API token with cache purge permission

## Deploy Script (`scripts/ci/trigger-deploy.mjs`)
Connects via SSH to the production host, uploads the current git commit as an archive to a temp worktree, copies `/opt/assistedly/.env.production`, and runs `docker compose` build + up.

**Usage (legacy Traefik host):**
```bash
node scripts/ci/trigger-deploy.mjs --host 75.127.14.185
# or export DEPLOY_HOST=75.127.14.185 and omit --host
```

**Usage (Dify co-located host, after prep):**
```bash
DEPLOY_HOST=75.127.14.185 DEPLOY_COMPOSE_FILE=compose.dify-host.yaml DEPLOY_USER=joshfialkoff \
  node scripts/ci/trigger-deploy.mjs
```

**Environment:**
- `DEPLOY_HOST` — SSH host (fallback if `--host` not passed)
- `DEPLOY_COMPOSE_FILE` — `compose.yaml` (default) or `compose.dify-host.yaml`
- `DEPLOY_KEY` — optional SSH private key content (defaults to `~/.ssh/id_ed25519`)
- `DEPLOY_USER` — default `opencode`; target host may need `joshfialkoff` until `opencode` is provisioned

**Behavior:**
- Connects as `opencode`
- Uses Compose project `assistedlyai`
- Creates temp worktrees under `$HOME/assistedly-deploy-<sha>`
- Copies `/opt/assistedly/.env.production` into the temp worktree before building
- Preserves the previous temp worktree for rollback and cleans up older temp worktrees
- Timeout: 600s (accommodates long `docker compose build --pull`)
- Cleans up temporary key file in `finally` block

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

## SSH Access Notes
- SSH user for managed key access: `joshfialkoff` (75.127.14.185); `opencode` user is on legacy host.
- Key label used operationally: `opencode-25-march` / `7-5-25kuroit`
- Known accessible server IPs:
  - `75.127.14.185` — current production (Dify + dify-nginx)
  - `104.168.38.162` — legacy production (Traefik)

## Operational Notes
- Traefik may regenerate some file-provider config; prefer fixing public app routing in compose labels for this stack.
- Cloudflare purge alone cannot fix stale/incorrect origin build; always verify origin build and route health.
- Keep backups before editing routing files.

## Cursor Cloud specific instructions
- Stack: Next.js 16 (pages router) on Node 22; dependencies are installed automatically at VM startup via `.cursor/environment.json` (`npm ci`), so you normally do not need to install anything by hand.
- Dev server: run `npm run dev` (see `scripts/next-dev-free-port.js`). It does NOT use port 3000 — it picks the first free port starting at **3010** and binds `0.0.0.0`. Use the URL printed after `✓ Ready` (e.g. `http://localhost:3010/`); do not test `localhost:3000`.
- Health/smoke endpoints with no secrets required: `GET /api/health` → `{"ok":true}`, `GET /api/facilities` → JSON facility list. The homepage `/`, `/search`, and `/facility/[slug]` pages render fully without any env vars.
- Secret-gated flows: the homepage AI questionnaire's later "Continue" step, `/api/chat` (Dify), `/api/bots/llm-stream` (OpenAI), and magic-link email (`/api/auth/request-magic-link`, Resend) require keys from `.env.local` (see `.env.example`). Without those, those specific flows won't complete, but core browsing/search works — don't treat that as a setup failure.
- Build (`npm run build`) runs `next build --webpack` then `opennextjs-cloudflare build` (Cloudflare Workers bundle); it is heavier than a plain Next build. `next build` output also drives `npm start`.
- `.cursor/environment.json` `install` also runs `.cursor/setup-ssh.sh` (non-fatal); that only provisions deploy SSH keys/host config and is unrelated to running the app locally.
- Do not run `docker compose` or deploy locally — deploys are SSH-based to the production host (see deploy sections above).
