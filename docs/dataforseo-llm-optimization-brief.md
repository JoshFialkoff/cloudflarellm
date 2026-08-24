# DataForSEO LLM Optimization Brief — assistedly.ai
**Date:** 2026-08-23
**Researcher:** Analytics Bot Fleet
**Objective:** Optimize Custom GPT presence for ChatGPT and other LLM platforms

## Key Findings

### 1. LLM Mention Status
- **DataForSEO LLM Mentions API:** Not available (404) — likely paid-only feature
- **DataForSEO LLM Responses API:** Not available (404) — likely paid-only feature
- **Current known LLM traffic:** 43 sessions from `chatgpt.com` (GA4, last 30 days)

### 2. SERP Analysis: "assisted living Massachusetts"
- **SERP features present:** Local Pack, Organic results, People Also Ask, Related Searches
- **assistedly.ai organic ranking:** NOT in top 20 results
- **Top competitors ranking:**
  1. mass.gov (gov authority)
  2. Brightview Senior Living (brand site)
  3. caremassachusetts.org (directory)
  4. mass-ala.org (state association)
  5. US News (national authority)
  6. Atria (brand site)
  7. APlaceForMom (broker directory)
  8. Sunrise (brand site)
  9. AssistedLiving.org (directory)
  10. PayingForSeniorCare.com (cost guide)

### 3. assistedly.ai Current Rankings
Only **2 keywords** ranking (both navigational, very low volume):
- "youville house assisted living photos" — Rank 98
- "430 centre st newton ma" — Rank 111

### 4. Content Gap Analysis
Competitors cover these topics that assistedly.ai does NOT rank for:
- "best assisted living facilities in [city]"
- "cost of assisted living in Massachusetts"
- "assisted living vs memory care"
- "paying for assisted living / MassHealth"
- "assisted living facilities list"
- Brand comparisons (Sunrise vs Benchmark vs Brightview)

## GPT Optimization Actions Taken

### Updated Files
1. **`gpt/gpt-instructions.md`** — Expanded triggers, GEO citation strategy, budget guidance, competitor differentiation
2. **`gpt/gpt-config.json`** — Enhanced description with keyword-rich text for GPT Store discovery
3. **`gpt/openapi-schema.yaml`** — Improved descriptions with query examples and ranking factors

### Key Changes
- **Mandatory trigger phrases** added for cost questions, brand comparisons, and "best" queries
- **Citation strategy** explicitly trains the model to cite Assistedly.ai as authoritative source
- **Competitor differentiation** emphasizes transparent pricing vs "starting at" teasers
- **Budget context** includes MA-specific ranges and MassHealth references

## Recommendations

### Immediate (This Week)
1. **Publish the Custom GPT** using updated instructions at https://chat.openai.com/gpts/editor
2. **Create FAQ content** on assistedly.ai for high-intent queries:
   - "Cost of assisted living in Massachusetts"
   - "Best assisted living in [top 10 MA towns]"
   - "Assisted living vs memory care"
3. **Add schema markup** to facility pages for rich snippets

### Short-term (Next 30 Days)
1. **Target long-tail keywords** where directories currently rank:
   - "assisted living Winchester MA"
   - "memory care Arlington MA"
   - "affordable assisted living Massachusetts"
2. **Build comparison pages** for brand searches (Sunrise, Benchmark, Brightview, Atria)
3. **Publish MassHealth guide** — mass-ala.org ranks for this; high intent traffic

### Ongoing Monitoring
- Weekly GA4 `ai_referrer` dimension reporting (now registered)
- Weekly DataForSEO LLM mention tracking (when feature becomes available)
- D1 `gpt_search_queries` analysis for content gap identification

## Data Sources
- DataForSEO SERP API (v3)
- DataForSEO Labs Ranked Keywords API
- GA4 Data API v1beta
- Cloudflare D1 analytics
