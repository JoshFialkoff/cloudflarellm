# AGENTS.md

## Repository
- Name: `assistedly` (Next.js app for `assistedly.ai`)
- Server path: `/opt/assistedly`
- Primary branch on host: `main`
- Runtime mode: Docker Compose + Traefik (Easypanel Traefik container)

## Production Topology
- Public domain: `https://assistedly.ai`
- Public edge: Cloudflare
- Reverse proxy: Traefik managed by Easypanel (`easypanel-traefik`)
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
  - `traefik.http.routers.assistedly-web.rule=(Host(assistedly.ai) || Host(www.assistedly.ai)) && !PathPrefix(/guide)`
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
- Production smoke check (5xx fail): `npm run smoke:production`

## CI/CD Expectations
- Deploy flow should include:
  1. Build and deploy container
  2. Cloudflare cache purge
  3. Production smoke check with retries
- Existing scripts:
  - `scripts/ci/trigger-easypanel.mjs`
  - `scripts/ci/purge-cloudflare.mjs`
  - `scripts/smoke-production-url.cjs`

## Incident Checks (502 / wrong app version)
1. Confirm edge health:
   - `curl -I https://assistedly.ai/`
2. Confirm origin via local resolve:
   - `curl -k --resolve assistedly.ai:443:127.0.0.1 https://assistedly.ai/ -I`
3. Confirm active router/service in Traefik logs:
   - `sudo docker logs --since 30m easypanel-traefik | grep assistedly-web`
4. Validate compose contract:
   - `cd /opt/assistedly && npm run guard:compose`
5. Validate production returns non-5xx:
   - `cd /opt/assistedly && PRODUCTION_SMOKE_URL=https://assistedly.ai/ npm run smoke:production`

## SSH Access Notes
- SSH user for managed key access: `rahuljalan`
- Key label used operationally: `rahul-25-march`
- Known accessible server IPs:
  - `107.174.146.230`
  - `172.245.119.156`
  - `107.174.44.66`
  - `107.172.94.35`
  - `104.168.38.162`
  - `75.127.14.185`
  - `198.144.180.149`
  - `23.95.189.106`

## Operational Notes
- EasyPanel may regenerate some Traefik file-provider config; prefer fixing public app routing in compose labels for this stack.
- Cloudflare purge alone cannot fix stale/incorrect origin build; always verify origin build and route health.
- Keep backups before editing routing files.
