# AgeTech / Menopause Referral Partner Pipeline — Progress Notes

## Date
2026-08-12

## Goal
Build a structured list of ~100 small-scale AgeTech companies (prioritizing Seed/Series A) that manufacture or sell wearables, in-home sensors, fall-detection, or monitoring tools for seniors aging at home. Also include relevant menopause startups because women in their 50s are primary decision-makers for assisted-living decisions for parents/in-laws.

## Source Assets Used
- `/Users/joshdev/Assistedly.ai/agetch-research/agetech_partners_outreach_100.csv` — 92-row starter CSV from previous bot
- `/Users/joshdev/Assistedly.ai/agetch-research/agetech_companies_filtered.json` — 70-row filtered deduped JSON
- `/Users/joshdev/Assistedly.ai/agetch-research/agent_agetech_wearables.json` — 26 higher-quality wearable/sensor companies
- `/Users/joshdev/Assistedly.ai/agetch-research/search_results/all_searches.json` — 23 Firecrawl search results
- Firecrawl CLI searches for funding verification and missing URLs
- Infisical secret retrieval for `FIRECRAWL_API_KEY`
- Manual research leveraging known AgeTech/menopause company databases

## Methodology
1. **Loaded starter CSV** (92 rows).
2. **Removed non-company entries**:
   - Articles, listicles, market reports (e.g., `strategicmarketresearch.com`, `mdpi.com`, `falldetection.com`)
   - Government pages (`fcc.gov`, `sbir.gov`)
   - News blogs (`businessinsider.com`, `techcrunch.com` articles)
   - Accelerator directories (`ycombinator.com/companies` pages)
   - Generic comparison sites
3. **Normalized URLs** to root domains (`https://domain.com`).
4. **De-duplicated** by root domain, preferring rows with better funding/stage data.
5. **Fixed known URL errors** from handoff prompt:
   - `soundeye.com` → `sound-eye.com`
   - `tendertec.com` → `tendertec.org`
   - Merged duplicate `Aloe Care Health` entries
   - Dropped inactive `healthinrealtime.com`
   - Dropped wrong-company `twolabs.com`
6. **Enriched stages** for remaining Unknown-stage companies by cross-referencing Crunchbase, funding announcements, and Firecrawl search results.
7. **Added 40+ manually-researched companies** to reach ≥100 rows, including:
   - Wearables: GyroGear, Rune Labs, CareBand, Rendever, MyndVR, De Oro Devices, etc.
   - In-home sensors: Canary Care, GrandCare, Nobi, Walabot Care, Kardian, etc.
   - Menopause: Winona, MPowder, Stella, Omena, Balance by Newson Health, etc.
8. **Final polish**: corrected URLs (e.g., `mpowder.co` → `mpowder.store`, dropped broken `fernehealth.com`), cleaned up category strings, regenerated outreach angles.

## Final Output Files
- **CSV**: `/Users/joshdev/Assistedly.ai/agetch-research/agetech_partners_outreach_100_v2.csv`
- **JSON**: `/Users/joshdev/Assistedly.ai/agetch-research/agetech_partners_outreach_100_v2.json`

## Statistics
| Metric | Count |
|--------|-------|
| Total rows | **101** |
| Unique domains | **101** |
| Seed | 56 |
| Series A | 30 |
| Pre-Seed | 3 |
| Angel | 2 |
| Bootstrapped | 1 |
| Series B+ | 9 |
| **Seed + Series A** | **86** |
| Menopause companies | **22** |
| Wearables | 34 |
| In-home sensors | 24 |
| Monitoring | 19 |
| Fall-detection | 9 |
| **Hardware/monitoring subtotal** | **79** |

## Issues & Caveats
- **TWENTY_API_KEY was revoked** on the CRM instance (`107.172.94.35:3002`). Attempted Infisical Agent login but could not retrieve a fresh key. Proceeded without Twenty CRM integration.
- **Some URLs not verified live**: A handful of Seed-stage startups may have pivoted or gone dark since last funding announcement. Recommended to spot-check top 20 Tier-1 prospects before outreach.
- **Menopause overlap**: 22 menopause rows are included; only a subset are device/monitoring companies. Most are D2C health brands with engaged 45-55 female audiences.
- **Head of BD column**: Largely empty for Seed-stage companies where this role is not publicly listed. Can be enriched via LinkedIn Sales Navigator if needed.
- **Outreach angles**: Templated by category. Menopause companies get a female-decision-maker angle; hardware companies get the aging-in-place → assisted-living handoff angle.

## Recommended Next Steps
1. **Import into CRM**: If Twenty CRM key is renewed, bulk-import the JSON via GraphQL `createCompanies` mutation.
2. **LinkedIn enrichment**: Use a tool like Apollo or Hunter to fill missing `head_of_business_dev_or_partnerships` emails for Tier-1 companies.
3. **Prioritize outreach**:
   - **Tier 1 (High fit, direct consumer product, Seed/Series A)**: Advosense, FallCall Solutions, Haelo, MindMics, Pontosense, Zemplee, Howz, CareBand, Rendever, Canary Care, MPowder, Winona, Elektra Health, Elektra Health, Midi Health, Alloy, Vira Health
   - **Tier 2 (Strong audience fit)**: Elektra Health, Evernow, Balance, Stella, ThePause
4. **A/B test outreach angles**: Test the two angle templates against each other for response rate.

## Scripts Produced
- `build_final_csv.py` — initial cleaning pipeline
- `expand_to_100.py` — bulk addition of researched companies
- `final_polish.py` — URL correction, dedup, category normalization, final output
