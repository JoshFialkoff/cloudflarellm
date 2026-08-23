#!/usr/bin/env node
/**
 * Sync Facility Intelligence → NocoDB + Local JSON Snapshots
 *
 * Main orchestrator for Phases A→D:
 *   Phase A — Deep Listing Scrape (Firecrawl rawHtml + markdown)
 *   Phase B — Individual Review Extraction (structured HTML parsing)
 *   Phase C — Signal Analysis (velocity, sentiment, forensics, occupancy)
 *   Phase D — NocoDB Write + Local Snapshot
 *
 * New/augmented script replacing (not deleting) sync-reviews-to-nocodb.cjs
 *
 * Environment Variables:
 *   FIRECRAWL_API_KEY               - Firecrawl API key
 *   NOCODB_API_TOKEN                - NocoDB auth token
 *   NOCODB_URL                      - Default http://23.95.189.106:8080
 *   NOCODB_BASE_ID                  - Default pfeipqmy5ybhs71
 *   NOCODB_FACILITIES_TABLE_ID      - Default mix4o0ymn0l2nhz
 *   NOCODB_LISTINGS_TABLE_ID        - New table for listing intelligence
 *   NOCODB_REVIEWS_DEEP_TABLE_ID    - New table for deep reviews
 *   NOCODB_FORENSICS_TABLE_ID       - New table for forensics
 *   REVIEW_BATCH_SIZE               - Max facilities per run (default 10)
 *   REVIEW_DRY_RUN                  - Set "1" to skip NocoDB writes
 *   INTELLIGENCE_SKIP_DEEP_REVIEWS  - Set "1" to skip Phase B (faster)
 *   INTELLIGENCE_SKIP_FORENSICS     - Set "1" to skip forensics
 *   INTELLIGENCE_SKIP_COMP_SETS     - Set "1" to skip comp-set JSON generation
 *
 * Usage:
 *   FIRECRAWL_API_KEY=xxx NOCODB_API_TOKEN=xxx node scripts/sync-facility-intelligence.cjs
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const https = require("https");
const http = require("http");

// ── Lib Imports ───────────────────────────────────────────────────────────────
const {
  PLATFORM_QUERIES,
  extractListingIntelligence,
  extractDeepReviews,
  stripHtmlTags,
} = require("./lib/intelligence-extractors.cjs");

const { computeForensics } = require("./lib/forensics-engine.cjs");
const { computeVelocity, loadPreviousSnapshots } = require("./lib/velocity-calculator.cjs");
const { aggregatePlatformSentiment, sentimentGapReport } = require("./lib/sentiment-scorer.cjs");
const { estimateOccupancy } = require("./lib/occupancy-proxy.cjs");

// ── Configuration ───────────────────────────────────────────────────────────
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN;
const NOCODB_URL = process.env.NOCODB_URL || "http://23.95.189.106:8080";
const NOCODB_BASE_ID = process.env.NOCODB_BASE_ID || "pfeipqmy5ybhs71";
const NOCODB_FACILITIES_TABLE_ID = process.env.NOCODB_FACILITIES_TABLE_ID || "mix4o0ymn0l2nhz";
const NOCODB_LISTINGS_TABLE_ID = process.env.NOCODB_LISTINGS_TABLE_ID || "";
const NOCODB_REVIEWS_DEEP_TABLE_ID = process.env.NOCODB_REVIEWS_DEEP_TABLE_ID || "";
const NOCODB_FORENSICS_TABLE_ID = process.env.NOCODB_FORENSICS_TABLE_ID || "";

const BATCH_SIZE = parseInt(process.env.REVIEW_BATCH_SIZE || "10", 10);
const DRY_RUN = process.env.REVIEW_DRY_RUN === "1";
const SKIP_DEEP_REVIEWS = process.env.INTELLIGENCE_SKIP_DEEP_REVIEWS === "1";
const SKIP_FORENSICS = process.env.INTELLIGENCE_SKIP_FORENSICS === "1";
const SKIP_COMP_SETS = process.env.INTELLIGENCE_SKIP_COMP_SETS === "1";

const FACILITIES_JSON = path.join(__dirname, "../public/data/chart-facilities.json");
const OUT_DIR = path.join(__dirname, "../public/data/intelligence-snapshots");
const COMP_SETS_DIR = path.join(__dirname, "../public/data/comp-sets");

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUT_FILE = path.join(OUT_DIR, `${timestamp}.json`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[intelligence] ${msg}`);
}

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function normalizeName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function httpRequest(method, url, body = null, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await new Promise((resolve) => {
        const proto = url.startsWith("https") ? https : http;
        const bodyStr = body ? JSON.stringify(body) : null;
        const req = proto.request(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "xc-token": NOCODB_API_TOKEN,
          },
          timeout: 45000,
        }, (res) => {
          let d = "";
          res.on("data", (c) => (d += c));
          res.on("end", () => resolve({ status: res.statusCode, body: d }));
        });
        req.on("error", (e) => resolve({ status: 0, body: e.message }));
        req.on("timeout", () => resolve({ status: 0, body: "timeout" }));
        if (bodyStr) req.write(bodyStr);
        req.end();
      });
      if (res.status === 0 || res.status >= 500) {
        lastErr = res;
        if (attempt < retries) {
          const delay = 2000 * Math.pow(2, attempt);
          log(`  NocoDB ${method} retry ${attempt + 1}/${retries} after ${delay}ms`);
          await sleep(delay);
          continue;
        }
      }
      return res;
    } catch (e) {
      lastErr = { status: 0, body: e.message };
      if (attempt < retries) await sleep(2000 * Math.pow(2, attempt));
    }
  }
  return lastErr || { status: 0, body: "unknown error" };
}

// ── NocoDB Facility Map ───────────────────────────────────────────────────────
async function fetchFacilityMap() {
  const url = `${NOCODB_URL}/api/v3/data/${NOCODB_BASE_ID}/${NOCODB_FACILITIES_TABLE_ID}/records?limit=300`;
  const { status, body } = await httpRequest("GET", url);
  if (status < 200 || status >= 300) {
    log(`Failed to fetch facility map: HTTP ${status} — ${body?.slice(0, 200)}`);
    return { exact: {}, normalized: {} };
  }

  const data = JSON.parse(body);
  const records = data.records || [];
  const exact = {};
  const normalized = {};

  for (const rec of records) {
    const id = rec.id;
    const name = rec.fields?.Facility;
    if (!id || !name) continue;
    exact[String(name).trim()] = id;
    normalized[normalizeName(name)] = id;
  }

  log(`Loaded ${records.length} facilities from NocoDB for name→ID linking`);
  return { exact, normalized };
}

function resolveFacilityId(facName, facilityMap) {
  const trimmed = String(facName).trim();
  if (facilityMap.exact[trimmed]) return facilityMap.exact[trimmed];
  const norm = normalizeName(trimmed);
  if (facilityMap.normalized[norm]) return facilityMap.normalized[norm];
  return null;
}

// ── Firecrawl Wrappers ────────────────────────────────────────────────────────
function firecrawlSearch(query) {
  const outPath = path.join(".firecrawl", "search-intel-tmp.json");
  const args = ["search", query, "--limit", "5", "--json", "-o", outPath];
  try {
    const res = spawnSync("firecrawl", args, {
      env: { ...process.env, FIRECRAWL_API_KEY, FIRECRAWL_NO_SEARCH_FEEDBACK: "1" },
      encoding: "utf8",
      timeout: 60000,
    });
    if (res.status !== 0) {
      log(`Search failed: ${res.stderr?.slice(0, 200)}`);
      return [];
    }
    const data = readJson(outPath);
    return data.data?.web || [];
  } catch (e) {
    log(`Search failed: ${e.message}`);
    return [];
  }
}

function firecrawlScrapeRawHtml(url) {
  const args = [
    "scrape", url,
    "--format", "rawHtml",
    "--only-main-content",
    "--wait-for", "5000",
    "--json",
  ];
  try {
    const res = spawnSync("firecrawl", args, {
      env: { ...process.env, FIRECRAWL_API_KEY },
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 2 * 1024 * 1024,
    });
    if (res.status !== 0) {
      log(`Scrape failed for ${url}: ${res.stderr?.slice(0, 200)}`);
      return null;
    }
    const output = res.stdout?.trim();
    if (!output) return null;

    const jsonStart = output.indexOf("{");
    const jsonEnd = output.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const data = JSON.parse(output.slice(jsonStart, jsonEnd + 1));

    const rawHtml = (data.rawHtml || data.html || "").slice(0, 10000);
    const meta = data.metadata || {};
    return { rawHtml, meta };
  } catch (e) {
    log(`Scrape exception for ${url}: ${e.message}`);
    return null;
  }
}

function firecrawlScrapeMarkdown(url) {
  const args = [
    "scrape", url,
    "--format", "markdown",
    "--wait-for", "5000",
    "--json",
  ];
  try {
    const res = spawnSync("firecrawl", args, {
      env: { ...process.env, FIRECRAWL_API_KEY },
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });
    if (res.status !== 0) {
      log(`Markdown scrape failed for ${url}: ${res.stderr?.slice(0, 200)}`);
      return "";
    }
    const output = res.stdout?.trim();
    if (!output) return "";
    const jsonStart = output.indexOf("{");
    const jsonEnd = output.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return "";
    const data = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
    return (data.markdown || data.data?.markdown || "").slice(0, 50000);
  } catch (e) {
    log(`Markdown scrape exception for ${url}: ${e.message}`);
    return "";
  }
}

// ── NocoDB Writes ─────────────────────────────────────────────────────────────
async function nocoCreateListingRecord(listing, facilityId) {
  if (DRY_RUN || !NOCODB_API_TOKEN || !NOCODB_LISTINGS_TABLE_ID) return { skipped: true };

  const url = `${NOCODB_URL}/api/v3/data/${NOCODB_BASE_ID}/${NOCODB_LISTINGS_TABLE_ID}/records`;
  const payload = {
    fields: {
      facility_name: facilityId ? [{ id: facilityId }] : [],
      snapshot_at: listing.last_scraped_at,
      platform: listing.platform,
      url: listing.url,
      facility_found: listing.facility_found,
      page_type: listing.page_type,
      photos_present: listing.photos_present,
      photo_count_estimate: listing.photo_count_estimate,
      pricing_disclosed: listing.pricing_disclosed,
      price_text: listing.price_text,
      price_parsed_low: listing.price_parsed_low,
      price_parsed_high: listing.price_parsed_high,
      amenities_json: JSON.stringify(listing.amenities_list),
      care_types_json: JSON.stringify(listing.care_types_listed),
      response_rate_visible: listing.response_rate_visible,
      response_rate_text: listing.response_rate_text,
      owner_response_count: listing.owner_response_count,
      total_reviews_on_page: listing.total_reviews_on_page,
      page_title: listing.page_title,
      page_description: listing.page_description,
      extraction_confidence: listing.extraction_confidence,
      extractor_version: listing._extractor_version,
    },
  };

  const { status, body } = await httpRequest("POST", url, [payload], 2);
  if (status >= 200 && status < 300) {
    const parsed = JSON.parse(body);
    return { ok: true, id: parsed?.records?.[0]?.id };
  }
  return { ok: false, status, body: body?.slice(0, 300) };
}

async function nocoCreateDeepReviewRecords(reviews, facilityId) {
  if (DRY_RUN || !NOCODB_API_TOKEN || !NOCODB_REVIEWS_DEEP_TABLE_ID) return { skipped: true, count: 0 };
  if (!Array.isArray(reviews) || reviews.length === 0) return { skipped: true, count: 0 };

  const url = `${NOCODB_URL}/api/v3/data/${NOCODB_BASE_ID}/${NOCODB_REVIEWS_DEEP_TABLE_ID}/records`;
  let created = 0;
  let failed = 0;

  for (const r of reviews.slice(0, 50)) {
    const payload = {
      fields: {
        facility_name: facilityId ? [{ id: facilityId }] : [],
        platform: r.platform,
        source_url: r.source_url || "",
        reviewer_name: r.reviewer_name,
        review_date: r.review_date ? new Date(r.review_date).toISOString().slice(0, 10) : null,
        rating: r.rating,
        review_text: r.review_text,
        review_text_hash: r._full_text_hash,
        is_owner_response: r.is_owner_response,
        reviewer_total_reviews: r.reviewer_total_reviews,
        reviewer_location: r.reviewer_location,
        extraction_confidence: r.extraction_confidence,
        extracted_at: new Date().toISOString(),
      },
    };

    const { status, body } = await httpRequest("POST", url, [payload], 1);
    if (status >= 200 && status < 300) {
      created++;
    } else {
      failed++;
    }
    await sleep(200);
  }

  return { ok: created > 0, created, failed };
}

async function nocoCreateForensicsRecord(forensics, facilityId) {
  if (DRY_RUN || !NOCODB_API_TOKEN || !NOCODB_FORENSICS_TABLE_ID) return { skipped: true };

  const url = `${NOCODB_URL}/api/v3/data/${NOCODB_BASE_ID}/${NOCODB_FORENSICS_TABLE_ID}/records`;
  const payload = {
    fields: {
      facility_name: facilityId ? [{ id: facilityId }] : [],
      computed_at: forensics.computed_at,
      analysis_period_start: null,
      analysis_period_end: null,
      total_reviews_analyzed: forensics.total_reviews_analyzed,
      overall_risk_score: forensics.overall_risk_score,
      risk_level: forensics.risk_level,
      signals_json: JSON.stringify(forensics.signals),
      flagged_reviews_json: JSON.stringify(forensics.flagged_reviews),
      recommendations_json: JSON.stringify(forensics.recommendations),
      report_markdown: forensics.report_markdown,
      model_version: forensics.model_version,
    },
  };

  const { status, body } = await httpRequest("POST", url, [payload], 2);
  if (status >= 200 && status < 300) {
    const parsed = JSON.parse(body);
    return { ok: true, id: parsed?.records?.[0]?.id };
  }
  return { ok: false, status, body: body?.slice(0, 300) };
}

// ── Comp-Set Builder ──────────────────────────────────────────────────────────
function buildCompSet(facility, allFacilities, latestSnapshots) {
  if (SKIP_COMP_SETS) return null;

  const RADIUS_MILES = 15;
  const MAX_COMPS = 5;

  const competitors = allFacilities
    .filter((f) => f.name !== facility.name)
    .map((f) => ({
      ...f,
      distance: haversineDistance(
        facility.lat, facility.lng,
        f.lat, f.lng
      ),
    }))
    .filter((f) => f.distance <= RADIUS_MILES)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_COMPS);

  const compData = competitors.map((c) => {
    const snap = latestSnapshots.find((s) => normalizeName(s.facility_name) === normalizeName(c.name));
    return {
      name: c.name,
      distance_miles: Math.round(c.distance * 10) / 10,
      chart_facility_id: c.id,
      latest_snapshot_date: snap?.snapshot_at || null,
      listing_health: snap
        ? Object.fromEntries(snap.listings.map((l) => [l.platform, l.facility_found]))
        : {},
      pricing: {
        foia_low: c.feeLow,
        foia_high: c.feeHigh,
        listed_low: snap?.listings?.find((l) => l.price_parsed_low)?.price_parsed_low || null,
        listed_high: snap?.listings?.find((l) => l.price_parsed_high)?.price_parsed_high || null,
      },
      reviews: snap
        ? {
            total_count: snap.listings?.reduce((s, l) => s + (l.total_reviews_on_page || 0), 0) || 0,
            average_rating: null,
            velocity_per_week: snap.velocity?.overall_velocity_per_week || 0,
          }
        : { total_count: 0, average_rating: null, velocity_per_week: 0 },
      amenities: snap
        ? [...new Set(snap.listings?.flatMap((l) => l.amenities_list || []) || [])]
        : [],
      response_rate: snap?.listings?.find((l) => l.response_rate_visible)?.response_rate_text || null,
    };
  });

  // Subject pricing position
  const allLowPrices = compData.map((c) => c.pricing.foia_low).filter(Boolean);
  const medianLow = allLowPrices.length > 0
    ? allLowPrices.sort((a, b) => a - b)[Math.floor(allLowPrices.length / 2)]
    : null;

  let pricingPosition = "unknown";
  if (facility.feeLow && medianLow) {
    if (facility.feeLow < medianLow - 100) pricingPosition = "below_median";
    else if (facility.feeLow > medianLow + 100) pricingPosition = "above_median";
    else pricingPosition = "at_median";
  }

  const subjectAmenities = facility.amenities || [];
  const compAmenitySet = new Set(compData.flatMap((c) => c.amenities));
  const amenityGaps = [...compAmenitySet].filter((a) => !subjectAmenities.includes(a));

  const recommendation = amenityGaps.length > 0
    ? `Adding ${amenityGaps.slice(0, 3).join(", ")} would close gaps with ${compData.filter((c) => c.amenities.some((a) => amenityGaps.includes(a))).length} of ${compData.length} competitors within ${RADIUS_MILES} miles.`
    : `Amenity coverage is competitive with ${compData.length} peers within ${RADIUS_MILES} miles.`;

  return {
    subject_facility: facility.name,
    subject_city: facility.cityClean || facility.city,
    comp_set_radius_miles: RADIUS_MILES,
    competitors: compData,
    subject_vs_comp: {
      pricing_position: pricingPosition,
      pricing_gap_dollars: facility.feeLow && medianLow ? facility.feeLow - medianLow : null,
      review_count_percentile: null, // Would require full ranking
      rating_percentile: null,
      amenity_gaps: amenityGaps,
      recommendation,
    },
  };
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Main Pipeline ───────────────────────────────────────────────────────────────
async function main() {
  log("Starting facility intelligence sync v1 (Phases A→D)...");

  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY required");
  if (!DRY_RUN && !NOCODB_API_TOKEN) throw new Error("NOCODB_API_TOKEN required (or set REVIEW_DRY_RUN=1)");

  ensureDir(OUT_DIR);
  ensureDir(COMP_SETS_DIR);
  ensureDir(path.join(".firecrawl"));

  const chartData = readJson(FACILITIES_JSON);
  const facilities = chartData.facilities || [];
  log(`Loaded ${facilities.length} facilities from chart-facilities.json`);

  const facilityMap = await fetchFacilityMap();
  let linkedCount = 0;
  let unmatchedCount = 0;

  const batch = facilities.slice(0, BATCH_SIZE);
  log(`Processing batch of ${batch.length} facilities (BATCH_SIZE=${BATCH_SIZE})`);

  const results = [];
  const nocoStats = { listings: 0, listingsFail: 0, deepReviews: 0, deepReviewsFail: 0, forensics: 0, forensicsFail: 0 };
  let compSetsGenerated = 0;

  for (let i = 0; i < batch.length; i++) {
    const fac = batch[i];
    const facName = fac.name;
    const city = fac.cityClean || fac.city || "";
    log(`\n[${i + 1}/${batch.length}] ${facName} (${city})`);

    const facilityId = resolveFacilityId(facName, facilityMap);
    if (facilityId) {
      linkedCount++;
      log(`  Linked to NocoDB facility record id=${facilityId}`);
    } else {
      unmatchedCount++;
      log(`  ⚠️ No NocoDB link found for "${facName}"`);
    }

    // Load previous snapshots for velocity
    const previousSnapshots = loadPreviousSnapshots(facName);

    // ── Phase A + B: Search → Scrape → Extract ──────────────────────────────
    const platformResults = [];
    const allDeepReviews = [];
    const seenUrls = new Set();

    for (const platConfig of PLATFORM_QUERIES) {
      log(`  [Phase A] Searching ${platConfig.name}...`);
      const links = firecrawlSearch(platConfig.searchQuery(fac));
      if (!links.length) {
        log(`    No results`);
        continue;
      }

      const topUrl = links[0].url;
      if (seenUrls.has(topUrl)) {
        log(`    Skipping duplicate URL`);
        continue;
      }
      seenUrls.add(topUrl);

      // Validate that the URL actually belongs to the target platform
      const platformDomain = platConfig.listingIndicators.find((ind) => ind.includes("."));
      if (platformDomain) {
        const baseDomain = platformDomain.split("/")[0].replace("www.", "");
        if (!topUrl.includes(baseDomain)) {
          log(`    Search result domain mismatch (expected ${baseDomain}, got ${topUrl})`);
          continue;
        }
      }

      // Skip blacklisted / generic pages
      if (platConfig.blacklistPatterns.some((bp) => topUrl.includes(bp))) {
        log(`    Skipping blacklisted URL pattern`);
        continue;
      }
      const genericPatterns = [/best\s+assisted\s+living/i, /assisted\s+living\s+facilities\s+in/i, /top\s+\d+/i, /\d+\s+best\s+/i];
      const isGeneric = genericPatterns.some((p) => p.test(links[0].title || ""));
      if (isGeneric) {
        log(`    Skipping generic directory page: ${(links[0].title || "").slice(0, 60)}`);
        continue;
      }
      if (topUrl.includes("m.yelp.com/search")) {
        log(`    Skipping Yelp search result page`);
        continue;
      }

      log(`    Found: ${topUrl}`);

      // Scrape listing
      const searchMeta = {
        sourceURL: topUrl,
        title: links[0].title || "",
        description: links[0].description || "",
      };
      let pageData = firecrawlScrapeRawHtml(topUrl);
      let listingIntel;
      let mdText = null;

      if (!pageData) {
        log(`    RawHtml scrape failed; trying markdown fallback...`);
        mdText = firecrawlScrapeMarkdown(topUrl);
        const fakeHtml = `<div>${(mdText || "").replace(/\n/g, " ")}</div>`;
        listingIntel = extractListingIntelligence(fakeHtml, searchMeta, platConfig.name);
        listingIntel.extraction_confidence = "low";
        listingIntel._extractor_version += "-md-fallback";
      } else {
        // Scrape meta takes precedence over search meta; search meta provides URL fallback
        const mergedMeta = { ...searchMeta, ...pageData.meta };
        listingIntel = extractListingIntelligence(pageData.rawHtml, mergedMeta, platConfig.name);
        // If rawHtml signals are weak, also try markdown for text enrichment
        const weakRawHtml =
          pageData.rawHtml.length < 1200 ||
          (!listingIntel.total_reviews_on_page && !listingIntel.pricing_disclosed && listingIntel.amenities_list.length === 0);
        if (weakRawHtml) {
          log(`    RawHtml signals weak (${pageData.rawHtml.length} chars); trying markdown fallback...`);
          mdText = firecrawlScrapeMarkdown(topUrl);
          if (mdText && mdText.length > 200) {
            const fakeHtml = `<div>${mdText.replace(/\n/g, " ")}</div>`;
            const mdIntel = extractListingIntelligence(fakeHtml, { ...pageData.meta, ...searchMeta }, platConfig.name);
            // Merge: prefer markdown for text-based fields when rawHtml missed them
            if (!listingIntel.total_reviews_on_page && mdIntel.total_reviews_on_page) {
              listingIntel.total_reviews_on_page = mdIntel.total_reviews_on_page;
            }
            if (!listingIntel.pricing_disclosed && mdIntel.pricing_disclosed) {
              listingIntel.pricing_disclosed = true;
              listingIntel.price_text = mdIntel.price_text || listingIntel.price_text;
              listingIntel.price_parsed_low = mdIntel.price_parsed_low || listingIntel.price_parsed_low;
              listingIntel.price_parsed_high = mdIntel.price_parsed_high || listingIntel.price_parsed_high;
            }
            if (listingIntel.amenities_list.length === 0 && mdIntel.amenities_list.length > 0) {
              listingIntel.amenities_list = mdIntel.amenities_list;
            }
            if (!listingIntel.photos_present && mdIntel.photos_present) {
              listingIntel.photos_present = true;
              listingIntel.photo_count_estimate = mdIntel.photo_count_estimate || listingIntel.photo_count_estimate;
            }
            listingIntel.extraction_confidence = "medium";
            listingIntel._extractor_version += "-md-merge";
          }
        }
      }

      log(`    Listing: found=${listingIntel.facility_found}, photos=${listingIntel.photo_count_estimate}, pricing=${listingIntel.pricing_disclosed}, amenities=${listingIntel.amenities_list.length}, reviews=${listingIntel.total_reviews_on_page}, confidence=${listingIntel.extraction_confidence}`);
      platformResults.push(listingIntel);

      // Phase B: Deep review extraction
      let deepReviews = null;
      if (!SKIP_DEEP_REVIEWS) {
        log(`    [Phase B] Extracting deep reviews...`);
        let reviewMd = pageData && pageData.markdown ? pageData.markdown : mdText;
        if (pageData) {
          deepReviews = extractDeepReviews(pageData.rawHtml, platConfig.name, reviewMd);
          if (deepReviews && deepReviews.length > 0) {
            const mdCount = deepReviews.filter(r => r._extraction_source && r._extraction_source.startsWith('markdown')).length;
            if (mdCount > 0) log(`      Extracted ${mdCount} review cards from markdown`);
          }
        }
        // On-demand markdown fetch if HTML extraction failed and we don't have markdown yet
        if ((!deepReviews || deepReviews.length === 0) && pageData && (!reviewMd || reviewMd.length < 200)) {
          log(`      HTML extraction failed; fetching markdown for deep review extraction...`);
          reviewMd = firecrawlScrapeMarkdown(topUrl);
          if (reviewMd && reviewMd.length > 200) {
            deepReviews = extractDeepReviews(pageData.rawHtml, platConfig.name, reviewMd);
            if (deepReviews && deepReviews.length > 0) {
              const mdCount = deepReviews.filter(r => r._extraction_source && r._extraction_source.startsWith('markdown')).length;
              if (mdCount > 0) log(`      Extracted ${mdCount} review cards from on-demand markdown`);
            }
          }
        }
        if (deepReviews && deepReviews.length > 0) {
          log(`      Extracted ${deepReviews.length} review cards`);
          for (const dr of deepReviews) {
            dr.source_url = topUrl;
          }
          allDeepReviews.push(...deepReviews);
        } else {
          log(`      No deep reviews extracted`);
        }
      }

      // Write listing to NocoDB
      if (!DRY_RUN && NOCODB_LISTINGS_TABLE_ID) {
        const nocoRes = await nocoCreateListingRecord(listingIntel, facilityId);
        if (nocoRes.ok) nocoStats.listings++;
        else if (!nocoRes.skipped) nocoStats.listingsFail++;
      }

      // Gentle delay between platform requests
      await sleep(1500);
    }

    // ── Phase C: Signal Analysis ────────────────────────────────────────────
    log(`  [Phase C] Signal analysis...`);

    // Velocity
    const velocity = computeVelocity(platformResults, facName, previousSnapshots);
    log(`    Velocity: ${velocity.overall_velocity_per_week ?? "N/A"}/week, trend=${velocity.trend}`);

    // Sentiment
    let sentiment = null;
    if (allDeepReviews.length > 0) {
      const reviewsByPlatform = {};
      for (const r of allDeepReviews) {
        if (!reviewsByPlatform[r.platform]) reviewsByPlatform[r.platform] = [];
        reviewsByPlatform[r.platform].push(r);
      }
      const platformSentiments = aggregatePlatformSentiment(reviewsByPlatform);
      const gapReport = sentimentGapReport(platformSentiments);
      const avgGap = Object.values(platformSentiments).length >= 2
        ? Math.max(...Object.values(platformSentiments).map((s) => s.average)) -
          Math.min(...Object.values(platformSentiments).map((s) => s.average))
        : 0;

      sentiment = {
        platform_sentiments: platformSentiments,
        cross_platform_gap: Math.round(avgGap * 1000) / 1000,
        cross_platform_gap_label: gapReport,
      };
      log(`    Sentiment: ${Object.keys(platformSentiments).length} platforms analyzed`);
    } else {
      log(`    Sentiment: skipped (no deep reviews)`);
    }

    // Forensics
    let forensics = null;
    if (!SKIP_FORENSICS) {
      forensics = computeForensics(allDeepReviews, facName);
      log(`    Forensics: risk=${forensics.overall_risk_score}/100 (${forensics.risk_level}), flagged=${forensics.flagged_reviews.length}`);
    }

    // Occupancy proxy
    const occupancyProxy = estimateOccupancy(
      fac.occupancyRate,
      chartData.generatedAt || chartData.reportAsOf,
      velocity.overall_velocity_per_week,
      null // priceHistory not yet tracked
    );
    log(`    Occupancy proxy: ${occupancyProxy.estimated_occupancy}% (confidence=${occupancyProxy.confidence})`);

    // ── Phase D: NocoDB Deep Writes ─────────────────────────────────────────
    if (!DRY_RUN && allDeepReviews.length > 0 && NOCODB_REVIEWS_DEEP_TABLE_ID) {
      log(`  [Phase D] Writing ${allDeepReviews.length} deep reviews to NocoDB...`);
      const drRes = await nocoCreateDeepReviewRecords(allDeepReviews, facilityId);
      if (drRes.ok) {
        nocoStats.deepReviews += drRes.created;
        log(`    Created ${drRes.created} deep review records`);
      } else if (!drRes.skipped) {
        nocoStats.deepReviewsFail += drRes.failed;
      }
    }

    if (!DRY_RUN && forensics && NOCODB_FORENSICS_TABLE_ID) {
      const fRes = await nocoCreateForensicsRecord(forensics, facilityId);
      if (fRes.ok) {
        nocoStats.forensics++;
        log(`    Forensics record created: ${fRes.id}`);
      } else if (!fRes.skipped) {
        nocoStats.forensicsFail++;
      }
    }

    // ── Build JSON result object ──────────────────────────────────────────────
    const result = {
      facility_name: facName,
      city: city,
      state: "MA",
      snapshot_at: new Date().toISOString(),
      noco_facility_id: facilityId,
      listings: platformResults,
      deep_reviews: allDeepReviews.map((r) => ({ ...r, reviewer_name: maskName(r.reviewer_name) })),
      velocity,
      sentiment,
      forensics,
      occupancy_proxy: occupancyProxy,
    };

    results.push(result);

    // Comp-set JSON
    if (!SKIP_COMP_SETS && results.length > 0) {
      // We'll generate comp-sets after the full loop since we need all snapshots
    }

    log("  Waiting 3s before next facility...");
    await sleep(3000);
  }

  // ── Comp-Set Generation (post-loop) ───────────────────────────────────────
  if (!SKIP_COMP_SETS) {
    log("\n[Comp-Sets] Generating competitive set files...");
    for (const result of results) {
      const fac = facilities.find((f) => normalizeName(f.name) === normalizeName(result.facility_name));
      if (!fac) continue;

      const compSet = buildCompSet(fac, facilities, results);
      if (compSet) {
        const slug = normalizeName(fac.name);
        const compPath = path.join(COMP_SETS_DIR, `${slug}.json`);
        fs.writeFileSync(compPath, JSON.stringify(compSet, null, 2));
        compSetsGenerated++;
      }
    }
    log(`  Generated ${compSetsGenerated} comp-set files in ${COMP_SETS_DIR}`);
  }

  // ── Save Snapshot ─────────────────────────────────────────────────────────
  const snapshot = {
    generatedAt: new Date().toISOString(),
    script_version: "2026-08-23-v1",
    batchSize: BATCH_SIZE,
    dryRun: DRY_RUN,
    facilitiesProcessed: results.length,
    linkedFacilities: linkedCount,
    unmatchedFacilities: unmatchedCount,
    nocoStats,
    compSetsGenerated,
    data: results,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2));

  log(`\n✅ Done. Intelligence snapshot saved to: ${OUT_FILE}`);
  log(`   Facilities processed: ${results.length}`);
  log(`   Linked to NocoDB: ${linkedCount}`);
  log(`   Unmatched: ${unmatchedCount}`);
  log(`   NocoDB listings created: ${nocoStats.listings}`);
  log(`   Deep reviews created: ${nocoStats.deepReviews}`);
  log(`   Forensics records created: ${nocoStats.forensics}`);
  log(`   Comp-sets generated: ${compSetsGenerated}`);
}

function maskName(name) {
  if (!name) return "Anonymous";
  if (name.length <= 2) return name;
  return name[0] + "***" + name[name.length - 1];
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
