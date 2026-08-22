# Handoff Prompt: AgeTech / Menopause Referral-Partner Prospecting (continued)

## Goal
Build a structured list of **~100 small-scale AgeTech companies** (prioritizing **Seed / Series A** stages) that manufacture or sell **wearable devices, in-home sensors, fall-detection, or monitoring tools** for seniors aging at home. Also include relevant **menopause startups** because women in their 50s are primary decision-makers for assisted-living decisions for parents/in-laws.

The list will feed an **agent-to-agent referral engine** where these companies’ consumer customers can opt in to receiving assisted-living information from **assistedily.ai**.

## Environment (verified on this Mac)
- Working directory: `/Users/joshfialkoff/Documents/Coding Workspaces`
- Firecrawl CLI: `/opt/homebrew/bin/firecrawl`
- Python 3: `/usr/bin/python3`
- Firecrawl API key is stored in: `/Users/joshfialkoff/Documents/Coding Workspaces/AI-Assist-Living-Finder/.env`
- Scripts and outputs live under: `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/`

## What has already been done
1. **Search phase** – 23 Firecrawl web searches were run across:
   - Wearables / fall-detection / in-home sensors / monitoring for seniors
   - Menopause / femtech startups with seed/series A funding
   - Raw search JSON saved at: `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/search_results/all_searches.json`
2. **Scrape phase** – 140 candidate URLs scraped and saved as JSON under:
   `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/scraped/`
3. **Processing scripts** created:
   - `/Users/joshfialkoff/Documents/Coding Workspaces/research_agetech.py`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/research_agetech_phase2.py`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/research_agetech_compile.py`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/research_agetech_clean.py`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/research_agetech_filter.py`
4. **Current outputs** (preliminary, needs cleanup + expansion):
   - `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_raw.json`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_raw.csv`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_deduped.csv`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_filtered.csv`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_filtered.json`

The filtered list currently has **~70 rows** but still contains news/listicle entries, duplicate company entries, generic article titles, and many rows with **stage = Unknown**.

## Known/targeted companies to verify or add back
These were requested explicitly; ensure they are represented with correct, current URLs:
- KuboCare (kubocare.com if active)
- Sensi.AI (sensi.ai)
- SoundEye → found correct URL: `https://sound-eye.com`
- Howz (`https://howz.com`)
- Savi Security (verify active domain)
- Aloe Care Health (`https://aloecare.com` / `https://aloecarehealth.com`)
- CarePredict (`https://carepredict.com`)
- CareZapp (`https://carezapp.com`)
- Blooming Health (`https://bloominghealth.com`)
- Lindera (`https://lindera.de`)
- HealthInRealTime (`healthinrealtime.com` appears inactive – verify or drop)
- Inspiren (verify current domain)
- Silvertree (`https://silvertree.com`)
- Twolabs (verify domain; current scrape points to a pharma firm — may be wrong company)
- Alcove (`https://alcove.io`)
- smartQare (`https://smartqare.com`)
- Tendertec → found correct URL: `https://tendertec.org`

Menopause companies to include/verify:
- Elektra Health (`https://elektrahealth.com`)
- Midi Health (`https://midi-health.com` or similar)
- Evernow (`https://evernow.com`)
- Kindra / Our Kindra (`https://ourkindra.com`)
- Alloy (`https://alloy.us`)
- Lisa Health / Midday (`https://lisa-health.com` or midday)
- ThePause (`https://thepause.ai`)
- Adora Digital Health, Coral, Phenomic, Vira, Vella, Rosy, MenoLabs, Galvan (verify which are device/monitoring focused)

## Next steps for the new bot
1. **Read the current datasets**
   - `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_filtered.csv`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_raw.json`
2. **Clean the filtered list**
   - Remove obvious listicle / news / market-report / directory domains (e.g., failory.com, vcbacked.co, marketintelo.com, globalventuring.com, etc.).
   - De-duplicate by root domain and pick a canonical homepage URL (shortest meaningful path).
   - Normalize product categories to: `wearables`, `in-home-sensors`, `monitoring`, `fall-detection`, `menopause`.
   - Remove rows that are clearly not product companies.
3. **Verify each remaining company homepage**
   - Use `firecrawl scrape --json -f markdown` on the root homepage.
   - Optionally use `firecrawl scrape ... -Q "Is this the homepage of a startup selling wearables/sensors/monitoring/menopause solutions? What is the company name, product, and senior/menopause focus?"` to validate.
   - Remove rows that fail validation.
4. **Fill in funding / stage data**
   - For any row where stage is Unknown, run targeted searches/Known lookups:
     - `"<company name> seed funding"`
     - `"<company name> Series A"`
     - `"site:crunchbase.com <company name>"`
   - Update `stage`, `funding_info`, and `notes` fields.
   - Prioritize keeping Seed / Series A companies.
5. **Add missing companies**
   - Add the targeted companies above (and any new relevant startups discovered during cleanup).
   - Scrape their homepages and extract the same fields.
6. **De-duplicate and sanity-check**
   - Ensure ~100 rows total.
   - Aim for at least 50 flagged as Seed or Series A.
   - Make sure big incumbents (Apple, Google, Amazon, Philips, Bay Alarm Medical, Lifeline, etc.) are excluded unless they are a small/startup division.
7. **Write final outputs**
   - `/Users/joshfialkoff/Documents/Coding Workspaces/agetech-research/agetech_companies_FINAL.csv`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/agetech_companies_FINAL.json`
   - `/Users/joshfialkoff/Documents/Coding Workspaces/agetch-research/progress_notes.md` (summary of methods, counts by category/stage, issues, sources)

## Required output schema (CSV / JSON)
- `company_name`
- `website`
- `product_category`  (one or more of: wearables, in-home-sensors, monitoring, fall-detection, menopause)
- `stage`               (Seed, Series A, Pre-Seed, Angel, Unknown, etc.)
- `funding_info`
- `founders_leadership`
- `description`
- `verified`            (Y/N)
- `notes`               (source URLs, caveats, why included)

## Operational reminders
- Use **full file paths** in every command/script so the new Mac user can run it from the Goose app without cd confusion.
- Source the Firecrawl key before running CLI commands or load it from `/Users/joshfialkoff/Documents/Coding Workspaces/AI-Assist-Living-Finder/.env`.
- Keep Firecrawl concurrency low (~3 parallel calls) to avoid rate limits and credit burn.
- Do not expose the API key in final notes or outputs.
- When finished, present a short summary: total companies, counts by category, counts by stage, and a few highlighted high-fit prospects.
