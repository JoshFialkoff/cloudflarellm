# Continue: AgeTech Partner Pipeline CSV Project

## Goal
Create a clean, deduplicated CSV of ~100 small-scale AgeTech companies (Seed / Series A preferred) that manufacture or sell **wearables, in-home sensors, or monitoring tools** for seniors aging at home. Also include **menopause companies** (women in their 50s are the main consumers of assisted-living research for parents/in-laws). The CSV is for an AI agent-to-agent referral engine so these companies can offer their consumer customers an opt-in to receive information about assisted living from **assistedly.ai**.

## Why This Pipeline
- Partner companies already have engaged senior-care consumers.
- Their users are proactively trying to stay at home with wearables/sensors.
- A referral integration puts assistedly.ai in front of families at the exact moment they realize home-alone is no longer enough.

## Existing Research Assets (use these first)

| File | Path | Notes |
|------|------|-------|
| Filtered CSV | `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_filtered.csv` | 103 rows, primary source. |
| Filtered JSON | `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_filtered.json` | 70-row structured version. |
| Agent wearables JSON | `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agent_agetech_wearables.json` | 26 higher-quality wearable/sensor companies. |
| Deduped CSV | `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_deduped.csv` | 132 rows. |
| Raw CSV | `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies.csv` | 178 rows. |
| Search results | `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/search_results/` | 24 JSON files including menopause searches. |
| Scraped pages | `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/scraped/` | ~143 JSON files of homepage/about-page content already scraped. |
| Assistedly schema | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/agetech_schema.json` | Schema for partner profiles (if useful). |
| Agent schema | `/Users/joshfialkoff/Documents/Coding Workspaces/agent_schema_100.json` | Outreach schema reference. |

## Output File
**Starter file already generated:**
`/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_partners_outreach_100.csv` (92 rows as of the last run)

**Save final result as:**
`/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_partners_outreach_100.csv` (overwrite after review) or `agetech_partners_outreach_100_v2.csv` if you want to preserve the starter.

## Required CSV Columns

```csv
company_name,website,product_category,stage,funding_info,funding_usd,founders_leadership,head_of_business_dev_or_partnerships,description,outreach_angle,assistedly_fit_score,data_source,notes
```

### Column Definitions
- `company_name` — Clean company name (not article titles like "AI Fall Detection Sensor...").
- `website` — Root domain (`https://company.com`) if possible; deduplicate by normalized domain.
- `product_category` — One or more of: `wearables`, `in-home-sensors`, `monitoring`, `fall-detection`, `menopause`, `mixed`.
- `stage` — `Pre-Seed`, `Seed`, `Series A`, `Series B+`, `Unknown`, `Bootstrapped`, etc. Prioritize Seed/Series A.
- `funding_info` — Human-readable funding string.
- `funding_usd` — Numeric estimate when available (e.g., `1500000`).
- `founders_leadership` — CEO / founder names.
- `head_of_business_dev_or_partnerships` — VP Business Development, Head of Partnerships, etc.; use LinkedIn searches if not on website.
- `description` — One-line value proposition focused on seniors / menopause / aging in place.
- `outreach_angle` — One-sentence hook for assistedly.ai referral partnership.
- `assistedly_fit_score` — `High` / `Medium` / `Low`. High = direct senior consumer base + Seed/Series A + easy integration story.
- `data_source` — Which file or URL the row came from.
- `notes` — Anything else (e.g., no public API, has API, has mobile app, has distribution partner channel).

## Current State of the Starter CSV

The starter CSV at `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_partners_outreach_100.csv` currently has:
- **92 rows**
- Categories: wearables 40, monitoring 24, fall-detection 8, in-home-sensors 14, menopause 8, mixed 1
- Stages: Seed 16, Series A 9, Angel 3, Series B+ 1, Unknown 63

### Immediate next tasks
1. **Add 8+ more companies** to reach ≥100 total.
2. **Resolve the 63 "Unknown" stages** by checking Crunchbase / news / company websites.
3. **Enrich `head_of_business_dev_or_partnerships`** for every Tier-1 company (Seed/Series A + High fit).
4. **Clean rows** that are not actual companies (review articles, market reports,_duplicate sites).
5. **Improve `outreach_angle`** for menopause and mixed-category rows.
6. **Normalize `website`** to root domains where possible.

## Workflow to Follow

1. **Load existing sources** listed above into a dataframe/list.
2. **Normalize domains** and `LOWER(TRIM())` company names. Deduplicate.
3. **Remove non-company entries** such as:
   - Review/comparison articles (e.g., `Fall Detection Devices (2026)`, `falldetection.com` if it is purely a content site).
   - Government pages (`fcc.gov`, `sbir.gov awards`).
   - Market-research reports (`strategicmarketresearch.com`, `mdpi.com` papers).
   - Blog/news articles that are not the company itself (unless they contain the company funding fact).
4. **Prioritize and rank**:
   - Tier 1: Seed / Series A companies with a wearable, sensor, or monitoring device sold direct-to-consumer or through senior care providers.
   - Tier 2: Menopause / femtech companies with engaged 45-55 audience (primary assisted-living decision makers).
   - Tier 3: Later-stage or traction-unknown companies if their product is a perfect fit.
5. **Enrich each row**:
   - Visit homepages where missing data.
   - Search Crunchbase or LinkedIn for funding and leadership.
   - Look for `/about`, `/team`, `/partnerships`, `/api`, `/developers`, `/integrations` pages.
6. **Get to ~100 rows**.
   - If you are below 100 after cleaning, run new web/searches for additional Seed/Series A AgeTech companies in the categories above.
   - Good sources: Crunchbase (`crunchbase.com`), Y Combinator (`ycombinator.com/companies`), VC portfolio pages (e.g., Portfolia, Techstars, SJF Ventures), AlleyWatch, FemTech Insider, Future4Care accelerator.
7. **Write the output CSV** with quoted fields and UTF-8 encoding.
8. **Validate**:
   - ≥100 rows (excluding header).
   - No duplicate websites.
   - All `stage` values normalized.
   - `product_category` filled for every row.

## CRM Dashboard (additional companies)

The user has a Twenty CRM instance at:
- Dashboard: `http://107.172.94.35:3002/object/dashboard/daf6cd96-50ec-4314-9555-2b0e2579b6d2`
- Companies view: `http://107.172.94.35:3002/objects/companies?viewId=4ebda350-e0e2-49d4-a25c-542dcda3aac6`

If you can authenticate (the app is React-based and requires a bearer token; check local browser cookies, saved passwords, or the `.env` files in `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/`), query the GraphQL endpoint at `http://107.172.94.94.35:3002/graphql` for company objects and merge any AgeTech-relevant records into the CSV.

The REST endpoint requires auth: `curl -s http://107.172.94.35:3002/rest/companies` returns `FORBIDDEN_EXCEPTION` without a token.

If you cannot authenticate, document that in the notes and proceed using the local files.

## Example Outreach Angles to Use

- Wearable/in-home sensor: "Your users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue."
- Menopause: "Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai."
- API/platform company: "Integrate an assistedly.ai agent endpoint so your customers can escalate from sensor alerts to assisted-living placement with one click."

## Verification Commands

After writing the CSV, run:

```bash
wc -l /Users/joshfialkoff/Documents/Coding\ Workspaces/agetch-research/agetech_partners_outreach_100.csv
head -5 /Users/joshfialkoff/Documents/Coding\ Workspaces/agetch-research/agetech_partners_outreach_100.csv
python3 -c "import csv; r=[*csv.DictReader(open('/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_partners_outreach_100.csv'))]; print('Rows:', len(r)); print('Unique domains:', len({x['website'] for x in r})); print('Stages:', {x['stage'] for x in r}); print('Categories:', {x['product_category'] for x in r})"
```

## Success Criteria
- [ ] CSV has ≥100 rows.
- [ ] No duplicate websites.
- [ ] Every row has `company_name`, `website`, `product_category`, `stage`, `description`, and `outreach_angle`.
- [ ] At least 30 are Seed/Series A.
- [ ] At least 10 are menopause/femtech companies.
- [ ] At least 50 are wearables / in-home sensors / fall detection / monitoring.
- [ ] Output file saved to the exact path above.
