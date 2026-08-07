# Cloudflare Worker Deployment Runbook — assistedly-slot4

> **Single source of truth for deploying assistedly.ai via Cloudflare Worker.**
> Created: 2026-08-07
> Architecture: OpenNext/Cloudflare Worker (NOT Docker)

---

## Architecture (locked)

| Property | Value |
|----------|-------|
| Worker name | `assistedly-slot4` |
| Custom domains | `assistedly.ai`, `www.assistedly.ai` |
| Cloudflare account ID | `ad9d77d8f16147c01ff26b56d41cb5a9` |
| Zone ID | `70904cb60620dcfb62f49cccbfe72959` |
| Repo | `/Users/joshdev/Assistedly.ai` |
| Config file | `wrangler-slot4.toml` |
| Build output | `.open-next/worker.js` |

**Hard rule:** `wrangler-slot4.toml` MUST contain BOTH:
- `name = "assistedly-slot4"`
- `account_id = "ad9d77d8f16147c01ff26b56d41cb5a9"`

Deploying without these verified will target the wrong Worker or account.

---

## Production Deploy Steps

Run in this exact order:

```bash
# 1. Pull latest
cd /Users/joshdev/Assistedly.ai && git pull

# 2. Deep clean build artifacts
rm -rf .open-next .next node_modules/.cache

# 3. Fresh install & build
npm ci && npm run build

# 4. Verify build succeeded
ls -la .open-next/worker.js

# 5. Deploy with explicit config
npx wrangler deploy --config wrangler-slot4.toml

# 6. Verify deployment
curl -sI https://assistedly.ai/ | grep -i "HTTP\|x-opennext"
# Expected: HTTP/2 200 + x-opennext:1

# 7. Tail logs if debugging
npx wrangler tail --config wrangler-slot4.toml
```

### Build Verification Checklist

Before every deploy, verify:

1. ✅ `wrangler-slot4.toml` contains `name = "assistedly-slot4"` and `account_id = "ad9d77d8f16147c01ff26b56d41cb5a9"`
2. ✅ `npm run build` outputs `.open-next/worker.js` without errors
3. ✅ `patch-package` applied `react-dom/server.edge` shim (check terminal output)
4. ✅ No ESM/CJS mixed import errors in `lib/*.js`
5. ✅ No `node-fetch` ESM imports (use global `fetch`)

---

## Staging Deploy Steps

Staging uses a separate Worker (`assistedly-staging-1`) with `wrangler-staging.toml`.

```bash
# 1. Switch to staging branch
git checkout staging/approved-features-20260807

# 2. Deep clean
rm -rf .open-next .next node_modules/.cache

# 3. Build
npm ci && npm run build

# 4. Deploy to staging
npx wrangler deploy --config wrangler-staging.toml

# 5. Verify staging URL
curl -sI https://assistedly-staging-1.your-account.workers.dev | grep HTTP
```

### Staging → Production Promotion

1. Merge staging branch to `main` via PR
2. Verify CI passes (Workers Builds)
3. Run production deploy steps above
4. Run production smoke tests

---

## Rollback

If a deploy fails, the previous Workers version can be activated via the Cloudflare dashboard:
https://dash.cloudflare.com/ad9d77d8f16147c01ff26b56d41cb5a9/workers/services/assistedly-slot4

Or via CLI:
```bash
npx wrangler rollback --config wrangler-slot4.toml
```

---

## Hard Stops

- ❌ **Do NOT modify DNS records for assistedly.ai**
- ❌ **Do NOT remove Worker custom domains**
- ❌ **Do NOT try to fix assistedly.ai via Docker** (Docker is NOT the serving layer)
- ❌ **Do NOT deploy without `name=assistedly-slot4` and `account_id` verified**
- ❌ **Do NOT remove `workers_dev = true` or `preview_urls = true` without approval**

---

## Build Failure Quick Triage

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Mixed ESM/CJS error | `.mjs` file in `lib/` | Convert `.mjs` → `.js` (pure CJS) |
| `node-fetch` ESM error | ESM import of `node-fetch` | Remove import, use global `fetch` |
| Missing `react-dom/server.edge` | Patch not applied | Verify `patches/react-dom+18.3.1.patch` exists; run `npx patch-package` |
| Stale bundle/old code | Layer cache | `rm -rf .open-next .next` before every build |
| Deployed but shows old version | Workers cache | Purge Cloudflare cache via dashboard or `npx wrangler deploy --config wrangler-slot4.toml` again |
| Wrong Worker/account | Missing config | Verify `wrangler-slot4.toml` has correct `name` and `account_id` |
| 500 error on homepage | `react-dom/server.edge` missing | Ensure `patch-package` runs in postinstall |

---

## Pre-Deploy Smoke Tests

```bash
# Verify worker header
curl -sI https://assistedly.ai/ | grep -i "x-opennext\|HTTP"
# Expect: HTTP/2 200 + x-opennext:1

# Verify homepage renders
curl -s https://assistedly.ai/ | grep -i "assistedly" | head -1

# Verify search page
curl -s https://assistedly.ai/search | head -1

# Verify facility detail page
curl -s https://assistedly.ai/facility/ma/springfield-elder-care-village | head -1

# Verify /ask page
curl -s https://assistedly.ai/ask | head -1

# Verify health endpoint
curl -s https://assistedly.ai/api/health
```

---

## Historical Context

Previously served from Docker containers on:
- `75.127.14.185` (Dify co-located host)
- `104.168.38.162` (legacy Traefik host)

These are **NOT the current serving layer** as of 2026-08-07. All traffic routes through Cloudflare Workers. Do not attempt SSH-based Docker deployments for assistedly.ai.

---

## Environment Variables

Remote env vars are managed via **Infisical** at `secrets.assistedly.ai`.
Do NOT commit `.env.production` or `wrangler.toml` secrets to git.

For local development, copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
# Then populate required keys via Infisical or user-provided values
```

---

## CI/CD Integration

Workers Builds is connected to GitHub. On push to `main`, a Workers Build triggers automatically.

If you need manual CI deploy (bypassing Workers Builds):
```bash
DEPLOY_HOST=assistedly.ai \
  node scripts/ci/trigger-deploy.mjs
```

But prefer the standard `wrangler deploy --config wrangler-slot4.toml` workflow documented above.
