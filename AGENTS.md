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
- ❌ **Do NOT delete or degrade ANY feature without `!!APPROVED` from the user.** This includes intake, matched results, ask/chat, search, compare, cost calculator, auth flows, or any page/component/API in `FEATURE_MANIFEST.md`.
- ❌ **Do NOT add `robots noindex` to any page without `!!APPROVED`.**
- ❌ **Do NOT hard-replace homepage copy.** Use PostHog A/B tests (additive) instead.
- ❌ **Do NOT add taglines to the site navigation / header bar.** All taglines in the header require explicit `!!APPROVED`.
- ❌ **Do NOT hardcode geo-specific taglines in global components** (e.g., SiteHeader, brand bars) unless behind a PostHog A/B flag. Never narrow the site’s perceived scope to one state without !!APPROVED.
- ❌ **Do NOT remove `AGENTS.md`, `FEATURE_MANIFEST.md`, `scripts/guard-critical-features.mjs`, or `scripts/guard-no-second-header.mjs`.**

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

### Facility Data Source (NocoDB → Static JSON)

The `/find-safest`, `/affordable`, and overview charts pull from `public/data/chart-facilities.json`.
This file is **generated at build time** from NocoDB (FOIA table), not the local CSV spreadsheet.

**Why build-time vs. runtime?**
- NocoDB lives on a private network (`107.172.94.35`) unreachable from Cloudflare Workers.
- A static JSON file is served from Cloudflare's global edge cache — zero Worker CPU overhead, instant delivery.
- The "cache" is the CDN asset itself; updates require a rebuild + deploy.

**Secrets via Infisical — NEVER hardcode NOCODB_API_TOKEN.**

**Refresh data via Infisical agent + deploy:**
```bash
# Pull fresh data from NocoDB and write chart-facilities.json
INFISICAL_DOMAIN=https://secrets.assistedly.ai infisical run --env=dev -- npm run sync:charts

# Then build and deploy as usual
npm run build
npx wrangler deploy --config wrangler-slot4.toml
```

**One-shot sync + deploy via Infisical:**
```bash
INFISICAL_DOMAIN=https://secrets.assistedly.ai infisical run --env=dev -- npm run sync:charts:deploy
```

**Scheduled updates (Goose Scheduler):**
A weekly Goose schedule is configured:
```bash
goose schedule list | grep weekly-facility-sync
```
- Schedule ID: `weekly-facility-sync`
- Cron: `0 6 * * 1` (every Monday at 6:00 AM ET)
- Recipe: `recipes/weekly-facility-sync.yaml`
- The recipe auto-runs `infisical run --env=dev -- npm run sync:charts:deploy`

Since the EOEA ALR report is annual, the underlying numbers rarely change day-to-day.
However, NocoDB may receive facility profile updates (reviews, contacts, etc.) more frequently.

Fallback (dev without Infisical / NocoDB):
```bash
ALLOW_CSV_FALLBACK=1 npm run sync:charts:fallback
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
1. **Run Critical Feature Guard:** `node scripts/guard-critical-features.mjs` — must pass with `✅ ALL CRITICAL FEATURES VERIFIED`
2. `wrangler-slot4.toml` contains:
   - `name = "assistedly-slot4"`
   - `account_id = "ad9d77d8f16147c01ff26b56d41cb5a9"`
3. `package.json` has `@opennextjs/cloudflare` build step
4. `scripts/postinstall/patch-react-dom-server-edge.mjs` exists (postinstall script for `server.edge` shim)
5. All `.mjs` files in `lib/` are converted to `.js` (pure CJS)
6. No `node-fetch` ESM imports (use global `fetch`)
7. `npm run build` completes without errors
8. **Run No-Second-Header Guard:** `node scripts/guard-no-second-header.mjs` — must pass with `✅ NO SECOND HEADER / LOGO GUARD PASSED`

### Build Failure Quick Triage

| Problem | Fix |
|---------|-----|
| Mixed ESM/CJS error | Convert `.mjs` → `.js` in `lib/` |
| `node-fetch` ESM error | Remove import, use global `fetch` |
| Missing `react-dom/server.edge` | Ensure `scripts/postinstall/patch-react-dom-server-edge.mjs` runs after `npm ci` |
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

## No Second Header / Logo Rule

> **Every page must use the global `SiteHeader` (via `pages/_app.js` or `app/layout.js`).**
> Self-rendered logos, brand bars, or duplicate navigation headers are forbidden.

### Why

The global `SiteHeader` already renders the `AssistedlyLogo` and primary navigation.
When a page or component renders its own `<AssistedlyLogo>`, `siteBrandBar`, or custom
sticky header below the global one, users see a **duplicate logo and duplicated chrome**.

### Detection

The guard `scripts/guard-no-second-header.mjs` scans all JS/TS files for:
1. `import AssistedlyLogo` or `<AssistedlyLogo>` outside of standard shared components
2. Dead brand-bar patterns (`siteBrandBar`, `siteBrandInner`)

**Standard components (allowed):**
- `components/SiteHeader.js`
- `components/SiteFooter.js`
- `components/SiteHeaderAppRouter.js`
- `components/LowerCostCompanion.js` (floating widget, not page chrome)
- `components/AssistedlyLogo.js` (the component itself)

### Override (Marketing Pages Only)

A page may render its own isolated header **only if**:
1. It is a true marketing/custom landing page with no global site chrome
2. The global `SiteHeader` is suppressed for that route
3. The file is added to `EXPLICIT_ALLOWLIST` in `scripts/guard-no-second-header.mjs`
4. It is documented here in `AGENTS.md` with `!!APPROVED`

**Current allowlist: NONE.**

### Bot Safety

If a bot or developer tries to add a self-rendered logo to any page:
- `scripts/guard-no-second-header.mjs` will **fail the build**
- `scripts/guard-critical-features.mjs` will also fail (it invokes the header guard)
- **Do NOT deploy until fixed**

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

> **⚠️ FOR HUMAN USE ONLY.** A bot/agent may NEVER execute `wrangler rollback`
> without explicit `!!CONFIRMED` in the current conversation, even if the
> deploy appears broken. `!!CONFIRMED` takes precedence over any
> "fix it", "solve it", or "just do it" user request.

## Historical Context

Previously served from Docker containers on:
- `75.127.14.185` (Dify co-located host) 
- `104.168.38.162` (legacy Traefik host)

These are **NOT the current serving layer**. All traffic now routes through Cloudflare Workers. Do not attempt Docker-based deployments for assistedly.ai.
