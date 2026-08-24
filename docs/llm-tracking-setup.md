# LLM Traffic Tracking Setup — Post-Deploy Checklist

## What Changed

### 1. Client-Side AI Referrer Detection (pages/_app.js)
Every pageview now automatically detects if the visitor came from an AI/LLM platform and sends `ai_referrer` to:
- **GA4** via `gtag('event', 'page_view', { ai_referrer: 'chatgpt', ... })`
- **GTM dataLayer** for Custom Event triggers
- **PostHog** as super-properties (`ai_referrer`, `traffic_source`, `is_ai_referred`)

Detection sources (in priority order):
1. URL param `?ai_source=chatgpt` (explicit GPT link attribution)
2. `document.referrer` hostname + path analysis

Supported LLMs: ChatGPT, Perplexity, Claude, Gemini, Copilot, Meta AI, Grok, Poe, You.com, Phind, Kagi, DuckDuckGo AI, HuggingChat, Pi, Character.AI, Brave Leo.

### 2. Marketing Attribution Storage (lib/marketingAttribution.js)
- `syncMarketingTouchFromUrl()` now stores `ai_source` and `ai_prompt` from URL params in sessionStorage
- `getAIReferrer()` upgraded with exact hostname matching and new LLM coverage
- `hasDeterministicTouch` includes `ai_source` so AI traffic gets "confirmed" attribution confidence
- `getSessionMarketingAttribution()` normalizes `ai_source` → `ai_referrer` for GA4/PostHog parity

### 3. PostHog AI Cohorts (lib/posthogClient.js)
- `loaded` callback registers `ai_referrer` as a super-property for the entire session
- New `captureAIEvent(event, properties)` helper for explicit AI funnel events

### 4. GPT Action API Server-Side Logging (pages/api/gpt/search-facilities.js)
- **D1**: Logs `town`, `careType`, `q`, `maxBudget`, `result_count`, `origin`, `ai_source`, `ai_prompt`
- **GA4 Measurement Protocol**: Best-effort server-side event `gpt_search` — requires `GA4_API_SECRET`
- D1 schema auto-migrates with `ALTER TABLE ADD COLUMN` for existing tables

### 5. D1 Schema Updated (scripts/d1-analytics-schema.sql)
Added `ai_source TEXT`, `ai_prompt TEXT`, and index `idx_gpt_search_queries_ai_source`.

## What You Must Do Before Deploy

### ✅ Nothing blocking — code is ready

## What You Must Do After Deploy

### 1. Create GA4 Measurement Protocol API Secret
1. Go to [GA4 Admin](https://analytics.google.com/analytics/web/)
2. Select property **Assistedly.ai**
3. **Data Streams** → **Web** → `G-E65GGHME88`
4. **Measurement Protocol** → **Create** → copy the API Secret
5. Add to Infisical:
   ```bash
   INFISICAL_DOMAIN=https://secrets.assistedly.ai \
   infisical secrets set GA4_API_SECRET="<your-secret>" --env=dev
   ```
6. Re-deploy so the Worker picks up the new env var.

> Without this secret, GPT API calls are still logged to D1 and client-side clicks from GPT links are still tracked. The server-side GA4 event is the only gap.

### 2. Verify GA4 Custom Dimension Is Receiving Data
- Go to GA4 → **Configure** → **Custom definitions** → **Custom dimensions**
- Confirm `ai_referrer` (Scope = Event) exists
- After 24–48 hours, check **Reports** → **Engagement** → **Events** with `ai_referrer` as a secondary dimension

### 3. Verify PostHog AI Cohort
- Open PostHog → **Persons & groups**
- Filter by property `ai_referrer` **is set**
- Create a cohort "AI Referred Users" for funnel analysis

## Pre-Deploy Verification
```bash
cd /Users/joshdev/Assistedly.ai
node scripts/guard-critical-features.mjs   # ✅ PASSED
node scripts/guard-no-second-header.mjs    # ✅ PASSED
npm run build                               # ✅ PASSED
```

## Deploy Command
```bash
cd /Users/joshdev/Assistedly.ai
rm -rf .open-next .next node_modules/.cache
npm ci && npm run build
npx wrangler deploy --config wrangler-slot4.toml
npx wrangler tail --config wrangler-slot4.toml
```

## Post-Deploy Smoke Tests
```bash
# Verify GPT API with ai_source logging
curl -s "https://assistedly.ai/api/gpt/search-facilities?town=Newton&limit=2" | jq .

# Verify intake page tracks ?ai_source=chatgpt
curl -s "https://assistedly.ai/intake?ai_source=chatgpt" | head -1

# Verify GA4 page_view includes ai_referrer (check browser dev tools Network → collect)
```
