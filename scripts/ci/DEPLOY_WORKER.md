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

## Deployment Steps

Run in this exact order:

```bash
# 1. Pull latest
cd /Users/joshdev/Assistedly.ai && git pull

# 2. Deep clean build artifacts
rm -rf .open-next .next node_modules/.cache

# 3. Fresh install
npm ci

# 4. Build (OpenNext/Cloudflare)
#    Produces .open-next/worker.js
npm run build

# 5. Deploy
cd /Users/joshdev/Assistedly.ai && npx wrangler deploy --config wrangler-slot4.toml

# 6. Verify new version deployed
npx wrangler versions list --config wrangler-slot4.toml

# 7. Purge Cloudflare cache
#    (Use Cloudflare MCP or CLI)
curl -X POST "https://api.cloudflare.com/client/v4/zones/70904cb60620dcfb62f49cccbfe72959/purge_cache" \
  -H "Authorization: Bearer <CF_API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# 8. Live verification
curl -sI https://assistedly.ai/ | grep -i "HTTP\|x-opennext"
# Expected: HTTP/2 200 + x-opennext: 1
```

---

## Verify Copy / Behavior (post-deploy checklist)

After deploy, confirm these specific content gates:

- [ ] Homepage wizard (`/`) shows **urgency question first**, NOT a login gate
- [ ] `/answers` hero copy reads: `all in plain English from unbiased, private AI` (NOT `without the overwhelm`)
- [ ] No `Get clear answers about cost, care types, ratings, staff quality, and what to do next — all in plain English, without the overwhelm.` text on `/answers`

---

## Build Failure Triage

If `npm run build` fails, check these in order:

### 1. Mixed ESM/CJS in `.mjs` files
- **Rule:** ALL library files under `lib/` must be pure CJS (`.js` extension, `module.exports`, `require()`)
- **Error pattern:** `Could not resolve "./marketingContent.mjs"`
- **Fix:** Rename `.mjs` → `.js`, convert `import`/`export` to `require`/`module.exports`, then update ALL `require` paths to omit `.mjs` extension (e.g., `require("./marketingContent")` not `require("./marketingContent.mjs")`)

### 2. Stale import references
After renaming files, grep for stale references:
```bash
grep -r "\.mjs" lib/ pages/ components/
```

### 3. External dependencies using ESM-only packages
- **Error pattern:** `Module not found: ESM packages (node-fetch) need to be imported`
- **Fix:** Remove `import fetch from "node-fetch"` — Next.js provides global `fetch`; use that instead

### 4. Patch-package / postinstall
- Verify `patches/react-dom+18.3.1.patch` exists and applies correctly
- This patch provides the `react-dom/server.edge` shim that React 18 lacks
- If patch is missing or fails, build will 500 at runtime with:
  `Error: Missing optional dependency "react-dom/server.edge"`
- After `npm ci`, verify the shim exists:
  ```bash
  ls node_modules/react-dom/server.edge.js
  ```

---

## Post-Deploy 500 Errors

If the site returns 500 after a successful deploy:

### 1. Check Worker logs
```bash
cd /Users/joshdev/Assistedly.ai
npx wrangler tail --config wrangler-slot4.toml
```

### 2. Quick rollback
```bash
cd /Users/joshdev/Assistedly.ai
npx wrangler rollback --config wrangler-slot4.toml
```

### 3. Common runtime causes
- `react-dom/server.edge` missing → see Patch-package section above
- Mixed ESM/CJS resolving at runtime but failing in bundled output → rebuild with deep clean (step 2)

---

## Hard Stops (never do these)

- ❌ **Modify DNS records** for `assistedly.ai` or `www.assistedly.ai`
- ❌ **Remove Worker custom domains** from assistedly-slot4
- ❌ **Rebuild or restart Docker containers** to fix assistedly.ai (Docker does NOT serve this site)
- ❌ **Deploy without verifying** `name=assistedly-slot4` and `account_id` in `wrangler-slot4.toml`
- ❌ **Run `npm run build` in temp worktrees** unless you also copy `wrangler-slot4.toml` and `.env.local`

---

## Historical Fixes (for reference)

### 2026-08-06: OpenNext build failure
- Renamed 5 `.mjs` campaign/email libs to `.js` and converted to pure CJS
- Added `account_id` to `wrangler-slot4.toml`
- Created `node_modules/react-dom/server.edge.js` shim + patched `react-dom/package.json` exports
- Later made durable via `patch-package` → `patches/react-dom+18.3.1.patch`

### 2026-08-06: Login gate reappeared on homepage wizard
- Root cause: stale build artifact
- Fix: deep clean + rebuild + deploy

### 2026-08-06: /answers hero copy reverted
- Root cause: Cloudflare cache
- Fix: deploy + purge cache

---

## Related Files

- `wrangler-slot4.toml` — Worker deploy config (name + account_id)
- `wrangler.toml` — Legacy/backup config (do NOT use for production deploys)
- `open-next.config.ts` — OpenNext build configuration
- `package.json` — Contains `postinstall` script for patch-package
- `patches/react-dom+18.3.1.patch` — Durable shim for react-dom/server.edge
- `lib/marketingContent.js` — Campaign content (was `.mjs`, now `.js`)
- `lib/magicLinkEmail.js` — Auth email (was `.mjs`, now `.js`)
- `lib/dripCampaign.js` — Drip emails (was `.mjs`, now `.js`)
- `lib/referralCampaign.js` — Referral emails (was `.mjs`, now `.js`)
- `lib/evangelistCampaign.js` — Evangelist emails (was `.mjs`, now `.js`)
