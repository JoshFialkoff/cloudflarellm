# AGENTS.md

## Repository
- Name: `assistedly` (Next.js app for `assistedly.ai`)
- Server path: `/opt/assistedly`
- Primary branch on host: `main`
- Runtime mode: Docker Compose + Traefik

## Production Topology
- Public domains: `https://assistedly.ai`, `https://agent1.assistedly.ai`, `https://agent3.assistedly.ai`
- Public edge: Cloudflare
- Reverse proxy: Traefik
- App container: `assistedly-web-1`
- App internal port: `3003`
- Local bind: `127.0.0.1:3003:3003`
- Docker network used for Traefik routing: `assistedly`

## Routing Contract (Critical)
- Source of truth for production routing is `compose.yaml` labels on `services.web`.
- Required labels:
  - `traefik.enable=true`
  - `traefik.docker.network=assistedly`
  - `traefik.http.routers.assistedly-web.entrypoints=https`
  - `traefik.http.services.assistedly-web-svc.loadbalancer.server.port=3003`
- Current rule excludes WordPress guide paths from Next.js:
  - `traefik.http.routers.assistedly-web.rule=(Host(assistedly.ai) || Host(www.assistedly.ai) || Host(agent1.assistedly.ai) || Host(agent3.assistedly.ai)) && !PathPrefix(/guide)`
- Reason: avoid Next.js swallowing `/guide/*` routes when WordPress needs admin/API/static access.

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
- Production smoke check (Cloudflare DoH + live headers): `npm run smoke:production`

## CI/CD Expectations
- Deploy flow should include:
   1. Trigger deploy (git pull + compose rebuild + restart)
  2. Cloudflare cache purge
  3. Production smoke check with retries across all public hosts
- Existing scripts:
  - `scripts/ci/trigger-deploy.mjs`
  - `scripts/ci/purge-cloudflare.mjs`
  - `scripts/smoke-production-url.cjs`
- Required GitHub secrets for deploy:
  - `DEPLOY_HOST`: production server IP
  - `DEPLOY_KEY`: SSH private key for `opencode`

## Deploy Script (`scripts/ci/trigger-deploy.mjs`)
Connects via SSH to the production host and runs `git pull && docker compose build --pull && docker compose up -d`.

**Usage:**
```bash
node scripts/ci/trigger-deploy.mjs --host <server-ip>
# or export DEPLOY_HOST=<server-ip> and omit --host
```

**Environment:**
- `DEPLOY_HOST` — server IP (fallback if `--host` not passed)
- `DEPLOY_KEY` — optional SSH private key content (defaults to `~/.ssh/id_ed25519`)

**Behavior:**
- Connects as `opencode`
- CWD on the host: `/opt/assistedly`
- Timeout: 600s (accommodates long `docker compose build --pull`)
- Cleans up temporary key file in `finally` block

## Incident Checks (502 / wrong app version)
1. Confirm edge health:
   - `curl -I https://assistedly.ai/`
2. Confirm origin via local resolve:
   - `curl -k --resolve assistedly.ai:443:127.0.0.1 https://assistedly.ai/ -I`
3. Confirm active router/service in Traefik logs:
   - `sudo docker logs --since 30m easypanel-traefik | grep assistedly-web`
4. Validate compose contract:
   - `cd /opt/assistedly && npm run guard:compose`
5. Validate production returns non-5xx and resolves publicly:
   - `cd /opt/assistedly && npm run smoke:production`

## SSH Access Notes
- SSH user for managed key access: `opencode`
- Key label used operationally: `opencode-25-march`
- Known accessible server IPs:
  - `104.168.38.162`

## Operational Notes
- Traefik may regenerate some file-provider config; prefer fixing public app routing in compose labels for this stack.
- Cloudflare purge alone cannot fix stale/incorrect origin build; always verify origin build and route health.
- Keep backups before editing routing files.
