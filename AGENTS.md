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

## Secrets & Infisical

All secrets are stored in **Infisical** (`https://secrets.assistedly.ai`).

### Infisical Agent Proxy — How bots run Goose

There are two operational modes:

**Single-machine (local):** Goose runs on the same machine as the proxy:  
```bash
infisical secrets agent-proxy run --env=dev -- goose
```  
Use this for local development. Goose holds only placeholder tokens.

**Two-machine (distributed):** Proxy runs on a bastion host, agent is remote:
```bash
# Bastion / proxy host
infisical secrets agent-proxy start --env=dev

# Agent / remote host
infisical secrets agent-proxy connect --env=dev
```  
Use this to limit blast radius if the agent host is compromised. Proxy brokers credentials; agent never touches real values.

**CI/CD:** Use the [Infisical Secrets Action](#cicd-infisical-oidc) (not agent-proxy).

When Goose needs MCP tools that authenticate to third parties (Zapier, PostHog, Zabbix, etc.), always use the **agent-proxy run** mode so Goose never holds real tokens:

```bash
# Option A — from project dir with .infisical.json
INFISICAL_DOMAIN=https://secrets.assistedly.ai \
infisical secrets agent-proxy run --env=dev -- goose

# Option B — fully explicit
INFISICAL_DOMAIN=https://secrets.assistedly.ai \
infisical secrets agent-proxy run \
  --projectId=<your-project-id> \
  --env=dev \
  --path=/coding-agent \
  -- goose
```

- **Benefit:** Goose receives placeholder tokens only. Real credentials are brokered at the network boundary.
- **Goose config**: `~/.config/goose/config.yaml` declares `env_keys` (e.g. `ZAPIER_MCP_TOKEN`, `POSTHOG_API_KEY`, `ZABBIX_API_TOKEN`, `CLOUDFLARE_API_TOKEN`) but contains **NO secret literals**. Values are injected by the agent-proxy at runtime.
- For build scripts (`npm run sync:charts`, `npm run build`) that write real values into static files, use `infisical run --env=dev -- <cmd>` instead.

### CI/CD + Infisical OIDC

GitHub Actions should NOT store Cloudflare tokens (or any secrets) in GitHub Secrets. Instead, fetch them from Infisical at runtime using OIDC identity federation:

**Why:** OIDC eliminates the need to copy secret values into GitHub. Access is granted by policy, not by secret exchange.

**Setup:**
1. In Infisical dashboard → Identity → create a machine identity for GitHub Actions
2. Configure OIDC trust. **Important:** Repositories created after July 15, 2026 use an immutable subject format with numeric IDs. Run `gh api repos/JoshFialkoff/Assistedly.ai/actions/oidc/customization/sub` to get the exact `sub_claim_prefix` value before configuring Infisical. Set:
   - Issuer: `https://token.actions.githubusercontent.com`
   - Audience: `https://github.com/JoshFialkoff` (GitHub default; use `https://secrets.assistedly.ai` only if setting `oidc-audience` in the workflow explicitly)
   - Subject: exact value from `gh api` command above (if repo was created after 2026-07-15)
3. Grant the identity read access to `prod` environment.
4. Set GitHub repository variables (**not secrets**):
   - `INFISICAL_IDENTITY_ID` — the Infisical identity ID
   - `INFISICAL_PROJECT_SLUG` — the Infisical project slug (e.g. `assistedly-ai`)
5. In the workflow, use the Infisical action:

```yaml
- name: Fetch Cloudflare token from Infisical
  id: infisical
  uses: infisical/secrets-action@v1
  with:
    method: "oidc"
    identity-id: "${{ vars.INFISICAL_IDENTITY_ID }}"
    project-slug: "${{ vars.INFISICAL_PROJECT_SLUG }}"
    env-slug: "prod"

- name: Deploy Cloudflare Worker
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: "${{ steps.infisical.outputs.CLOUDFLARE_API_TOKEN }}"
    command: deploy --config wrangler-slot4.toml
```

**Current status:** The workflow includes `continue-on-error: true` on the Infisical step as we transition from GitHub Secrets → Infisical OIDC. Once confirmed working, remove that flag and the `secrets.*` fallback. See `vars.INFISICAL_IDENTITY_ID` in repo Settings.

**Post-setup cleanup:** After confirming OIDC works in CI/CD, remove Universal Auth from the identity in Infisical so it can only authenticate via GitHub OIDC — otherwise the identity has two independent auth paths.

### Infisical UI Setup Checklist (human action required)

See `.goose/memory/infisical-todo.txt` for dashboard items to enable:
- [ ] GitHub Secret Scanning (connect repo)
- [ ] Secret Rotation schedules for remaining static keys
- [ ] Dynamic Secrets for DB credentials

### Custom Secret Rotation (Self-Hosted Infisical)

Infisical's built-in **Secret Rotation** and **Dynamic Secrets** are paid-only features.
For self-hosted / free-plan Infisical, we use a scheduled GitHub Actions workflow
that rotates Cloudflare API tokens programmatically.

#### Architecture
- **Scheduler:** `.github/workflows/rotate-secrets.yml` (weekly cron + manual dispatch)
- **Script:** `scripts/ci/rotate-cloudflare-token.mjs`
  1. Fetch current token from Infisical via API.
  2. Create new Cloudflare token via Cloudflare API (using a dedicated `CLOUDFLARE_ROTATION_TOKEN`).
  3. Test the new token against the zone.
  4. Update Infisical with the new token value.
  5. (Optional) Revoke the old token after a grace period.

#### Setup Required

1. **Create `CLOUDFLARE_ROTATION_TOKEN`** — use your **Global API Key** (not an API token):
   - Global API Keys have **no token creation quota** (unlike API tokens, which have a ~50 creation limit).
   - Find it at: Cloudflare dashboard → My Profile → API Tokens → Global API Key
   - Also store your Cloudflare account email:
     ```bash
     INFISICAL_DOMAIN=https://secrets.assistedly.ai \
     infisical secrets set CLOUDFLARE_ROTATION_TOKEN="<your-global-api-key>" --env=prod
     
     INFISICAL_DOMAIN=https://secrets.assistedly.ai \
     infisical secrets set CLOUDFLARE_EMAIL="<your-cloudflare-email>" --env=prod
     ```
   - Alternative: If you prefer an API token, create one with `User` → `API Tokens` → `Edit` permission, but note the 50-token lifetime creation quota.

2. **Run a dry-run locally** (requires local Infisical CLI login):
   ```bash
   cd /Users/joshdev/Assistedly.ai && \
   INFISICAL_DOMAIN=https://secrets.assistedly.ai \
   infisical run --env=prod -- node scripts/ci/rotate-cloudflare-token.mjs
   ```

3. **Run a dry-run in CI:**
   ```bash
   # GitHub Actions → rotate-secrets → Run workflow → dry_run=true
   ```

4. **Enable the schedule** by uncommenting the cron line in `.github/workflows/rotate-secrets.yml`.

#### Zero Downtime
Cloudflare supports dual active tokens. The old token remains valid until explicitly revoked,
giving you a grace period to validate the new token in production.

#### Manual Rotation (Emergency)
If the scheduled workflow fails or you need immediate rotation:
```bash
# 1. Generate new token in Cloudflare dashboard
# 2. Update Infisical via CLI
INFISICAL_DOMAIN=https://secrets.assistedly.ai \
infisical secrets set CLOUDFLARE_API_TOKEN="<new-token>" --env=prod

# 3. Verify
INFISICAL_DOMAIN=https://secrets.assistedly.ai \
infisical run --env=prod -- curl -sI https://assistedly.ai/ | head -1
```

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

## Goose Agent Rules
Additional behavioral rules for Goose agents live in `.goose/rules.md`.
