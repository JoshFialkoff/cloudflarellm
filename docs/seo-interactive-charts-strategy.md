# SEO Strategy: Interactive Facility Charts + Landing Pages for Women 50s

## Research Summary

From Firecrawl forum analysis, Reddit discussions (r/AgingParents, r/eldercare), and US News / Washington Post checklists, the top concerns of women in their 50s searching for assisted living for relatives are:

1. **Safety & Oversight** — "How do I know they're safe?" (video surveillance, staffing, emergency preparedness)
2. **Cost & Affordability** — "How do I budget? Will Medicare/Medicaid help?" (pricing ranges, insurance acceptance)
3. **Care Quality** — "Will they get the help they need?" (medication administration, ADL support, dementia care)
4. **Trust & Transparency** — "How do I know rankings aren't pay-to-play?" (official state data vs broker sites)
5. **Availability** — "How soon can they move in?" (occupancy rates)
6. **Stability** — "Will they kick my parent out?" (move-out reasons — financial, behavioral)

Competitors (A Place for Mom, Caring.com, Seniorly) do NOT display:
- Official pricing ranges from state filings
- Safety infrastructure scores (video surveillance, backup generators, EMR usage)
- Medication administration levels (SAMM vs LMA)
- Insurance participation (SCO, PACE, GAFC, Section 8, MRVP)
- Occupancy rates by facility
- Move-out stability metrics
- For-profit vs non-profit status
- Staff-to-resident ratios

## Interactive Chart Components Built

| Component | Purpose | Unique Data Source |
|-----------|---------|-------------------|
| `PriceCareScatter` | Price vs Care Depth scatter plot | Official EOIA monthly fee ranges + medication/skilled care data |
| `SafetyScoreChart` | Safety score distribution histogram | Video surveillance, backup generators, EMR, transportation |
| `InsuranceBreakdown` | Horizontal bar chart of insurance acceptance | SCO, PACE, GAFC, Section 8, MRVP participation |
| `OccupancyBarChart` | Top 20 facilities by occupancy rate | 12-month average from state occupancy filings |
| `InteractiveTable` | Sortable/filterable explorer table | All derived metrics: safety, care depth, stability, ADL support |
| `FacilityFilterBar` | Max fee, city, tax status, memory care, insurance filters | Real-time client-side filtering |

## Recommended Landing Page Templates

### Template 1: "Affordable Assisted Living in [City] That Accepts [Insurance]"
**Target keywords:**
- "assisted living near me that accepts MassHealth"
- "assisted living SCO Massachusetts"
- "cheap assisted living [City] Medicaid"
- "assisted living that accepts insurance Massachusetts"

**SEO Title:** Affordable Assisted Living in {City} | SCO, PACE, GAFC Accepted | Official MA Data
**Meta Description:** Find affordable assisted living in {City}, Massachusetts with transparent pricing from official state filings. Filter by SCO, PACE, GAFC, Section 8, and MRVP acceptance.

**Unique data displayed:**
- `InsuranceBreakdown` chart filtered to city
- `InteractiveTable` sorted by avgFee ascending
- Highlighted KPI: "{N} facilities under ${maxFee}/mo accepting {insurance}"

### Template 2: "Safest Assisted Living in [City] — Official Safety Scores"
**Target keywords:**
- "safest assisted living near me"
- "assisted living with security cameras Massachusetts"
- "assisted living backup generator {City}"
- "best rated assisted living {City} safety"

**SEO Title:** Safest Assisted Living in {City}, MA | Official Safety Scores & Inspection Data
**Meta Description:** Compare safety scores for every licensed assisted living facility in {City}. Based on video surveillance coverage, backup generators, EMR systems, and staffing ratios from official MA filings.

**Unique data displayed:**
- `SafetyScoreChart` filtered to city
- `InteractiveTable` sorted by safetyScore descending
- Facility cards showing: video surveillance yes/no, backup generator yes/no, EMR yes/no

### Template 3: "Best Memory Care in [City] — SCR Unit Data & Dementia Support"
**Target keywords:**
- "memory care {City} Massachusetts"
- "dementia care facilities near me"
- "assisted living with memory care {City}"
- "best memory care Massachusetts state data"

**SEO Title:** Best Memory Care in {City}, MA | SCR Units, Dementia Care & Pricing | Official Data
**Meta Description:** Find memory care facilities in {City} with certified SCR units, dementia support levels, and medication administration data from official Massachusetts state filings.

**Unique data displayed:**
- Filter: `memoryCare: "yes"`
- `PriceCareScatter` with memory care facilities highlighted
- Show SCR unit counts, SAMM/LMA medication levels
- Dementia prevalence data

### Template 4: "Assisted Living with Highest Staffing Ratios in [City]"
**Target keywords:**
- "assisted living best staff to resident ratio {City}"
- "assisted living with nurses on staff Massachusetts"
- "highest staffing assisted living near me"

**SEO Title:** Assisted Living with Best Staffing in {City}, MA | Contracted RN/LPN/PCA Hours
**Meta Description:** Compare contracted staffing hours per resident at every licensed facility in {City}. Data from official Massachusetts ALR annual reports.

### Template 5: "Non-Profit vs For-Profit Assisted Living in [City]: What's the Difference?"
**Target keywords:**
- "non profit vs for profit assisted living"
- "does it matter if assisted living is for profit"
- "best non profit assisted living {City} Massachusetts"

**SEO Title:** Non-Profit vs For-Profit Assisted Living in {City}, MA | Official Data Comparison
**Meta Description:** Compare pricing, safety scores, and care depth between non-profit and for-profit assisted living facilities in {City} using official Massachusetts state data.

**Unique data displayed:**
- Side-by-side KPIs: non-profit avg fee vs for-profit avg fee
- Scatter plot colored by tax status
- `InteractiveTable` with tax status badge filter

## Data Pipeline

```
public/data/alr-annual-report-2024.csv (315 cols, 273 rows)
  ↓
node scripts/transform-foia-to-charts.cjs
  ↓
public/data/chart-facilities.json (cleaned + derived metrics)
  ↓
FacilityDiscoveryDashboard (React, client-side filters & recharts)
  ↓
Interactive landing pages /discover, /safety, /affordable, /memory-care
```

## Implementation Roadmap

**Phase 1: Deploy `/discover` page (today)**
- Already built: `app/discover/page.js` + 6 chart components
- Add navigation link from homepage
- Post to Discord for feedback

**Phase 2: Build parameterized town pages (next)**
- `app/massachusetts/[town]/discover/page.js` — copy of discover with city filter pre-applied
- Auto-generate from `MASSACHUSETTS_TOWN_ENGINE_PAGES` list
- Each gets unique title/meta with town name

**Phase 3: Build theme-specific pages (next)**
- `/safety-scores` — pre-filtered to sort by safety
- `/memory-care` — pre-filtered to memory care only
- `/under-[price]` — pre-filtered by max fee
- `/non-profit` — pre-filtered to non-profits

**Phase 4: Add FAQ schema + structured data**
- Each chart section can have an associated FAQ block
- Boosts featured snippet capture for "how much does assisted living cost in {town}" etc.

## Competitive Moat

No competitor (A Place for Mom, Caring.com, Seniorly) provides:
1. Interactive price vs care depth scatter plots
2. Safety score histograms from video surveillance/EMR data
3. Real-time filtering by insurance program
4. Occupancy rate bars from 12-month state filings
5. For-profit/non-profit badges with state verification
6. ADL support % per facility
7. Stability scores (financial/behavioral move-out rates)

These pages will rank because:
- **First-mover advantage**: No one else has this data in interactive form
- **Search intent match**: The long-tail queries ("assisted living that accepts SCO in Worcester") have low competition
- **Trust signals**: Official state source citations build E-E-A-T
- **Engagement metric boost**: Interactive charts increase time-on-page and reduce bounce rate
- **Featured snippet potential**: Tables and charts are highly snippet-able

## PostHog / GA4 Tracking Recommendations

Add events to capture:
- `chart_filter_applied` — which filters users apply (city, maxFee, insurance, memoryCare)
- `chart_scatter_hover` — which facilities users hover (price vs care)
- `table_sort_clicked` — which columns users sort by
- `table_row_clicked` — which facility names lead to facility profile pages
- `cta_start_match_from_discover` — conversion from chart page to search/wizard

Use these to iterate on which charts and filters drive the most engagement and conversions.
