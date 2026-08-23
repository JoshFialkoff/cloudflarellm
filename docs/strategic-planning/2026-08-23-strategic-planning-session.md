# Assistedly.ai Strategic Planning — August 23, 2026

> **Status:** Planning document only. No code changes or deployments authorized.  
> **Based on current state:** 273 MA facilities in `chart-facilities.json`, review pipeline operational (25 snapshots / 10 facilities), NocoDB facility_reviews table linked to FOIA master.

---

## Table of Contents

1. [Assistedly's Dashboard & Tools for Facility EDs / Marketing Directors](#1-dashboard--tools-for-facility-eds--marketing-directors)
2. [Review Authenticity / Spam Detection Product](#2-review-authenticity--spam-detection)
3. [Aline Competitive Positioning & API-less Strategy](#3-aline-competitive-positioning)
4. [External Company Classification](#4-external-company-classification)
5. [Yelp Pipeline Expansion Options](#5-yelp-pipeline-expansion)
6. [Product Roadmap Integration](#6-product-roadmap-integration)

---

## 1. Dashboard & Tools for Facility EDs / Marketing Directors

### The Gap Assistedly Can Fill

Aline (and to a lesser extent APFM/Caring portals) own the **CRM and listing management** layer. Assistedly cannot — and should not try to — displace them there. However, Assistedly has **asymmetrical data assets** that no competitor can replicate without building a FOIA infrastructure:

| Assistedly Asset | Why It Matters to EDs/Marketing Directors |
|---|---|
| **FOIA ALR licensing data** (MA EOEA, expandable to other states) | Real-time licensing status, complaint history, staffing ratios, occupancy rates — not available via any directory API |
| **Cross-directory review aggregation** | Unified view of reputation across APFM, Caring, SeniorAdvisor, Google without logging into 4+ portals |
| **Public-data pricing intelligence** | Scraped + FOIA-reported fee ranges per geography; competitive positioning without revealing proprietary rates |
| **Consumer intent signals** (intake wizard data, anonymized) | "What do families in [town] actually care about?" — search/filter patterns, budget distributions, care-level needs |
| **Independent positioning** | No commission on placement = no ranking manipulation = credibility with families |

### Recommended Product: "Assistedly Intelligence for Communities"

**Tier 1: Free / Freemium Dashboard**

A lightweight, no-login-required public insight layer that builds trust and draws facility staff in:

- **Listing Health Score** — cross-directory audit. Is your facility listed on APFM? Caring? Google Business? Are photos present? Is pricing disclosed? Are amenities consistent?
- **FOIA Public Profile** — what families see on Assistedly (safety scores, licensing status, inspection summaries). Facilities cannot edit FOIA data, but they can claim their profile to add context.
- **Town-Level Market Snapshot** — anonymized: "In Lexington, MA, families search for memory care 3× more than assisted living" (drives facility expansion/marketing decisions).

**Tier 2: Paid Intelligence Suite ($99–$299/mo per community, or $1,500–$5,000/mo per portfolio)**

Behind an auth wall, requiring facility staff to claim/verify their community:

#### Module A: Reputation Intelligence
- Review velocity tracking across all platforms (new reviews/week trend)
- Cross-platform sentiment comparison ("Google: 4.2★, APFM: 3.8★ — why the gap?")
- Review response rate benchmarking vs. local competitors
- **Spam / Authenticity Forensics** (see Section 2)

#### Module B: Competitive Market Intelligence
- Comp-set builder: select 3–5 nearby communities to benchmark against
- Pricing spread analysis (FOIA-reported feeLow/feeHigh vs. scraped directory pricing vs. comp-set)
- Occupancy trend estimation (from FOIA occupancyRate where available + review velocity as proxy)
- Amenity gap analysis ("3 of your 5 comp-set communities list dementia care as a specialty; you do not")

#### Module C: Consumer Search Intelligence
- Search query audit (from Assistedly's own search logs + SEO data): "In your town, the #1 search filter is 'accepts Medicaid'"
- Intake wizard outcome tracking: "Of families who started your profile, 62% prioritized safety scores; 28% filtered by pet policy"
- Geographic demand heatmap: zip codes with highest search volume but lowest facility density

#### Module D: FOIA Compliance Alerts
- License expiration warnings (60/30/7 days) with renewal guidance
- New inspection / complaint alerts (whenever MA EOEA publishes updates)
- Staffing ratio threshold warnings (if reported ratios fall below state minimum)
- **This is Assistedly's moat.** No directory, CRM, or marketing agency can provide this without building a FOIA pipeline.

### Integration Strategy with Aline / APFM / Caring

Rather than competing, **become the intelligence layer that feeds into these platforms:**

| Integration Point | How |
|---|---|
| **Aline CRM** | Weekly CSV export / API push of new review alerts, FOIA compliance deadlines, competitive price changes directly into their CRM as "tasks" or "alerts" |
| **APFM / Caring portals** | Chrome Extension that overlays Assistedly's public data (FOIA scores, cross-platform review summary) on top of their own dashboard while facility staff are logged in |
| **Email** | Weekly "Assistedly Community Brief" — digest of all competitive, review, and compliance events for their community |
| **Slack / Teams** | Webhook integration for real-time alerts ("New negative review on Google," "Competitor dropped pricing") |

### Differentiation from Aline's "AI-Powered Listing Optimizer"

Aline's optimizer is **reactive**: it improves how a facility appears on directories. Assistedly is **proactive + external-contextual**: it tells facilities what families actually search for, what competitors are doing, and what regulatory risks are approaching. Aline optimizes the listing; Assistedly optimizes the *business strategy*.

**Key messaging:** "Aline makes your listing look better. Assistedly tells you what to list, what to price, and what to worry about."

---

## 2. Review Authenticity / Spam Detection

### Current Pipeline State

The existing pipeline (`scripts/sync-reviews-to-nocodb.cjs`) extracts **aggregate metadata only**: review counts, average ratings, page titles, descriptions. It does NOT extract individual review text, reviewer names, account histories, or dates. The `reviewer_account_signal` field is rudimentary ("Facebook reviews may include employee posts").

**Current detection surface is too thin to do meaningful spam analysis.**

### Is It a Viable Product? Yes — but positioned as B2B, not consumer.

**Why NOT consumer-facing:**
- Families don't know or care about "spam reviews" as a category — they care about overall trust.
- A consumer "spam database" would be gamed by facilities, create legal liability, and contradict Assistedly's neutrality.
- SEO value is low; brand risk is high.

**Why YES as a B2B "Reputation Forensics Report":**
- Facilities ARE worried about fake reviews — both negative (competitor sabotage) and suspiciously positive (owner/employee/family astroturfing).
- Senior living is a high-LTV, reputation-sensitive industry. A single suspicious negative review can materially impact occupancy.
- Marketing directors need **data to present to ownership** when disputing reviews or responding to board questions about reputation.
- Positioning as "forensics" implies investigation, not accusation — legally safer and brand-appropriate.

### What a Reputation Forensics Report Contains

```
═══════════════════════════════════════════════════════════
  Assistedly Reputation Forensics Report
  Armbrook Village | Westfield, MA | Report #ARF-20260823
═══════════════════════════════════════════════════════════

1. REVIEW INVENTORY
   • Total reviews detected: 64 (APFM: 38, Google: 26)
   • Review text successfully extracted: 19 (30%)
   • Sentiment distribution: 78% positive, 12% mixed, 10% negative

2. AUTHENTICITY SIGNALS
   ┌─────────────────────────┬─────────┬─────────────────────────┐
   │ Signal                  │ Count   │ Risk Level              │
   ├─────────────────────────┼─────────┼─────────────────────────┤
   │ Single-review accounts  │ 3       │ MEDIUM — possible drive │
   │                         │         │ by / astroturf          │
   ├─────────────────────────┼─────────┼─────────────────────────┤
   │ Review burst clustering │ 1       │ LOW — 5 reviews in 3    │
   │ (same 7-day window)     │         │ days, then 6-month gap  │
   ├─────────────────────────┼─────────┼─────────────────────────┤
   │ Cross-platform dupe     │ 0       │ —                       │
   │ (same text, diff sites) │         │                         │
   ├─────────────────────────┼─────────┼─────────────────────────┤
   │ Employee/associate      │ 2       │ HIGH — LinkedIn match   │
   │ reviewer detected       │         │ on reviewer name        │
   ├─────────────────────────┼─────────┼─────────────────────────┤
   │ Generic / templated     │ 4       │ MEDIUM — repeated       │
   │ language pattern        │         │ phrases across accounts  │
   └─────────────────────────┴─────────┴─────────────────────────┘

3. COMPETITIVE CONTEXT
   • Your community review growth rate: +12% / quarter
   • Comp-set median: +8% / quarter
   • Anomaly explanation: Possible review solicitation campaign

4. RECOMMENDATIONS
   • Add "verified resident" badge to your own site (builds trust)
   • Respond to the 2 flagged reviews with standardized empathetic language
   • Consider third-party review verification service (e.g., GreatAuPair, VerifiedCaring)
```

### Technical Requirements to Build This

**Phase 1: Deep Review Scraper**
- Individual review text extraction (not just aggregate counts)
- Reviewer name + date + platform per review
- Requires upgrading the Firecrawl pipeline to extract review cards, not just meta tags
- OR: use platform APIs where available (Google Places API for reviews, Caring.com has none public)

**Phase 2: Signal Detection Engine**
```javascript
// Pseudocode for detection patterns
const signals = {
  singleReviewAccounts: reviews.filter(r => r.reviewerTotalReviews === 1).length,
  burstClustering: detectTemporalClustering(reviews, windowDays = 7, threshold = 3),
  crossPlatformDuplication: detectSimilarText(reviews, similarityThreshold = 0.85),
  employeeReviewer: crossReferenceWithLinkedInOrStaffPage(reviewerNames, facilityWebsite),
  templateLanguage: detectRepeatedPhrases(reviews, minFrequency = 3),
  ratingDistributionSkew: chiSquareTest(ratingDistribution) // detect unnatural 5-star clustering
};
```

**Phase 3: Report Generator**
- PDF export with Assistedly branding
- Scheduled monthly/quarterly delivery
- White-label option for marketing agencies (Section 4)

### Viability Assessment

| Factor | Score | Notes |
|---|---|---|
| Technical feasibility | 6/10 | Doable but requires significant scraper upgrades; platforms actively resist |
| Market demand (facilities) | 8/10 | High anxiety around reputation; no existing dedicated product in senior living |
| Competitive differentiation | 9/10 | No one else combines cross-platform + FOIA context + forensic analysis |
| Legal / brand risk | 4/10 | Must avoid defamation; "forensics" framing + probabilistic language helps |
| Revenue potential | 7/10 | Fits into $99–$299/mo tier; could be standalone $49/mo add-on |
| **Overall** | **7/10** | **Recommend building as Tier 2 Module A, not standalone MVP** |

> **Strategic recommendation:** Don't launch this as a separate product. Bundle it into the paid "Intelligence Suite" as the "Reputation Forensics" module. The value is enhanced by combining it with competitive benchmarking and FOIA context — standalone spam detection isn't compelling enough.

---

## 3. Aline Competitive Positioning

### What Aline Actually Does

Aline is the dominant **vertical SaaS CRM + marketing automation platform** for senior living operators. Their stack includes:
- Lead management (inquiry → tour → move-in pipeline)
- Marketing automation (email campaigns, nurture sequences)
- Website creation + SEO for individual communities
- "AI-Powered Listing Optimizer" — optimizes how a community appears on APFM, Caring.com, Google, etc.
- Reputation management (review requests, response templates)
- Deep API integrations with APFM, Caring.com, and other referral sources

**Aline's core revenue model:** SaaS subscription + likely revenue-share on leads/directories.

### What Assistedly Does NOT Have (and should NOT build)

- Lead management CRM — Aline owns this. Integrate, don't compete.
- Direct API access to APFM / Caring.com — gated, expensive, and Aline already has preferential relationships.
- Website builder — horizontal problem, not Assistedly's expertise.
- Automated review solicitation — many tools do this; Assistedly's value is analysis, not generation.

### What Assistedly DOES Have (and Aline cannot easily replicate)

| Asset | Aline's Access | Assistedly's Access |
|---|---|---|
| FOIA state licensing data | ⚠️ Would need to build pipelines per state | ✅ Already operational (MA) |
| Cross-directory review aggregation (public scrapes) | ✅ Via APIs (limited, official) | ✅ Via Firecrawl (broader, includes platforms they miss) |
| Consumer search intelligence (own-site behavior) | ✅ Their own CRM data | ✅ Assistedly's organic traffic + intake wizard |
| Independent, non-commission positioning | ⚠️ Revenue-linked to directories | ✅ Core brand promise |
| Regulatory compliance alerts | ❌ Not a known feature | ✅ Built from FOIA data |

### The "API-less" Integration Strategy

Assistedly does not need direct API access to gated portals. Instead, use **three parallel approaches**:

#### Approach 1: Public Web Scraping (Firecrawl)
- **What**: Scrape public listing pages for pricing, amenities, photos, review counts
- **Status**: Operational for review metadata. Expand to listing content, photo counts, amenity lists.
- **Limitations**: Fragile (sites change); blocked by some (Yelp). Mitigate by rotating proxies, respecting robots.txt, and using cached snapshots.
- **Cost**: Firecrawl API credits (~$50–$200/mo at scale) vs. $10K+/mo for directory API partnerships.

#### Approach 2: User-Permissioned / Chrome Extension
- **What**: A browser extension that facility marketing staff install. When logged into APFM/Caring portals, it extracts their OWN listing data (which they have rights to) and syncs it to Assistedly.
- **Status**: Not built. Medium complexity.
- **Advantage**: No terms-of-service violation — users are extracting their own data. Gives Assistedly fresh, accurate data without scraping.
- **Use cases**: 
  - Cross-directory listing consistency audit
  - Bulk review response workflow
  - Price change detection across directories

#### Approach 3: Client Data Uploads
- **What**: Facilities upload their own spreadsheets (pricing, availability, photos). Assistedly enriches with FOIA + competitive data.
- **Status**: Not built. Low complexity.
- **Advantage**: Zero dependency on external APIs. Builds direct customer relationship.

### Specific Capability Execution (without API access)

| Desired Capability | API-less Execution Path |
|---|---|
| **Cross-directory listing health checks** | Firecrawl scrape public pages → compare fields (price, photos, amenities) → flag inconsistencies. Chrome Extension for real-time self-audit. |
| **FOIA compliance alerts** | Pure FOIA data pipeline → no directory dependency. Assistedly's unique moat. |
| **Competitive pricing intelligence** | Firecrawl public listing pages for comp-set → extract pricing. MA EOEA data for actual fee ranges. Combine to show "listed vs. actual" spread. |
| **Consumer search intelligence** | Assistedly's own organic search logs + intake wizard question flows → anonymized, aggregated. No external API needed. |
| **Unified review management** | Firecrawl for public reviews + Chrome Extension for staff to respond via Assistedly dashboard (which opens correct platform on their behalf) → "unified inbox" UX, even if backend is just smart links. |

### Positioning vs. Aline

```
┌─────────────────────────────────────────────────────────────────┐
│  FACILITY MARKETING STACK                                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Aline      │  │  Directories │  │   Assistedly.ai      │  │
│  │   CRM +      │  │  (APFM,      │  │   Intelligence       │  │
│  │   Marketing  │  │   Caring,    │  │   Layer              │  │
│  │   Automation │  │   Google)    │  │                      │  │
│  │              │  │              │  │  • FOIA compliance   │  │
│  │  "Manage     │  │  "Get leads  │  │  • Competitive intel │  │
│  │   leads"     │  │   from us"   │  │  • Cross-platform    │  │
│  │              │  │              │  │    reputation view   │  │
│  │              │  │              │  │  • Consumer intent   │  │
│  │              │  │              │  │    signals           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  Assistedly feeds INTO Aline: alerts → CRM tasks, reports       │
│  Assistedly sits ABOVE directories: aggregated reputation view    │
└─────────────────────────────────────────────────────────────────┘
```

**Key message to facilities:** "Aline manages your funnel. Directories feed your funnel. Assistedly tells you what your funnel should look like, what your competitors' funnels look like, and when the government is about to knock on your door."

---

## 4. External Company Classification

### Current Landscape Assessment

| Company | What They Actually Do | Assistedly Classification | Confidence |
|---|---|---|---|
| **Aline** | Vertical SaaS CRM + marketing automation + listing optimization for senior living operators | **Strategic competitor + integration partner** | High |
| **SmartGirl Digital** | Senior living marketing agency (PPC, SEO, social media, website design for communities) | **Channel partner (agency reseller)** | High |
| **Creating Results** | Senior living marketing + sales training consultancy (brand strategy, lead gen, mystery shopping) | **Channel partner + potential co-marketing** | High |
| **SageAge** | Senior living marketing agency with focus on "storytelling," brand strategy, and digital marketing | **Channel partner (agency reseller)** | High |
| **Ranktracker** | Generic horizontal SEO rank tracking tool (not senior-living specific) | **Neutral / orthogonal** | High |

### Detailed Analysis

#### Aline — Strategic Competitor + Integration Partner

**Why competitor:**
- Aline's "AI-Powered Listing Optimizer" conceptually overlaps with Assistedly's listing health + reputation intelligence.
- Both target the same buyer: senior living marketing directors / EDs.
- Aline has vastly more resources, brand recognition, and existing customer relationships.

**Why partner:**
- Aline does NOT have FOIA data infrastructure. It's not their business model.
- Aline's customers need compliance alerts, competitive intelligence, and cross-platform review forensics — none of which Aline currently offers.
- Assistedly can position as a **data intelligence integration** that pushes insights INTO Aline's CRM as tasks and alerts.

**Specific partnership approach:**
1. Build a lightweight Aline integration (CSV export, webhook, or if they have an API, direct push)
2. Co-market: "Aline customers get 50% off Assistedly Intelligence Suite first year"
3. Joint webinar: "Beyond Listings: Using Public Data to Drive Occupancy" — Aline brings audience, Assistedly brings data.
4. If Aline acquires or builds FOIA pipelines, reassess. Until then, they are a channel.

#### SmartGirl Digital, Creating Results, SageAge — Channel Partners (Agency Resellers)

These are all **marketing agencies serving senior living operators**. Their business model:
- Retainer-based ($3K–$15K/mo per community)
- Services: PPC, SEO, website design, social media, brand strategy, reputation management
- Customers: same as Assistedly's target (EDs, marketing directors)

**Why channel partners, not competitors:**
- Agencies don't own data infrastructure. They buy tools and resell insights to clients.
- Agencies NEED differentiation. "We use Assistedly's FOIA intelligence" is a differentiator.
- Agencies are high-churn, high-refresh — Assistedly gives them objective metrics to show ROI.

**Partnership playbook:**
1. **Agency Partner Program** — free dashboard access for up to 5 communities, white-label reports
2. **Co-branded assessments** — "Powered by Assistedly.ai" on every report they generate
3. **Revenue share** — 20% of first-year subscription for referred community sign-ups
4. **Sales enablement** — give agencies the "Armbrook Village is underpricing vs. comp-set by $400/mo" insight so their pitch decks hit harder

#### Ranktracker — Neutral / Orthogonal

Ranktracker is a generic SEO tool that tracks keyword rankings. It has:
- No senior living specialization
- No facility data
- No FOIA integration
- No consumer intent layer

**Action:** Ignore unless building a dedicated SEO product for senior living operators, in which case it becomes a potential acquisition target or API integration for rank data. Not strategically relevant today.

### Displacement vs. Partnership Decision Matrix

| Company | Displace? | Partner? | Why |
|---|---|---|---|
| Aline | ❌ No | ✅ Integration partner | Too big, complementary data. Feed into them. |
| SmartGirl Digital | ❌ No | ✅ Channel partner | Agency needs tools, not replacement. |
| Creating Results | ❌ No | ✅ Channel partner | Same — consultancy needs data to sell advice. |
| SageAge | ❌ No | ✅ Channel partner | Same. |
| Ranktracker | ❌ No | ⚪ Ignore | No overlap; horizontal SEO not our lane. |

> **No company on this list should be treated as a direct competitor to displace.** Assistedly's B2B play is intelligence, not operations. Operations (CRM, marketing execution, website building) is saturated. Intelligence is greenfield in senior living.

---

## 5. Yelp Pipeline Expansion

### Current Blocker

Yelp actively blocks Firecrawl (and most scrapers) with:
- Bot detection / CAPTCHA challenges
- IP rate limiting
- JavaScript rendering walls
- Terms of Service explicitly prohibiting scraping

The pipeline currently skips Yelp (`topUrl.includes("m.yelp.com/search")`) or gets no results.

### Options Analysis

| Option | Feasibility | Cost | Data Quality | Speed | Recommendation |
|---|---|---|---|---|---|
| **Firecrawl Enterprise site support** | Medium | Unknown | Good if supported | Fast | **Explore** — contact Firecrawl team for Yelp-specific handling |
| **Yelp Fusion API** | High | $$$ + verification burden | Official, high quality | Fast | **Conditional** — only viable if facilities verify their own profiles at scale |
| **Aggregator mirrors / third parties** | Low | Low | Unreliable, stale, potentially illegal | Medium | **Avoid** — legal + data quality risk |
| **Chrome Extension (user-permissioned)** | High | Low | Moderate (depends on user engagement) | Slow (manual/semiautomatic) | **Build** — complementary to all other approaches |
| **Skip Yelp entirely** | N/A | None | N/A | N/A | **Acceptable** — Google reviews + APFM + Caring + SeniorAdvisor covers 85%+ of senior living review volume |

### Recommended Path: Hybrid Approach

**Step 1: Validate Yelp's importance**
Run a query on the 273 MA facilities: what % have ≥5 Yelp reviews? My hypothesis: <20%. Senior living families rarely use Yelp vs. APFM/Caring/Google. If validated, **lower Yelp priority**.

**Step 2: Build Chrome Extension for user-permissioned scraping**
This serves dual purposes:
- Yelp extraction when staff are logged into their own business accounts
- Cross-directory listing audit tool (Section 1 And 3)
- Review response workflow (unified inbox)

**Chrome Extension architecture:**
```
User installs "Assistedly for Communities"
→ Detects when on yelp.com/biz/[facility] (staff logged in)
→ Extracts review count, rating, recent review text
→ Syncs to Assistedly via encrypted background message
→ Assistedly server stores in NocoDB facility_reviews table
→ Extension badge shows: "24 new reviews this week"
```

**Step 3: Explore Yelp Fusion API for high-value facilities**
If a facility signs up for the paid Intelligence Suite AND has ≥20 Yelp reviews, Assistedly helps them apply for Yelp Fusion access (using their business verification). Assistedly consumes their API key (with permission) to pull data. This is **facility-driven, not Assistedly-driven** — solving the business verification problem.

**Step 4: Deprioritize aggregate Yelp metrics in consumer-facing products**
If Yelp data is sparse, showing "Yelp: N/A" on Assistedly consumer pages is worse than showing nothing. Only surface Yelp when data exists and is fresh.

### Priority Stack

```
1. DONE — Google reviews (via public scrape + Places API for details)
2. DONE — APFM (public scrape functional)
3. DONE — Caring.com (public scrape functional)
4. DONE — SeniorAdvisor (public scrape functional)
5. BUILD — Chrome Extension (user-permissioned, multi-platform including Yelp)
6. EXPLORE — Yelp Fusion API (facility-driven verification model)
7. SKIP — Aggregator mirrors (legal risk)
```

---

## 6. Product Roadmap Integration

### Immediate (Next 30 Days)

| Initiative | Owner | Effort | Value |
|---|---|---|---|
| Complete review pipeline to 50 facilities | Engineering | Medium | Data foundation for B2B reports |
| Build review text extraction (individual reviews, not just counts) | Engineering | High | Required for spam detection |
| Validate Yelp relevance (audit MA facilities for Yelp presence) | Data/Strategy | Low | Decides Yelp investment |

### Short-term (30–90 Days)

| Initiative | Owner | Effort | Value |
|---|---|---|---|
| **"Claim Your Community" flow** — facility staff verify ownership via email/phone | Engineering | High | Unlocks paid tier gating |
| **Facility Intelligence Dashboard v1** — cross-directory listing health + FOIA public profile view | Engineering | High | First B2B product |
| **Competitive pricing module** — comp-set builder with FOIA + scraped pricing | Engineering | Medium | High differentiation |
| **Chrome Extension scaffolding** — browser extension registry, basic extract | Engineering | High | Enables Yelp + self-service data |
| **Agency partner outreach** — SmartGirl, Creating Results, SageAge intros | Business Dev | Medium | Channel pipeline |

### Medium-term (90–180 Days)

| Initiative | Owner | Effort | Value |
|---|---|---|---|
| **Reputation Forensics Report** — individual review text analysis + spam signals | Engineering + ML | High | Premium module launch |
| **FOIA Compliance Alerts** — license expiration, inspection updates | Engineering | Medium | Unique moat feature |
| **Aline integration** — webhook/CSV push of alerts into Aline CRM | Engineering | Medium | Partnership lock-in |
| **Consumer search intelligence module** — anonymized town-level demand data | Engineering + Data | Medium | Premium upsell |

### Long-term (180–365 Days)

| Initiative | Owner | Effort | Value |
|---|---|---|---|
| **Multi-state FOIA expansion** — replicate MA pipeline in FL, CA, TX | Engineering + Data | Very High | Scales moat nationally |
| **White-label agency tier** — fully white-labeled reports for marketing agencies | Engineering | Medium | Channel revenue |
| **Predictive occupancy modeling** — combine FOIA data, review velocity, pricing changes | Data Science | High | True intelligence differentiation |
| **Yelp Fusion facility-driven program** — facilities apply, Assistedly consumes | Partnerships | Medium | Closes Yelp gap |

### Revenue Model

```
CONSUMER (FREE)
├── Search + compare facilities
├── Intake wizard + basic matching
├── Cost calculator
└── Public facility profiles (FOIA data)

FACILITY INTELLIGENCE SUITE (FREEMIUM → PAID)
├── Free tier: Claim profile, listing health score, public FOIA view
├── $99/mo per community: Review aggregation, comp-set builder, basic alerts
├── $299/mo per community: Reputation forensics, consumer search intel, priority support
└── $1,500+/mo per portfolio: White label, API access, custom reporting

AGENCY PARTNER PROGRAM
├── Free dashboard access (up to 5 communities)
├── 20% rev share on referred upgrades
└── Co-branded assessment tools
```

### Competitive Moat Summary

```
┌────────────────────────────────────────────────────────────────┐
│  WHY NO ONE CAN EASILY COPY ASSISTEDLY'S B2B PLAY              │
├────────────────────────────────────────────────────────────────┤
│  1. FOIA pipeline infrastructure (months to replicate per      │
│     state, requires legal review + state relationships)        │
│  2. Cross-platform review aggregation at scale (Firecrawl      │
│     + proxy rotation + data normalization)                      │
│  3. Consumer intent signal data (own-site behavior collected  │
│     over time; network effects as traffic scales)             │
│  4. Independent brand positioning (no commission conflict;      │
│     directories cannot offer this credibly)                     │
│  5. Chrome Extension installed base (user-permissioned data    │
│     creates switching costs once embedded in workflows)       │
└────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Data Assets Inventory

| Asset | Location | Coverage | Update Frequency |
|---|---|---|---|
| `chart-facilities.json` | `public/data/` | 273 MA facilities | Weekly (Goose scheduler) |
| `review-snapshots/*.json` | `public/data/review-snapshots/` | 10 facilities × 25 snapshots | On-demand / scheduled |
| NocoDB facility_reviews | `m6iaq5juhovxdou` | Linked to FOIA master | Real-time on pipeline run |
| FOIA master table | `mix4o0ymn0l2nhz` | 273 MA facilities | Annual (EOEA report) + manual |
| Consumer search logs | PostHog + GA4 | ~ongoing | Real-time |
| Intake wizard outcomes | PostHog events | ~ongoing | Real-time |

---

*Document version: 2026-08-23-v1*  
*Next review: After pilot partner interviews + 50-facility review milestone*
