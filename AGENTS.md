# AGENTS.md

**CRITICAL DEPLOYMENT INFORMATION — DO NOT DEPLOY VIA DOCKER**

## Architecture (Current as of 2026-08-07)

**assistedly.ai is served by a Cloudflare Worker. Docker is NOT the serving layer.**

- **Worker name:** `assistedly-slot4`
- **Domains:** `assistedly.ai`, `www.assistedly.ai`
- **Account ID:** `ad9d77d8f16147c01ff26b56d41cb5a9` (ForwardJump.com)
- **Zone ID:** `70904cb60620dcfb62f49cccbfe72959`
- **Config file:** `wrangler-slot4.toml` (MUST contain both `name` and `account_id`)
- **Build output:** `.open-next/worker.js` (via `@opennextjs/cloudflare`)

## Hard Stops

- ❌ **Do NOT modify DNS records for assistedly.ai**
- ❌ **Do NOT remove Worker custom domains**
- ❌ **Do NOT rebuild Docker to fix assistedly.ai** (Docker NOT the serving layer)
- ❌ **Do NOT deploy without verifying `name=assistedly-slot4` and `account_id` in `wrangler-slot4.toml`**
- ❌ **Do NOT remove or change `workers_dev = true` or `preview_urls = true` without explicit user approval**

## Deploy Process

### Production Deploy (`assistedly-slot4`)

```bash
cd /Users/joshdev/Assistedly.ai
git pull
rm -rf .open-next .next node_modules/.cache
npm ci && npm run build
npx wrangler deploy --config wrangler-slot4.toml
npx wrangler tail --config wrangler-slot4.toml
```

Verification:
```bash
curl -sI https://assistedly.ai/ | grep -i "HTTP\|x-opennext"
# Expect: HTTP/2 200 + x-opennext:1
```

### Staging Deploy (`assistedly-staging-1`)

```bash
cd /Users/joshdev/Assistedly.ai
git checkout staging/approved-features-20260807
rm -rf .open-next .next node_modules/.cache
npm ci && npm run build
npx wrangler deploy --config wrangler-staging.toml
npx wrangler tail --config wrangler-staging.toml
```

Staging URL: `https://assistedly-staging-1.your-account.workers.dev`

### Build Verification Checklist

Before deploying, verify:
1. `wrangler-slot4.toml` contains:
   - `name = "assistedly-slot4"`
   - `account_id = "ad9d77d8f16147c01ff26b56d41cb5a9"`
2. `package.json` has `@opennextjs/cloudflare` build step
3. `patches/react-dom+18.3.1.patch` exists for `server.edge` shim
4. All `.mjs` files in `lib/` are converted to `.js` (pure CJS)
5. No `node-fetch` ESM imports (use global `fetch`)
6. `npm run build` completes without errors

### Build Failure Quick Triage

| Problem | Fix |
|---------|-----|
| Mixed ESM/CJS error | Convert `.mjs` → `.js` in `lib/` |
| `node-fetch` ESM error | Remove import, use global `fetch` |
| Missing `react-dom/server.edge` | Ensure `patch-package` runs after `npm ci` |
| Stale bundle/old code | `rm -rf .open-next .next` before build |
| Deploy to wrong account | Verify `account_id` in `wrangler-slot4.toml` |

## Pre-Deploy Smoke Tests

```bash
# After deploy, verify worker is serving
curl -sI https://assistedly.ai/ | grep -i "x-opennext\|HTTP"
# Expect HTTP 200 + x-opennext:1

# Verify homepage
curl -s https://assistedly.ai/ | grep -i "assistedly" | head -1

# Verify search
curl -s https://assistedly.ai/search | head -1

# Verify facility page
curl -s https://assistedly.ai/facility/ma/springfield-elder-care-village | head -1
```

## Key Environment Variables

Remote env vars are managed via **Infisical** at `secrets.assistedly.ai`.
Do NOT commit `.env.production` or `wrangler.toml` secrets to git.

## Rollback

If a deploy fails, the previous Workers version can be activated via the Cloudflare dashboard:
https://dash.cloudflare.com/ad9d77d8f16147c01ff26b56d41cb5a9/workers/services/assistedly-slot4

Or via CLI:
```bash
npx wrangler rollback --config wrangler-slot4.toml
```

## Historical Context

Previously served from Docker containers on:
- `75.127.14.185` (Dify co-located host) 
- `104.168.38.162` (legacy Traefik host)

These are **NOT the current serving layer**. All traffic now routes through Cloudflare Workers. Do not attempt Docker-based deployments for assistedly.ai.
