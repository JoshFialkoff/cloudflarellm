# Deployment Checklist for GPT / GEO Changes

## Changes Requiring Deploy

The following files have been modified/created in this session and need to be deployed to production (`assistedly-slot4`) before the Custom GPT and GEO optimization are fully live:

1. **`app/robots.js`** — CRITICAL
   - Currently production blocks GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot
   - Working directory version allows all AI crawlers
   - ⚠️ Without this deploy, no AI search engine can crawl the site

2. **`pages/api/gpt/search-facilities.js`** — NEW
   - Public API endpoint for ChatGPT Custom GPT Actions
   - CORS-enabled for ChatGPT domains

3. **`pages/intake.js`** — MODIFIED
   - AI referrer banner (`AIReferrerBanner`)
   - HowTo Schema.org JSON-LD in `<Head>`

4. **`pages/results.js`** — MODIFIED
   - AI referrer banner

5. **`pages/matched.js`** — MODIFIED
   - AI referrer banner

6. **`components/AIReferrerBanner.js`** — NEW
   - Shared banner component with human-readable AI source labels

7. **`lib/marketingAttribution.js`** — MODIFIED
   - `getAIReferrer()` with `?ai_source=` and `?ai_prompt=` fallback
   - `getAIPrompt()` helper
   - `hasDeterministicTouch` now includes `ai_source`

8. **`lib/posthogClient.js`** — MODIFIED
   - AI cohort registration
   - `captureAIEvent()` with dataLayer push

9. **`lib/gtag.js`** — MODIFIED
   - `pushAIEvent()` / `pushAIConversion()` utilities

10. **`lib/seo/schemaData.js`** — MODIFIED
    - `getHowToIntakeSchema()` for AI citation

11. **`public/llms.txt`** — NEW
    - Curated context for LLM crawlers

12. **`styles/Intake.module.css`** — MODIFIED
    - `.aiBanner` styles

## Pre-Deploy Verification

Already verified in this session:
- ✅ `node scripts/guard-critical-features.mjs` — PASSED
- ✅ `node scripts/guard-no-second-header.mjs` — PASSED
- ✅ `npm run build` — completed successfully

## Deploy Command

```bash
cd /Users/joshdev/Assistedly.ai
rm -rf .open-next .next node_modules/.cache
npm ci && npm run build
npx wrangler deploy --config wrangler-slot4.toml
```

## Post-Deploy Smoke Tests

```bash
# 1. Verify robots.txt allows AI crawlers
curl -s https://assistedly.ai/robots.txt | grep -E "GPTBot|ClaudeBot|PerplexityBot"
# Expected: no "Disallow: /" lines for these agents

# 2. Verify sitemap is accessible
curl -s https://assistedly.ai/sitemap.xml | head -3

# 3. Verify GPT API endpoint
curl -s "https://assistedly.ai/api/gpt/search-facilities?town=Newton&limit=2" | jq .

# 4. Verify intake page has HowTo schema
curl -s https://assistedly.ai/intake | grep -o 'HowTo' | head -1

# 5. Verify llms.txt
curl -s https://assistedly.ai/llms.txt | head -5
```

## ChatGPT Custom GPT Setup (Manual)

After deploy:
1. Visit https://chat.openai.com/gpts/editor
2. Create new GPT → paste instructions from `gpt/gpt-instructions.md`
3. Actions → upload `gpt/openapi-schema.yaml`
4. Auth: None
5. Privacy policy: https://assistedly.ai/privacy
6. Publish as Public

## OpenAI Search Index

There is no public programmatic API for submitting to the OpenAI Search Index.
OpenAI discovers pages via:
- **OAI-SearchBot** crawling (enabled by `robots.js` allow rules)
- **Sitemap reference** in `robots.js`
- **High-quality structured data** (HowTo, Organization schema)

The `llms.txt` file also helps OAI-SearchBot understand the site context.

Once deployed, OpenAI should begin crawling within days to weeks.
