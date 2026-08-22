#!/usr/bin/env node
/**
 * Firecrawl Florida Facility Seed Script
 *
 * Maps FloridaHealthFinder ALF directory, crawls facility listings,
 * and scrapes individual facility pages for structured data.
 *
 * Outputs Florida-specific files separate from MA:
 *   .firecrawl/fl-seed/<timestamp>/
 *   - map-results.json         (URLs discovered from FloridaHealthFinder)
 *   - crawl-results.json       (Paginated directory crawl)
 *   - facility-extracts.json   (Structured data per facility)
 *   - florida-facilities.js    (Standalone lib/floridaFacilities.js stub)
 *   - florida-import.json      (NocoDB-ready bulk import payload)
 *
 * Separate NocoDB Table:
 *   Base: pfeipqmy5ybhs71 (2-26-26 Copy — Florida)
 *   Table: mx9i1ecm3jeqetu (Facilities_Florida)
 *   so Florida data never mingles with Massachusetts records.
 *
 * Credit Budget (estimated):
 *   Map: 1 cr
 *   Crawl (20 pages): ~20 cr
 *   Scrape+JSON (200 facilities): ~1000 cr
 *   Total: ~1021 credits
 *
 * Usage:
 *   FIRECRAWL_API_KEY=<key> node scripts/firecrawl-fl-seed.cjs
 *   FACILITY_LIMIT=50 DRY_RUN=1 node scripts/firecrawl-fl-seed.cjs
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Configuration ────────────────────────────────────────────────────────────
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";
const FACILITY_LIMIT = parseInt(process.env.FACILITY_LIMIT || "200", 10);
const CRAWL_LIMIT = parseInt(process.env.CRAWL_LIMIT || "50", 10);

// Florida directory entry points
const FL_MAP_URL = "https://quality.healthfinder.fl.gov/Facility-Provider/ALF?&type=0";
const FL_SEARCH_URL = "https://quality.healthfinder.fl.gov/Facility-Search/FacilityLocateSearch";
const FL_CRAWL_SEED = FL_MAP_URL;

const OUTPUT_DIR = path.join(".firecrawl", "fl-seed", new Date().toISOString().replace(/[:.]/g, "-"));
try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch {}

// ── Structured extraction schema tailored for Florida ALFs ───────────────────
const FL_EXTRACTION_SCHEMA = {
  facility_name: "string — official facility name",
  license_number: "string — Florida AHCA license number if shown",
  address: "string — full street address including city, state, zip",
  county: "string — Florida county",
  phone: "string — main phone number",
  website: "string — official website URL if linked",
  about: "string — 2-4 sentence facility description, services, philosophy",
  care_types: "array of strings — e.g. ['Assisted Living', 'Memory Care', 'Independent Living']",
  capacity: "number — licensed bed capacity",
  administrator_name: "string — current administrator or director",
  owner_operator: "string — owner or managing company",
  special_programs: "array of strings — e.g. ['Diabetes care', 'Wound care', 'Respite']",
  amenities: "array of strings — e.g. ['Transportation', 'Wi-Fi', 'Apartment-style']",
  pricing_note: "string — any price ranges or fee information mentioned",
  inspection_date: "string — most recent inspection date shown",
  overall_status: "string — e.g. 'In Compliance', 'Provisionally Licensed'"
};

// ── Shell helpers ──────────────────────────────────────────────────────────
function execJson(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 90000 });
    return JSON.parse(out);
  } catch (e) {
    console.error("Command failed:", cmd);
    console.error(e.stderr || e.message);
    return null;
  }
}

// ── Step 1: Map ──────────────────────────────────────────────────────────────
function mapFloridaDirectory() {
  console.log("\n📍 Step 1: Mapping FloridaHealthFinder ALF directory...");
  const cmd = `firecrawl map --json "${FL_MAP_URL}"`;

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would run: ${cmd}`);
    return { links: [], source: FL_MAP_URL };
  }

  const data = execJson(cmd);
  if (!data || !data.links) {
    console.warn("  Map returned no links. Falling back to search.");
    // Fallback: search for ALF listings
    const searchCmd = `firecrawl search --limit 20 --scrape --scrape-formats markdown --json "site:quality.healthfinder.fl.gov ALF Assisted Living Facility Florida"`;
    const searchData = execJson(searchCmd);
    return { links: (searchData?.data || []).map(r => r.url), source: "search-fallback" };
  }

  console.log(`  Discovered ${data.links.length} URLs.`);
  return { links: data.links, source: FL_MAP_URL };
}

// ── Step 2: Crawl paginated results ──────────────────────────────────────────
function crawlDirectory(seedUrl) {
  console.log("\n🕸️  Step 2: Crawling facility listing pages...");

  // Limit crawl depth / pages to keep credits controlled
  const cmd = `firecrawl crawl --json --limit ${CRAWL_LIMIT} "${seedUrl}"`;

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would run: ${cmd}`);
    return { data: [] };
  }

  const data = execJson(cmd);
  if (!data || !data.data) {
    console.warn("  Crawl returned no data.");
    return { data: [] };
  }

  console.log(`  Crawled ${data.data.length} pages.`);
  return data;
}

// ── Step 3: Extract facility detail URLs ─────────────────────────────────────
function extractFacilityUrls(mapLinks, crawlData) {
  console.log("\n🔗 Step 3: Extracting facility detail URLs...");

  const allUrls = new Set();

  // From map links: look for patterns indicating a facility detail page
  (mapLinks || []).forEach(url => {
    // FloridaHealthFinder detail URLs often contain Facility-Provider or provider ID patterns
    if (/quality\.healthfinder\.fl\.gov.*Facility-Provider|Detail|ProviderID|License/i.test(url)) {
      allUrls.add(url);
    }
  });

  // From crawl data: extract markdown links
  (crawlData?.data || []).forEach(page => {
    if (!page.markdown) return;
    const linkMatches = page.markdown.match(/https?:\/\/[^\s)"\]]+/g) || [];
    linkMatches.forEach(url => {
      if (/quality\.healthfinder\.fl\.gov|ahca\.myflorida\.com|apps\.ahca\.myflorida\.com/i.test(url)) {
        allUrls.add(url);
      }
    });
  });

  const uniqueUrls = Array.from(allUrls).slice(0, FACILITY_LIMIT * 2); // oversample
  console.log(`  Found ${uniqueUrls.length} candidate facility URLs (capped for review).`);
  return uniqueUrls;
}

// ── Step 4: Scrape individual facilities with structured JSON ────────────────
function scrapeFacilityDetails(urls) {
  console.log(`\n🔎 Step 4: Scraping up to ${urls.length} facility pages with JSON extraction...`);

  const schemaJson = JSON.stringify(FL_EXTRACTION_SCHEMA).replace(/"/g, '\\"');
  const instruct = `Extract detailed facility information from this Florida assisted living facility page. Return ONLY valid JSON conforming to this schema: ${schemaJson}`;

  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`  [${i + 1}/${urls.length}] Scraping ${url}`);

    const cmd = `firecrawl scrape --url "${url}" --format json --only-main-content --query "${instruct.replace(/"/g, '\\"')}" --json --pretty`;

    if (DRY_RUN) {
      console.log(`    [DRY RUN] Would scrape: ${url}`);
      results.push({ url, dryRun: true });
      continue;
    }

    const data = execJson(cmd);
    if (!data || data.error) {
      console.warn(`    Failed: ${data?.error || "unknown"}`);
      results.push({ url, error: data?.error || "unknown" });
      continue;
    }

    const extracted = data.data || data;
    const payload = extracted.json || extracted.extract || extracted;

    results.push({ url, extracted: payload });

    // Show preview
    if (payload && (payload.facility_name || payload.about)) {
      console.log(`    ✅ ${payload.facility_name || "Unnamed"} — ${payload.about?.slice(0, 60) || "no about"}...`);
    } else {
      console.log(`    ⚠️  No structured data extracted.`);
    }

    // Throttle
    if (i < urls.length - 1) {
      const jitter = 1000 + Math.floor(Math.random() * 1500);
      if (!DRY_RUN) {
        try { execSync(`sleep ${Math.floor(jitter / 1000)}`); } catch {}
      }
    }
  }

  return results;
}

// ── Transform to Florida lib shape ───────────────────────────────────────────
function buildFloridaFacilities(scrapeResults) {
  const facilities = [];
  let id = 1;

  for (const result of scrapeResults) {
    const ext = result.extracted;
    if (!ext || typeof ext !== "object") continue;
    if (!ext.facility_name && !ext.about) continue; // skip useless extractions

    const slug = (ext.facility_name || "facility")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const record = {
      id,
      slug,
      name: ext.facility_name || "Unknown",
      address: ext.address || null,
      county: ext.county || null,
      phone: ext.phone || null,
      website: ext.website || result.url,
      about: ext.about || null,
      careTypes: Array.isArray(ext.care_types) ? ext.care_types : [],
      capacity: typeof ext.capacity === "number" ? ext.capacity : null,
      monthlyMin: null, // FL pricing rarely public; leave for follow-up
      monthlyMax: null,
      amenities: Array.isArray(ext.amenities)
        ? ext.amenities.map(a => ({ icon: "✨", name: a }))
        : [],
      parentCompany: ext.owner_operator || null,
      administrator: ext.administrator_name || null,
      licenseNumber: ext.license_number || null,
      specialPrograms: ext.special_programs || [],
      pricingNote: ext.pricing_note || null,
      inspectionDate: ext.inspection_date || null,
      overallStatus: ext.overall_status || null,
      _fcSourceUrl: result.url,
      _fcExtractedAt: new Date().toISOString()
    };

    facilities.push(record);
    id++;
  }

  return facilities;
}

// ── Write standalone Florida lib file ────────────────────────────────────────
function writeFloridaLib(facilities) {
  const filePath = path.join(OUTPUT_DIR, "florida-facilities.js");
  const content = `/**
 * Florida Assisted Living Facilities
 * Auto-generated by scripts/firecrawl-fl-seed.cjs
 * Generated: ${new Date().toISOString()}
 * Count: ${facilities.length}
 *
 * ⚠️  FLORIDA DATA — SEPARATE FROM MASSACHUSETTS
 * This file is NOT imported by MA content engine.
 * Use app/florida/page.js or similar to render Florida guides.
 */

const floridaFacilitiesData = {
${facilities.map(f => `  "${f.id}": ${JSON.stringify(f, null, 2).replace(/\n/g, "\n  ")}`).join(",\n")}
};

module.exports = { floridaFacilitiesData };
`;

  fs.writeFileSync(filePath, content);
  console.log(`\n📝 Florida lib written: ${filePath}`);
  return filePath;
}

// ── Write NocoDB import payload ──────────────────────────────────────────────
function writeNocoDbImport(facilities) {
  const importPath = path.join(OUTPUT_DIR, "florida-import.json");
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "firecrawl-fl-seed",
    state: "FL",
    nocoDb: {
      url: process.env.NOCODB_URL || "http://23.95.189.106:8080",
      baseId: "pfeipqmy5ybhs71",
      tableId: "mx9i1ecm3jeqetu",
      tableName: "Facilities_Florida"
    },
    recordCount: facilities.length,
    records: facilities
  };
  fs.writeFileSync(importPath, JSON.stringify(payload, null, 2));
  console.log(`📝 NocoDB import payload: ${importPath}`);
  return importPath;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!FIRECRAWL_API_KEY) {
    console.error("FIRECRAWL_API_KEY is required. Set it as an environment variable.");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("🌴 Florida Facility Seed — Firecrawl Pipeline");
  console.log("=".repeat(60));
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Facility limit:   ${FACILITY_LIMIT}`);
  console.log(`Dry run:          ${DRY_RUN ? "YES" : "NO"}`);

  // Step 1: Map
  const mapData = mapFloridaDirectory();
  fs.writeFileSync(path.join(OUTPUT_DIR, "map-results.json"), JSON.stringify(mapData, null, 2));

  // Step 2: Crawl
  const crawlData = crawlDirectory(FL_CRAWL_SEED);
  fs.writeFileSync(path.join(OUTPUT_DIR, "crawl-results.json"), JSON.stringify(crawlData, null, 2));

  // Step 3: Extract URLs
  const facilityUrls = extractFacilityUrls(mapData.links, crawlData);
  fs.writeFileSync(path.join(OUTPUT_DIR, "facility-urls.json"), JSON.stringify(facilityUrls, null, 2));

  // Step 4: Scrape
  const scrapeResults = scrapeFacilityDetails(facilityUrls.slice(0, FACILITY_LIMIT));
  fs.writeFileSync(path.join(OUTPUT_DIR, "facility-extracts.json"), JSON.stringify(scrapeResults, null, 2));

  // Step 5: Transform
  const facilities = buildFloridaFacilities(scrapeResults);
  console.log(`\n📊 Successfully structured ${facilities.length} Florida facilities.`);

  // Step 6: Write outputs
  const libPath = writeFloridaLib(facilities);
  const importPath = writeNocoDbImport(facilities);

  // Credit estimate
  const mapCredits = 1;
  const crawlCredits = Math.min(CRAWL_LIMIT, (crawlData?.data || []).length);
  const scrapeCredits = facilities.length * 5; // scrape + json format
  console.log(`\n💰 Estimated credits consumed: ~${mapCredits + crawlCredits + scrapeCredits}`);
  console.log(`   Map: ${mapCredits}, Crawl: ~${crawlCredits}, Scrape+JSON: ${scrapeCredits}`);

  console.log(`\n✅ Florida seed complete.`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review: ${importPath}`);
  console.log(`  2. Copy lib: cp ${libPath} lib/floridaFacilities.js`);
  console.log(`  3. Create NocoDB Florida table (separate from MA)`);
  console.log(`  4. Run: node scripts/ops/nocodb-import-fl.cjs --file ${importPath}`);
  console.log(`  5. Build app/florida/page.js hub using floridaFacilitiesData`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
