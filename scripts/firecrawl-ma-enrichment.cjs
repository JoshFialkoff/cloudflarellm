#!/usr/bin/env node
/**
 * Firecrawl MA Facility Enrichment Script
 *
 * Identifies Massachusetts facilities with missing about/amenities/pricing
 * and re-scrapes their official websites with structured JSON extraction.
 *
 * Outputs:
 *   .firecrawl/ma-enrichment/<timestamp>/
 *   - search-results.json      (website discovery per facility)
 *   - scrape-results.json      (structured extractions)
 *   - enrichment-import.json   (NocoDB-ready merge payload)
 *
 * Credit Budget (estimated):
 *   ~107 facilities × (search 2cr + scrape-json 5cr) = ~750 credits
 *
 * Usage:
 *   FIRECRAWL_API_KEY=<key> node scripts/firecrawl-ma-enrichment.cjs
 *   # Or with batch limits:
 *   MAX_BATCH=25 DRY_RUN=1 node scripts/firecrawl-ma-enrichment.cjs
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Configuration ────────────────────────────────────────────────────────────
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";
const MAX_BATCH = parseInt(process.env.MAX_BATCH || "9999", 10);
const OUTPUT_DIR = path.join(".firecrawl", "ma-enrichment", new Date().toISOString().replace(/[:.]/g, "-"));

try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch {}

// ── Schema for structured extraction ────────────────────────────────────────
const EXTRACTION_SCHEMA = {
  facility_name: "string — official name of the facility",
  address: "string — full street address, city, state, zip",
  phone: "string — main contact phone number",
  website: "string — official website URL",
  about: "string — 2-4 sentence description of the facility, services, and atmosphere",
  care_types: "array of strings — e.g. ['Assisted Living', 'Memory Care', 'Independent Living']",
  capacity: "number — total resident capacity if stated",
  monthly_min: "number — lowest starting monthly cost in USD",
  monthly_max: "number — highest monthly cost in USD",
  amenities: "array of strings — e.g. ['Chef-prepared meals', 'Fitness center', 'Pet friendly']",
  parent_company: "string — corporate owner or operator if mentioned"
};

// ── Extract raw facility objects from massachusettsFacilities.js ────────────
function loadMassachusettsFacilities() {
  const jsPath = path.join(process.cwd(), "lib", "massachusettsFacilities.js");
  const content = fs.readFileSync(jsPath, "utf8");

  // The file contains a JSON-compatible object literal.
  const match = content.match(/const facilitiesData\s*=\s*(\{[\s\S]*?\n\});/);
  if (!match) throw new Error("Could not parse facilitiesData from massachusettsFacilities.js");
  const facilitiesData = JSON.parse(match[1]);

  const facilities = [];
  for (const key of Object.keys(facilitiesData)) {
    const f = facilitiesData[key];
    if (!f || typeof f !== "object") continue;
    facilities.push(f);
  }
  return facilities;
}

// ── Identify enrichment candidates ────────────────────────────────────────────
function needsEnrichment(facility) {
  const aboutMissing = !facility.about || facility.about.includes("Not available in public database");
  const amenitiesEmpty = !facility.amenities || facility.amenities.length === 0;
  const pricingMissing = !facility.monthlyMin || !facility.monthlyMax;
  return aboutMissing || amenitiesEmpty || pricingMissing;
}

// ── Shell helpers ────────────────────────────────────────────────────────────
function execJson(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 60000 });
    return JSON.parse(out);
  } catch (e) {
    console.error("Command failed:", cmd);
    console.error(e.stderr || e.message);
    return null;
  }
}

function safeFile(name) {
  return name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}

// ── Search for official website ──────────────────────────────────────────────
function findOfficialWebsite(facility) {
  const query = `${facility.name} assisted living ${facility.address?.split(",")[1] || "MA"} official website`;
  const limit = 5;
  const cmd = `firecrawl search --limit ${limit} --json "${query.replace(/"/g, '\\"')}"`;

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would search: ${query}`);
    return { query, results: [] };
  }

  const data = execJson(cmd);
  if (!data || !data.data) {
    console.warn(`  Search failed for ${facility.name}`);
    return { query, results: [] };
  }

  // Prefer result whose title contains the facility name and isn't a directory
  const results = data.data
    .filter(r => r.url && !r.url.includes("google.com") && !r.url.includes("facebook.com"))
    .slice(0, 3);

  const best = results.find(r =>
    r.title && r.title.toLowerCase().includes(facility.name.toLowerCase().split(" ")[0])
  ) || results[0];

  return {
    query,
    bestUrl: best?.url || null,
    results: results.map(r => ({ url: r.url, title: r.title, description: r.description }))
  };
}

// ── Scrape with structured JSON extraction ───────────────────────────────────
function scrapeFacility(url, facility) {
  const schemaJson = JSON.stringify(EXTRACTION_SCHEMA).replace(/"/g, '\\"');
  const instruct = `Extract facility information from this senior living facility page. Follow the JSON schema exactly and return only valid JSON. Schema: ${schemaJson}`;

  const cmd = `firecrawl scrape --url "${url}" --format json --only-main-content --query "${instruct.replace(/"/g, '\\"')}" --json --pretty`;

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would scrape: ${url}`);
    return { url, extracted: null, dryRun: true };
  }

  const data = execJson(cmd);
  if (!data || data.error) {
    console.warn(`  Scrape failed for ${url}: ${data?.error || "unknown"}`);
    return { url, extracted: null, error: data?.error };
  }

  // The CLI returns the page data; the query result may be in a top-level field
  const extracted = data.data || data;
  return { url, extracted };
}

// ── Merge scraped data into facility shape ───────────────────────────────────
function buildEnrichmentRecord(original, scraped) {
  const ext = scraped?.extracted || scraped;
  if (!ext || typeof ext !== "object") return null;

  // The query result may be nested under a "json" or "extract" field
  const payload = ext.json || ext.extract || ext;

  return {
    slug: original.slug,
    name: original.name,
    source_url: scraped.url,
    enriched_at: new Date().toISOString(),
    about: payload.about || payload.description || null,
    careTypes: Array.isArray(payload.care_types)
      ? payload.care_types
      : (typeof payload.care_types === "string" ? [payload.care_types] : null),
    capacity: typeof payload.capacity === "number" ? payload.capacity : null,
    monthlyMin: typeof payload.monthly_min === "number" ? payload.monthly_min : null,
    monthlyMax: typeof payload.monthly_max === "number" ? payload.monthly_max : null,
    amenities: Array.isArray(payload.amenities)
      ? payload.amenities.map(a => typeof a === "string" ? { icon: "✨", name: a } : a)
      : null,
    parentCompany: payload.parent_company || null,
    phone: payload.phone || null,
    address: payload.address || null,
    raw_extracted: payload
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!FIRECRAWL_API_KEY) {
    console.error("FIRECRAWL_API_KEY is required. Set it as an environment variable.");
    process.exit(1);
  }

  console.log("Loading Massachusetts facilities...");
  const allFacilities = loadMassachusettsFacilities();
  console.log(`Loaded ${allFacilities.length} facilities.`);

  const candidates = allFacilities.filter(needsEnrichment);
  console.log(`${candidates.length} facilities need enrichment.`);

  const batch = candidates.slice(0, MAX_BATCH);
  console.log(`Processing batch of ${batch.length} (MAX_BATCH=${MAX_BATCH}).\n`);

  const searchResults = [];
  const scrapeResults = [];
  const enrichmentRecords = [];

  for (let i = 0; i < batch.length; i++) {
    const facility = batch[i];
    const prefix = `[${i + 1}/${batch.length}]`;
    console.log(`${prefix} Enriching: ${facility.name}`);

    // Step 1: Find website
    const search = findOfficialWebsite(facility);
    searchResults.push({ facility: facility.name, ...search });

    if (!search.bestUrl) {
      console.log(`  No website found, skipping scrape.`);
      continue;
    }
    console.log(`  Found URL: ${search.bestUrl}`);

    // Step 2: Scrape
    const scraped = scrapeFacility(search.bestUrl, facility);
    scrapeResults.push(scraped);

    // Step 3: Build import record
    const record = buildEnrichmentRecord(facility, scraped);
    if (record) {
      enrichmentRecords.push(record);
      console.log(`  Extracted: about=${record.about ? "yes" : "no"}, amenities=${record.amenities?.length || 0}, pricing=${record.monthlyMin ? "yes" : "no"}`);
    } else {
      console.log(`  No structured data extracted.`);
    }

    // Throttle to avoid rate limits
    if (!DRY_RUN && i < batch.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  // ── Save outputs ───────────────────────────────────────────────────────────
  const searchPath = path.join(OUTPUT_DIR, "search-results.json");
  const scrapePath = path.join(OUTPUT_DIR, "scrape-results.json");
  const importPath = path.join(OUTPUT_DIR, "enrichment-import.json");

  fs.writeFileSync(searchPath, JSON.stringify(searchResults, null, 2));
  fs.writeFileSync(scrapePath, JSON.stringify(scrapeResults, null, 2));
  fs.writeFileSync(importPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "firecrawl-ma-enrichment",
    state: "MA",
    targetBase: "py95wcp6hdidnbz",
    targetTable: "m27a78vd4i6c1bc",
    targetTableName: "Facilities_Master",
    totalProcessed: batch.length,
    successfulExtractions: enrichmentRecords.filter(r => r.about || r.amenities?.length).length,
    records: enrichmentRecords
  }, null, 2));

  console.log(`\n✅ Done.`);
  console.log(`Search results:   ${searchPath}`);
  console.log(`Scrape results:   ${scrapePath}`);
  console.log(`Import payload:   ${importPath}`);

  // Print credits used (approximate)
  const searchCredits = batch.length * (2 / 5); // ~2cr per search (5 results avg)
  const scrapeCredits = enrichmentRecords.filter(r => r.source_url).length * 5;
  console.log(`\nEstimated credits consumed: ~${Math.round(searchCredits + scrapeCredits)}`);
  console.log(`  (Search: ~${Math.round(searchCredits)}, Scrape+JSON: ~${scrapeCredits})`);

  // Print NocoDB merge hint
  console.log(`\nNext steps:`);
  console.log(`  1. Review ${importPath}`);
  console.log(`  2. Run: node scripts/ops/sync-noco-to-code.cjs  (to merge into existing MA table)`);
  console.log(`  3. Or POST ${importPath} records to NocoDB REST API for bulk patch`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
