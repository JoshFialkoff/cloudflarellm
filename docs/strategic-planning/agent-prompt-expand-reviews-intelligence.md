# Agent Prompt: Expand Reviews Crawling & Intelligence Database

> **Source Strategy:** `docs/strategic-planning/2026-08-23-strategic-planning-session.md`  
> **Current Pipeline:** `scripts/sync-reviews-to-nocodb.cjs` (597 lines, aggregates counts only)  
> **Output:** New/augmented scripts, NocoDB tables, local JSON snapshots  
> **Constraint:** All changes are ADDITIVE. No existing feature, table, or API route may be deleted or degraded. Run `node scripts/guard-critical-features.mjs` after every change.

---

## 1. Situation & Goal

The existing `scripts/sync-reviews-to-nocodb.cjs` extracts **aggregate review metadata only** (total count, average rating per platform). The strategy document (`docs/strategic-planning/2026-08-23-strategic-planning-session.md`) defines a B2B "Facility Intelligence Suite" that requires **granular, multi-dimensional data** the current pipeline cannot produce.

**Your mission:** Expand the crawling + database infrastructure to support these intelligence modules, using **Firecrawl as the primary extraction engine**:

| Intelligence Module | What Data Is Needed | Current Gap |
|---|---|---|
| **Listing Health Score** | Per-platform presence, photo counts, pricing disclosed, amenity tags | Only review counts are scraped |
| **Review Velocity Tracking** | New reviews/week per platform, trend direction | Only cumulative counts; no longitudinal delta |
| **Cross-Platform Sentiment Comparison** | Per-platform average rating, review text sentiment scores | No ratings reliably extracted; no sentiment analysis |
| **Review Response Rate Benchmarking** | Facility response rate vs. comp-set median | Response data not collected at all |
| **Spam / Authenticity Forensics** | Individual review text, reviewer names, dates, account signals | Only aggregate metadata; no review-level extraction |
| **Occupancy Trend Estimation** | FOIA occupancyRate + review velocity proxy model | Data exists but no combined model |
| **Amenity Gap Analysis** | Scraped amenity lists per platform vs. FOIA + comp-set | Amenities not scraped |
| **Competitive Pricing Intelligence** | Listed price per platform vs. FOIA feeLow/feeHigh | Prices not scraped from directory pages |

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  INPUTS                                                            │
│  ├── chart-facilities.json (273 MA facilities, FOIA data)         │
│  ├── Existing review-snapshots/*.json (timestamped history)          │
│  └── NocoDB facility_reviews table (current aggregate records)       │
├────────────────────────────────────────────────────────────────────┤
│  NEW PIPELINE: scripts/sync-facility-intelligence.cjs               │
│  ├── Phase A — Deep Listing Scrape (Firecrawl rawHtml + markdown)   │
│  ├── Phase B — Individual Review Extraction (Firecrawl structured)  │
│  ├── Phase C — Signal Analysis (local compute, no ML model needed)   │
│  └── Phase D — NocoDB Write + Local Snapshot                       │
├────────────────────────────────────────────────────────────────────┤
│  NEW / EXPANDED NOCODB TABLES                                      │
│  ├── facility_listings     (Listing Health Score raw data)         │
│  ├── facility_reviews_deep (individual review text + metadata)    │
│  └── facility_forensics    (spam signals + computed flags)        │
├────────────────────────────────────────────────────────────────────┤
│  OUTPUTS                                                           │
│  ├── public/data/intelligence-snapshots/<timestamp>.json           │
│  ├── public/data/comp-sets/<facility-slug>.json (competitive sets) │
│  └── NocoDB rows in new tables + augmented existing facility_reviews │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Current State Reference

### 3.1 Existing Review Pipeline (`scripts/sync-reviews-to-nocodb.cjs`)

**Key functions you must understand before modifying:**
- `firecrawlSearch(query)` — runs `firecrawl search <query> --limit 5 --json`
- `firecrawlScrapeRawHtml(url)` — runs `firecrawl scrape <url> --format rawHtml --only-main-content --wait-for 3000`
- `firecrawlScrapeMarkdown(url)` — markdown fallback when rawHtml fails
- `extractReviewSignals(rawHtml, meta)` — regex/JSON-LD parsing of aggregate review data
- `extractJsonLdRatings(html)` — schema.org extraction
- `nocoCreateReviewRecord(record, facilityId)` — writes to NocoDB v3 API
- `fetchFacilityMap()` — loads NocoDB facility name→ID map for LinkToAnotherRecord

**Current data extracted per platform:**
```json
{
  "platform": "APlaceForMom",
  "url": "...",
  "review_count": 38,
  "average_rating": null,
  "detected_platforms": [],
  "sample_review_dates": [],
  "sample_reviewer_count": 0,
  "reviewer_account_signal": "...",
  "page_title": "...",
  "page_description": "...",
  "extraction_confidence": "medium",
  "_jsonLd_extracted": false
}
```

### 3.2 NocoDB Credentials
- URL: `http://23.95.189.106:8080`
- Base ID: `pfeipqmy5ybhs71`
- Facilities table: `mix4o0ymn0l2nhz` (linked via `facility_name` column)
- Current reviews table: `m6iaq5juhovxdou` (will remain; new tables added separately)

### 3.3 chart-facilities.json Structure
Each facility object has:
```json
{
  "id": 0,
  "name": "Winchester Mount Vernon House",
  "city": "Winchester",
  "cityClean": "Winchester",
  "zipCode": "1890",
  "taxStatus": "Not-for-profit",
  "totalUnits": 17,
  "occupancyRate": 35,
  "feeLow": 6160,
  "feeHigh": null,
  "safetyScore": 20,
  "stabilityScore": 85,
  "lat": 42.4523178,
  "lng": -71.1369982,
  "insurance": { "gafc": false, "sco": false, "pace": false, ... }
}
```

---

## 4. Phase A — Deep Listing Scrape via Firecrawl

**Goal:** For each facility, discover and scrape its listing page on each platform to extract: presence, photos, pricing, amenities, response behavior signals.

### 4.1 Platform-Specific Search Queries

Reuse the existing search function but add optimized queries per platform:

```javascript
const platformQueries = [
  {
    name: "APlaceForMom",
    searchQuery: (fac) => `"${fac.name}" ${fac.cityClean} Massachusetts site:aplaceformom.com`,
    listingIndicators: ["aplaceformom.com/community"],
    blacklistPatterns: ["/assisted-living-facilities/", "/best-", "/top-"]
  },
  {
    name: "Caring",
    searchQuery: (fac) => `"${fac.name}" ${fac.cityClean} Massachusetts site:caring.com/senior-living`,
    listingIndicators: ["caring.com/senior-living/massachusetts/"],
    blacklistPatterns: ["/best-", "/top-"]
  },
  {
    name: "SeniorAdvisor",
    searchQuery: (fac) => `"${fac.name}" ${fac.cityClean} Massachusetts site:senioradvisor.com`,
    listingIndicators: ["senioradvisor.com/assisted-living/"],
    blacklistPatterns: []
  },
  {
    name: "Google",
    searchQuery: (fac) => `"${fac.name}" ${fac.cityClean} Massachusetts assisted living`,
    listingIndicators: ["google.com/maps", "google.com/search"],
    blacklistPatterns: []
  },
  {
    name: "Yelp",
    searchQuery: (fac) => `"${fac.name}" ${fac.cityClean} Massachusetts site:yelp.com/biz`,
    listingIndicators: ["yelp.com/biz/"],
    blacklistPatterns: ["yelp.com/search"]
  }
];
```

### 4.2 Extraction Patterns Per Platform

Create a new function `extractListingIntelligence(rawHtml, meta, platform)` that returns:

```typescript
interface ListingIntelligence {
  platform: string;
  url: string;
  facility_found: boolean;        // Was a specific facility page found?
  page_type: "facility_listing" | "directory_search" | "aggregate" | "unknown";

  // Listing Health fields
  photos_present: boolean;
  photo_count_estimate: number | null;   // Regex: /(\d+)\s*photo/i or count <img> tags in gallery section
  pricing_disclosed: boolean;
  price_text: string | null;            // Raw text near pricing element
  price_parsed_low: number | null;      // Extracted dollar value
  price_parsed_high: number | null;

  // Amenity fields
  amenities_list: string[];             // Normalized amenity strings
  care_types_listed: string[];          // e.g., "assisted living", "memory care", "independent living"

  // Response behavior (if visible on page)
  response_rate_visible: boolean;
  response_rate_text: string | null;    // e.g., "Responded to 85% of reviews"
  owner_response_count: number | null;
  total_reviews_on_page: number | null;

  // Meta
  page_title: string | null;
  page_description: string | null;
  last_scraped_at: string;             // ISO timestamp
  extraction_confidence: "high" | "medium" | "low";
  _extractor_version: string;           // e.g., "2026-08-23-v1"
}
```

#### Firecrawl Scrape Commands to Use

For each discovered URL:
1. **Primary:** `firecrawl scrape <url> --format rawHtml --only-main-content --wait-for 3000 --json`
2. **Fallback:** `firecrawl scrape <url> --format markdown --only-main-content --wait-for 3000 --json`
3. **Structured (NEW — use this for individual reviews):** `firecrawl scrape <url> --only-main-content --json` (returns structured JSON with sections)

#### Regex / Parsing Strategy

**Photos:**
```javascript
const photoPatterns = [
  /(\d+)\s*photos?/i,
  /photo\s*gallery\s*\((\d+)\)/i,
  /<img[^>]*class="[^"]*gallery[^"]*"/gi, // count matches
];
```

**Pricing:**
```javascript
const pricePatterns = [
  /\$([\d,]+)\s*-\s*\$([\d,]+)/,           // "$4,500 - $6,200"
  /starting\s*at\s*\$([\d,]+)/i,             // "Starting at $4,500"
  /from\s*\$([\d,]+)/i,
  /\$([\d,]+)\s*\/?\s*month/i,              // "$4,500/month"
];
```

**Amenities (normalize to controlled vocabulary):**
```javascript
const AMENITY_VOCABULARY = [
  "24-hour staff", "transportation", "medication management", "memory care",
  "dementia care", "private rooms", "pet friendly", "fitness center",
  "dining services", "housekeeping", "laundry", "social activities",
  "physical therapy", "respite care", "hospice care", "wi-fi",
  "barber/salon", "library", "garden/patio", "parking"
];
// Scan page text and map fuzzy matches to canonical terms
```

**Response Rate:**
```javascript
const responsePatterns = [
  /responded to (\d+)%/i,
  /responds?[\s\w]*within/i,
  /owner response/i,
];
```

---

## 5. Phase B — Individual Review Extraction

**Goal:** Extract individual reviews (text, reviewer name, date, rating) from listing pages where possible. This is REQUIRED for Spam / Authenticity Forensics.

### 5.1 Firecrawl Structured Extraction

Firecrawl supports schema extraction. Use this approach for platforms that render reviews in predictable DOM structures:

```javascript
// Pseudocode for structured extraction request
// Firecrawl's API supports an "extract" parameter with a JSON schema
// The CLI may not support this directly; if not, use rawHtml + cheerio-like regex parsing

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          reviewer_name: { type: "string" },
          review_date: { type: "string" },
          rating: { type: "number" },
          review_text: { type: "string" },
          platform: { type: "string" },
          is_owner_response: { type: "boolean" }
        }
      }
    }
  }
};
```

If Firecrawl CLI doesn't support `extract`, fall back to HTML parsing via regex patterns per platform:

**APlaceForMom review card pattern (approximate — verify against actual HTML):**
```javascript
// Look for repeated structures like:
// <div data-testid="review-card"> ... <span class="reviewer-name">Jane D.</span> ... <div class="review-text">...</div> ...
const reviewBlockPatterns = {
  APlaceForMom: /<div[^>]*class="[^"]*review[^"]*"[^>]*>.*?<\/div>/gis,
  Caring: /<div[^>]*class="[^"]*review-card[^"]*"[^>]*>.*?<\/div>/gis,
  Google: /<div[^>]*class="[^"]*review[^"]*"[^>]*>.*?<\/div>/gis,
  SeniorAdvisor: /<div[^>]*class="[^"]*review[^"]*"[^>]*>.*?<\/div>/gis,
};
```

### 5.2 Minimum Viable Review Extraction

For platforms where individual extraction is blocked or fails, **gracefully degrade** to:
- Aggregate count + average rating (current behavior)
- Sample of review texts embedded in page meta/description
- Page title + description sentiment (lightweight)

Never let one platform's extraction failure block the entire pipeline.

---

## 6. Phase C — Signal Analysis & Computed Intelligence

**Goal:** Process scraped data into actionable intelligence signals without ML models (rule-based + statistical only).

### 6.1 Review Velocity Computation

Requires reading previous snapshot(s) from `public/data/review-snapshots/`:

```javascript
function computeVelocity(currentPlatforms, facilityName, previousSnapshots) {
  // 1. Find the most recent prior snapshot for this facility
  // 2. For each platform, delta = current.review_count - previous.review_count
  // 3. TimeDeltaDays = days_between(current.snapshot_at, previous.snapshot_at)
  // 4. VelocityPerWeek = (delta / TimeDeltaDays) * 7

  return {
    facility_name: facilityName,
    computed_at: new Date().toISOString(),
    prior_snapshot_date: prevDate,
    days_since_prior: timeDeltaDays,
    platform_velocities: [
      { platform: "APlaceForMom", delta_reviews: 2, velocity_per_week: 1.4 },
      { platform: "Google", delta_reviews: 0, velocity_per_week: 0 },
    ],
    overall_velocity_per_week: 1.4,
    trend: "accelerating" | "stable" | "decelerating" | "new_data"
  };
}
```

### 6.2 Cross-Platform Sentiment Comparison

If individual review texts are extracted:

```javascript
function sentimentScore(text) {
  // VADER-like rule-based approach (no external ML dependency)
  // Or use a lightweight positive/negative keyword list
  const positiveWords = ["excellent", "amazing", "loving", "great", "clean", "staff", "caring", "recommend", "happy", "safe"];
  const negativeWords = ["terrible", "awful", "dirty", "neglect", "bad", "rude", "unprofessional", "warning", "avoid", "sad"];
  const words = text.toLowerCase().split(/\s+/);
  const pos = words.filter(w => positiveWords.includes(w)).length;
  const neg = words.filter(w => negativeWords.includes(w)).length;
  return (pos - neg) / Math.max(words.length, 10); // normalized -1 to 1
}

function crossPlatformSentiment(platformReviews) {
  // Group reviews by platform, compute average sentiment per platform
  // Return: "Google: -0.12 (mixed), APFM: +0.34 (positive) — gap: 0.46"
}
```

### 6.3 Spam / Authenticity Forensics Signals

```javascript
function computeForensics(reviews, facilityName) {
  const signals = {
    singleReviewAccounts: 0,
    burstClusteringEvents: 0,
    crossPlatformDuplicates: 0,
    templateLanguageFlags: 0,
    ratingDistributionSkew: null,
    employeeReviewerFlags: 0,
    // ...
  };

  // 1. Single-review accounts
  signals.singleReviewAccounts = reviews.filter(r => r.reviewer_total_reviews === 1).length;

  // 2. Burst clustering — reviews within 7-day window
  const dateGroups = groupByWindow(reviews.map(r => r.review_date), 7);
  signals.burstClusteringEvents = dateGroups.filter(g => g.length >= 3).length;

  // 3. Cross-platform text duplication
  signals.crossPlatformDuplicates = detectSimilarPairs(reviews, 0.85);

  // 4. Template language — repeated phrases across non-related reviewers
  const phrases = extractNgrams(reviews.map(r => r.review_text), 4);
  signals.templateLanguageFlags = phrases.filter(p => p.count >= 3 && p.distinctReviewers >= 3).length;

  // 5. Rating distribution skew
  signals.ratingDistributionSkew = chiSquareUniformTest(reviews.map(r => r.rating));

  return {
    facility_name: facilityName,
    computed_at: new Date().toISOString(),
    total_reviews_analyzed: reviews.length,
    overall_risk_score: computeWeightedRisk(signals), // 0-100
    signals,
    flagged_reviews: reviews.filter(r => r.flags?.length > 0).map(r => ({
      reviewer_name: r.reviewer_name,
      platform: r.platform,
      flags: r.flags,
      confidence: r.confidence
    })),
    recommendations: generateRecommendations(signals)
  };
}
```

### 6.4 Occupancy Proxy Model

```javascript
function occupancyProxy(foiaOccupancyRate, reviewVelocityTrend, daysSinceLastSnapshot) {
  // Simple composite model — no ML required
  // Base = FOIA occupancyRate (most reliable when available)
  // If FOIA data is old (>90 days) or missing, use:
  //   - Review velocity as proxy (higher velocity = higher occupancy or crisis)
  //   - Combine with listing price changes (price drops suggest vacancies)

  const base = foiaOccupancyRate ?? 75; // industry average
  const velocityFactor = reviewVelocityTrend > 2 ? 5 : reviewVelocityTrend < 0.2 ? -5 : 0;
  const estimated = Math.min(100, Math.max(0, base + velocityFactor));

  return {
    foia_value: foiaOccupancyRate,
    foia_age_days: daysSinceLastSnapshot,
    review_velocity_trend: reviewVelocityTrend,
    estimated_occupancy: estimated,
    confidence: foiaOccupancyRate ? "medium" : "low",
    model_version: "proxy-v1-2026-08-23"
  };
}
```

---

## 7. Phase D — NocoDB Schema Design

### 7.1 New Table: `facility_listings`

| Column | Type | Notes |
|---|---|---|
| `id` | AutoNumber | Primary key |
| `facility_name` | LinkToAnotherRecord | → `mix4o0ymn0l2nhz` |
| `snapshot_at` | DateTime | |
| `platform` | SingleLineText | "APlaceForMom", "Caring", etc. |
| `url` | SingleLineText | |
| `facility_found` | Checkbox | |
| `page_type` | SingleLineText | facility_listing / directory_search / unknown |
| `photos_present` | Checkbox | |
| `photo_count_estimate` | Number | nullable |
| `pricing_disclosed` | Checkbox | |
| `price_text` | LongText | nullable |
| `price_parsed_low` | Decimal | nullable |
| `price_parsed_high` | Decimal | nullable |
| `amenities_json` | LongText | JSON array of normalized amenity strings |
| `care_types_json` | LongText | JSON array |
| `response_rate_visible` | Checkbox | |
| `response_rate_text` | LongText | nullable |
| `owner_response_count` | Number | nullable |
| `total_reviews_on_page` | Number | nullable |
| `page_title` | LongText | nullable |
| `page_description` | LongText | nullable |
| `extraction_confidence` | SingleLineText | high / medium / low |
| `extractor_version` | SingleLineText | |

### 7.2 New Table: `facility_reviews_deep`

| Column | Type | Notes |
|---|---|---|
| `id` | AutoNumber | |
| `facility_name` | LinkToAnotherRecord | → `mix4o0ymn0l2nhz` |
| `listing_snapshot` | LinkToAnotherRecord | → `facility_listings` (optional) |
| `platform` | SingleLineText | |
| `source_url` | SingleLineText | |
| `reviewer_name` | SingleLineText |掩码处理 if PII concern |
| `review_date` | Date | |
| `rating` | Decimal | 1–5 scale, nullable |
| `review_text` | LongText | First 2000 chars |
| `review_text_hash` | SingleLineText | SHA-256 of full text for dedup |
| `is_owner_response` | Checkbox | |
| `reviewer_total_reviews` | Number | If visible on platform (e.g., "Jane's 1st review") |
| `reviewer_location` | SingleLineText | If visible |
| `extraction_confidence` | SingleLineText | |
| `extracted_at` | DateTime | |

### 7.3 New Table: `facility_forensics`

| Column | Type | Notes |
|---|---|---|
| `id` | AutoNumber | |
| `facility_name` | LinkToAnotherRecord | → `mix4o0ymn0l2nhz` |
| `computed_at` | DateTime | |
| `analysis_period_start` | Date | |
| `analysis_period_end` | Date | |
| `total_reviews_analyzed` | Number | |
| `overall_risk_score` | Decimal | 0–100 |
| `risk_level` | SingleLineText | LOW / MEDIUM / HIGH |
| `signals_json` | LongText | Full JSON of all signals |
| `flagged_reviews_json` | LongText | Array of flagged review summaries |
| `recommendations_json` | LongText | Array of string recommendations |
| `report_markdown` | LongText | Human-readable forensics report |
| `model_version` | SingleLineText | |

### 7.4 NocoDB API Note

The current pipeline uses **v3 data API** (`/api/v3/data/{baseId}/{tableId}/records`). Continue using this for new tables. Example payload:

```javascript
const payload = {
  fields: {
    facility_name: facilityId ? [{ id: facilityId }] : [],
    snapshot_at: new Date().toISOString(),
    platform: listing.platform,
    url: listing.url,
    facility_found: listing.facility_found,
    // ... etc
  }
};
```

---

## 8. File Structure & Implementation Plan

### 8.1 New Files to Create

| File | Purpose |
|---|---|
| `scripts/sync-facility-intelligence.cjs` | **Main orchestrator** — runs Phases A→D for a batch of facilities |
| `scripts/lib/intelligence-extractors.cjs` | Shared extraction functions (listing, review, amenity, price parsers) |
| `scripts/lib/forensics-engine.cjs` | Spam signal detection + forensics report generation |
| `scripts/lib/velocity-calculator.cjs` | Historical delta computation from review-snapshots |
| `scripts/lib/sentiment-scorer.cjs` | Rule-based sentiment scoring (no ML dependency) |
| `scripts/lib/occupancy-proxy.cjs` | FOIA + review velocity composite model |
| `public/data/intelligence-snapshots/` | Output directory for JSON snapshots |
| `public/data/comp-sets/` | Output directory for competitive set JSON files |

### 8.2 Existing Files to Modify (ADDITIVELY)

| File | Modification |
|---|---|
| `scripts/sync-reviews-to-nocodb.cjs` | **DO NOT DELETE.** Add a deprecation banner in the header comment: "Deprecated in favor of scripts/sync-facility-intelligence.cjs — kept for backward compatibility" |
| `recipes/weekly-review-sync.yaml` | Update to run `sync-facility-intelligence.cjs` instead (or run both side-by-side during transition) |
| `lib/nocodb.ts` | Add TypeScript interfaces for new tables (optional, for future dashboard consumption) |

### 8.3 Critical: Do NOT Modify

- `scripts/guard-critical-features.mjs` — run it, don't edit it
- `scripts/guard-no-second-header.mjs` — run it, don't edit it
- `AGENTS.md` — do not remove or degrade
- `FEATURE_MANIFEST.md` — do not remove or degrade
- Any page/component/API in `FEATURE_MANIFEST.md` pattern list
- `wrangler-slot4.toml` — no deployment changes without !!APPROVED

---

## 9. Execution Order (Step-by-Step for Agent)

### Step 1: Safety Check
```bash
node scripts/guard-critical-features.mjs
node scripts/guard-no-second-header.mjs
```
Both must pass with ✅ before proceeding.

### Step 2: Create Shared Library (`scripts/lib/intelligence-extractors.cjs`)
Implement:
- `extractListingIntelligence(rawHtml, meta, platform)` → returns `ListingIntelligence` object
- `extractDeepReviews(rawHtml, platform)` → returns array of review objects or null
- `normalizeAmenities(rawText)` → returns canonical amenity array
- `extractPriceFromText(text)` → returns `{ low, high, raw }` or null
- `extractPhotoCount(rawHtml)` → returns number or null

### Step 3: Create Forensics Engine (`scripts/lib/forensics-engine.cjs`)
Implement:
- `detectBurstClustering(reviews, windowDays = 7, threshold = 3)`
- `detectTemplateLanguage(reviews, ngramSize = 4, minFrequency = 3)`
- `detectDuplicateTexts(reviews, similarityThreshold = 0.85)`
- `computeRiskScore(signals)` → weighted 0-100
- `generateForensicsReport(facilityName, signals, flaggedReviews)` → Markdown string

### Step 4: Create Velocity Calculator (`scripts/lib/velocity-calculator.cjs`)
Implement:
- `loadPreviousSnapshots(facilityName, snapshotsDir)` → array of prior platform data
- `computePlatformVelocities(current, previous)` → velocity objects
- `saveVelocityToSnapshot(velocities, outPath)`

### Step 5: Create Sentiment Scorer (`scripts/lib/sentiment-scorer.cjs`)
Implement:
- `scoreText(text)` → -1 to +1 float
- `aggregatePlatformSentiment(reviewsByPlatform)` → per-platform averages
- `sentimentGapReport(platformSentiments)` → human-readable comparison string

### Step 6: Create Occupancy Proxy (`scripts/lib/occupancy-proxy.cjs`)
Implement:
- `estimateOccupancy(foiaRate, foiaDate, reviewVelocity, priceHistory)` → proxy object

### Step 7: Build Main Orchestrator (`scripts/sync-facility-intelligence.cjs`)
Structure:
```javascript
async function main() {
  // 1. Load config + validate env vars
  // 2. Load chart-facilities.json
  // 3. Load NocoDB facility map
  // 4. For each facility in batch:
  //    a. Search each platform for listing URL
  //    b. Scrape listing pages (Phase A)
  //    c. Extract deep reviews (Phase B) if enabled
  //    d. Compute velocity, sentiment, forensics (Phase C)
  //    e. Write to NocoDB (Phase D)
  //    f. Wait 3s (respectful delay)
  // 5. Save JSON snapshot
  // 6. Log summary
}
```

### Step 8: NocoDB Table Creation
Manually create the three new tables in NocoDB UI at `http://23.95.189.106:8080`, base `pfeipqmy5ybhs71`, or use the NocoDB API to create them programmatically.

**If creating programmatically (preferred for reproducibility):**
- NocoDB v3 API: `POST /api/v3/meta/bases/{baseId}/tables`
- Or use the NocoDB UI → "Add New Table" → define columns → save table IDs → update script constants.

### Step 9: Test Run (DRY RUN)
```bash
cd /Users/joshdev/Assistedly.ai
INFISICAL_DOMAIN=https://secrets.assistedly.ai infisical run --env=dev -- \
  REVIEW_DRY_RUN=1 REVIEW_BATCH_SIZE=3 node scripts/sync-facility-intelligence.cjs
```
Verify:
- JSON snapshot created in `public/data/intelligence-snapshots/`
- No NocoDB writes occurred
- Console logs show Phase A + B extraction results
- No errors from `scripts/guard-critical-features.mjs`

### Step 10: Live Run (small batch)
```bash
INFISICAL_DOMAIN=https://secrets.assistedly.ai infisical run --env=dev -- \
  REVIEW_BATCH_SIZE=5 node scripts/sync-facility-intelligence.cjs
```
Verify NocoDB rows created in new tables.

### Step 11: Update Weekly Recipe
Edit `recipes/weekly-review-sync.yaml` to reference the new script.

### Step 12: Final Safety Check
```bash
node scripts/guard-critical-features.mjs
node scripts/guard-no-second-header.mjs
```

---

## 10. Data Output Specification

### 10.1 Local Snapshot JSON (`public/data/intelligence-snapshots/2026-08-23T12-34-56.json`)

```json
{
  "generatedAt": "2026-08-23T12:34:56.789Z",
  "script_version": "2026-08-23-v1",
  "batchSize": 10,
  "dryRun": false,
  "facilitiesProcessed": 10,
  "linkedFacilities": 10,
  "data": [
    {
      "facility_name": "Armbrook Village Assisted Living",
      "city": "Westfield",
      "state": "MA",
      "snapshot_at": "2026-08-23T12:34:56.789Z",
      "noco_facility_id": "abc123",
      "listings": [
        {
          "platform": "APlaceForMom",
          "url": "https://www.aplaceformom.com/community/armbrook-village-1353453",
          "facility_found": true,
          "page_type": "facility_listing",
          "photos_present": true,
          "photo_count_estimate": 14,
          "pricing_disclosed": true,
          "price_text": "Starting at $4,500 per month",
          "price_parsed_low": 4500,
          "price_parsed_high": null,
          "amenities_list": ["24-hour staff", "medication management", "memory care", "dining services"],
          "care_types_listed": ["assisted living", "memory care"],
          "response_rate_visible": false,
          "owner_response_count": null,
          "total_reviews_on_page": 38,
          "extraction_confidence": "high"
        }
        // ... other platforms
      ],
      "deep_reviews": [
        {
          "platform": "APlaceForMom",
          "reviewer_name": "Sarah M.",
          "review_date": "2026-07-15",
          "rating": 4.5,
          "review_text": "The staff is wonderful and the facility is clean...",
          "is_owner_response": false,
          "reviewer_total_reviews": 1,
          "extraction_confidence": "medium"
        }
      ],
      "velocity": {
        "overall_velocity_per_week": 1.4,
        "trend": "stable",
        "platform_velocities": [...]
      },
      "sentiment": {
        "platform_sentiments": {
          "APlaceForMom": { "average": 0.34, "count": 12, "label": "positive" },
          "Google": { "average": -0.12, "count": 8, "label": "mixed" }
        },
        "cross_platform_gap": 0.46,
        "cross_platform_gap_label": "Google sentiment is 0.46 points lower than APlaceForMom"
      },
      "forensics": {
        "overall_risk_score": 22,
        "risk_level": "LOW",
        "signals": {
          "singleReviewAccounts": 3,
          "burstClusteringEvents": 0,
          "crossPlatformDuplicates": 0,
          "templateLanguageFlags": 1,
          "ratingDistributionSkew": 0.14
        },
        "flagged_reviews": [],
        "recommendations": [
          "3 reviewers have only posted one review total — monitor but not alarming",
          "1 template-like phrase detected across 3 reviews — may indicate solicitation campaign"
        ]
      },
      "occupancy_proxy": {
        "foia_value": 85,
        "foia_age_days": 234,
        "review_velocity_trend": 1.4,
        "estimated_occupancy": 87,
        "confidence": "medium"
      }
    }
  ]
}
```

### 10.2 Competitive Set JSON (`public/data/comp-sets/<facility-slug>.json`)

Generated separately by a comp-set builder step (can be same script or separate):

```json
{
  "subject_facility": "Armbrook Village Assisted Living",
  "subject_city": "Westfield",
  "comp_set_radius_miles": 15,
  "competitors": [
    {
      "name": "Competitor A",
      "distance_miles": 8.2,
      "chart_facility_id": 42,
      "latest_snapshot_date": "2026-08-23",
      "listing_health": { "APlaceForMom": true, "Caring": true, "Google": true },
      "pricing": { "foia_low": 4200, "foia_high": 5800, "listed_low": 4100, "listed_high": 5500 },
      "reviews": { "total_count": 45, "average_rating": 4.2, "velocity_per_week": 0.8 },
      "amenities": ["memory care", "pet friendly", "transportation"],
      "response_rate": "85%"
    }
  ],
  "subject_vs_comp": {
    "pricing_position": "below_median", // or above_median, at_median
    "pricing_gap_dollars": -300,
    "review_count_percentile": 72,
    "rating_percentile": 58,
    "amenity_gaps": ["pet friendly", "fitness center"],
    "recommendation": "Adding pet-friendly policy and fitness program would close gaps with 3 of 5 competitors within 15 miles."
  }
}
```

**Comp-set selection algorithm (simple, no external API):**
1. Filter `chart-facilities.json` to same city OR within 15 miles (haversine distance using `lat`/`lng`)
2. Exclude the subject facility
3. Sort by distance ascending
4. Select top 5
5. For each, look up the most recent intelligence snapshot

---

## 11. Safety & Compliance Rules

### Hard Stops (from AGENTS.md / FEATURE_MANIFEST.md)
- ❌ Do NOT delete `scripts/sync-reviews-to-nocodb.cjs`. Mark deprecated, keep running.
- ❌ Do NOT modify `wrangler-slot4.toml`.
- ❌ Do NOT delete or degrade any existing page, component, or API route.
- ❌ Do NOT add `robots noindex` to any page.
- ❌ Do NOT hard-replace homepage copy.
- ❌ Do NOT modify DNS records.
- ❌ Do NOT remove `AGENTS.md`, `FEATURE_MANIFEST.md`, or any guard script.

### Data Privacy Rules
- Reviewer names: store in NocoDB but **never expose in public JSON snapshots**. Use hashes or redaction in `public/data/`.
- Review text excerpts: limit to 2000 characters in NocoDB; truncate in public JSON.
- Do NOT scrape private pages or pages behind login walls (except via future Chrome Extension with explicit user permission).
- Respect `robots.txt` on all target domains.

### Rate Limiting & Ethics
- Maximum 1 request per 3 seconds per platform per facility.
- Use Firecrawl responsibly; do not hammer APIs.
- If a platform returns 403/429, back off with exponential delay and log the failure.

---

## 12. Acceptance Criteria

The implementation is complete when ALL of the following are true:

1. [ ] `scripts/sync-facility-intelligence.cjs` exists and runs without fatal errors
2. [ ] `scripts/lib/intelligence-extractors.cjs` contains all Phase A extraction functions
3. [ ] `scripts/lib/forensics-engine.cjs` implements at least 5 spam/forensics signals
4. [ ] `scripts/lib/velocity-calculator.cjs` computes review velocity from historical snapshots
5. [ ] `scripts/lib/sentiment-scorer.cjs` provides rule-based sentiment scoring
6. [ ] `scripts/lib/occupancy-proxy.cjs` combines FOIA + velocity into occupancy estimate
7. [ ] NocoDB has 3 new tables: `facility_listings`, `facility_reviews_deep`, `facility_forensics`
8. [ ] A dry-run test on 3 facilities produces a valid JSON snapshot in `public/data/intelligence-snapshots/`
9. [ ] `scripts/guard-critical-features.mjs` passes with ✅
10. [ ] `scripts/guard-no-second-header.mjs` passes with ✅
11. [ ] `recipes/weekly-review-sync.yaml` is updated to reference the new script (or both scripts)
12. [ ] A comp-set JSON file is generated for at least 1 test facility

---

## 13. Troubleshooting Guide for Agent

| Problem | Likely Cause | Fix |
|---|---|---|
| Firecrawl returns empty rawHtml | JS-rendered page, bot detection | Increase `--wait-for` to 5000ms; try markdown fallback |
| NocoDB LinkToAnotherRecord fails | Wrong facility ID or table schema mismatch | Verify `facility_name` column uses `[{ id: facilityId }]` format in v3 API |
| Regex patterns don't match | Platform changed DOM structure | Update patterns; add `_extractor_version` to track schema drift |
| Sentiment scores all zero | No positive/negative keyword matches | Expand keyword lists or implement TF-IDF fallback |
| Velocity computation yields NaN | Missing prior snapshot for facility | Skip velocity calculation; emit `trend: "new_data"` |
| Review extraction returns 0 reviews | Reviews behind lazy-load or pagination | Document limitation; flag `extraction_confidence: "low"` |
| `node scripts/guard-critical-features.mjs` fails | File deletion or modification of critical features | Revert any deletions; ensure all feature patterns still exist |

---

## 14. Revision Log

| Date | Version | Author | Changes |
|---|---|---|---|
| 2026-08-23 | v1 | Goose / Strategic Planning Session | Initial prompt from strategy document |

---

> **Next Action:** Execute Steps 1–12 in order. Do NOT deploy to production. Do NOT modify wrangler configs. All changes are local/script-layer only until explicitly approved for deployment.
