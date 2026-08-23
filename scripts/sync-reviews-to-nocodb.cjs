#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED in favor of scripts/sync-facility-intelligence.cjs
 * Kept for backward compatibility. New intelligence pipelines should use
 * the expanded script which supports deep listing extraction, individual
 * review parsing, forensics, velocity, sentiment, and occupancy proxy modeling.
 *
 * This script still works for basic aggregate review count syncs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sync public review metadata from directory listings → NocoDB + local JSON
 *
 * Uses Firecrawl search + rawHtml scrape to discover facility pages on
 * Google, Yelp, Caring.com, APlaceForMom, and SeniorAdvisor.
 * Extracts structured review metadata (count, rating, velocity signals)
 * via JSON-LD parsing + regex fallback, and writes to:
 *   1. public/data/review-snapshots/<timestamp>.json   (local backup)
 *   2. NocoDB table: facility_reviews (default table ID m6iaq5juhovxdou)
 *
 * NocoDB Table Schema (v3 data API):
 *   facility_name      (LinkToAnotherRecord → mix4o0ymn0l2nhz)
 *   city               (SingleLineText)
 *   state              (SingleLineText)
 *   snapshot_at        (DateTime)
 *   platform_json        (LongText)
 *   total_review_count (Number)
 *   highest_rating     (Decimal)
 *   lowest_rating      (Decimal)
 *   platform_count     (Number)
 *   source_page_url    (SingleLineText)
 *
 * Environment Variables:
 *   NOCODB_API_TOKEN        - NocoDB auth token
 *   NOCODB_URL              - Default http://23.95.189.106:8080
 *   NOCODB_REVIEW_TABLE_ID  - Default "m6iaq5juhovxdou"
 *   NOCODB_FACILITIES_TABLE_ID - Default "mix4o0ymn0l2nhz"
 *   FIRECRAWL_API_KEY       - Firecrawl API key
 *   REVIEW_BATCH_SIZE       - Max facilities per run (default 10)
 *   REVIEW_DRY_RUN          - Set "1" to skip NocoDB writes
 *
 * Usage:
 *   FIRECRAWL_API_KEY=xxx NOCODB_API_TOKEN=xxx node scripts/sync-reviews-to-nocodb.cjs
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const https = require("https");
const http = require("http");

// ── Configuration ────────────────────────────────────────────────────────────
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN;
const NOCODB_URL = process.env.NOCODB_URL || "http://23.95.189.106:8080";
const NOCODB_BASE_ID = "pfeipqmy5ybhs71";
const NOCODB_TABLE_ID = process.env.NOCODB_REVIEW_TABLE_ID || "m6iaq5juhovxdou";
const NOCODB_FACILITIES_TABLE_ID = process.env.NOCODB_FACILITIES_TABLE_ID || "mix4o0ymn0l2nhz";
const BATCH_SIZE = parseInt(process.env.REVIEW_BATCH_SIZE || "10", 10);
const DRY_RUN = process.env.REVIEW_DRY_RUN === "1";

const FACILITIES_JSON = path.join(__dirname, "../public/data/chart-facilities.json");
const OUT_DIR = path.join(__dirname, "../public/data/review-snapshots");

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUT_FILE = path.join(OUT_DIR, `${timestamp}.json`);

// ── Helpers ─────────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[reviews] ${msg}`);
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

function firecrawlSearch(query) {
  const outPath = path.join(".firecrawl", "search-reviews-tmp.json");
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
    "--wait-for", "3000",
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

    const rawHtml = (data.rawHtml || data.html || "").slice(0, 8000);
    const meta = data.metadata || {};
    return { rawHtml, meta };
  } catch (e) {
    log(`Scrape exception for ${url}: ${e.message}`);
    return null;
  }
}

function firecrawlScrapeMarkdown(url) {
  const outPath = path.join(".firecrawl", "scrape-md-tmp.json");
  const args = [
    "scrape", url,
    "--format", "markdown",
    "--only-main-content",
    "--wait-for", "3000",
    "--json",
    "-o", outPath,
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
    const data = readJson(outPath);
    return (data.data?.markdown || data.markdown || "").slice(0, 6000);
  } catch (e) {
    log(`Markdown scrape exception for ${url}: ${e.message}`);
    return "";
  }
}

function stripHtmlTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractJsonLdRatings(html) {
  let reviewCount = null;
  let averageRating = null;

  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];

  for (const block of blocks) {
    try {
      const jsonStr = block
        .replace(/<script[^>]*>|<\/script>/gi, "")
        .trim()
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      const data = JSON.parse(jsonStr);
      const items = data["@graph"] || [data];

      for (const item of items) {
        const ar = item.aggregateRating;
        if (ar) {
          if (ar.reviewCount !== undefined) reviewCount = parseInt(ar.reviewCount, 10) || reviewCount;
          if (ar.ratingValue !== undefined) averageRating = parseFloat(ar.ratingValue) || averageRating;
          if (ar.ratingCount !== undefined && !reviewCount) reviewCount = parseInt(ar.ratingCount, 10);
        }
        if (item.mainEntity?.aggregateRating) {
          const mar = item.mainEntity.aggregateRating;
          if (mar.ratingValue !== undefined) averageRating = parseFloat(mar.ratingValue) || averageRating;
          if (mar.reviewCount !== undefined) reviewCount = parseInt(mar.reviewCount, 10) || reviewCount;
        }
      }
    } catch (e) {
      // Malformed JSON-LD, skip
    }
  }

  return { reviewCount, averageRating };
}

function extractReviewSignals(rawHtml, meta) {
  const plainText = stripHtmlTags(rawHtml);
  const fullText = [meta.title || "", meta.description || "", plainText].join(" ");

  const jsonLd = extractJsonLdRatings(rawHtml);
  let reviewCount = jsonLd.reviewCount;
  let averageRating = jsonLd.averageRating;

  if (!reviewCount) {
    const countPatterns = [
      /(\d+)\s+reviews?\b/i,
      /Read\s+(\d+)\s+reviews?/i,
      /Ratings?\s*\(\s*(\d+)\s*\)/i,
      /reviewCount["']?\s*[:=]\s*["']?(\d+)/i,
    ];
    for (const p of countPatterns) {
      const m = fullText.match(p);
      if (m) { reviewCount = parseInt(m[1], 10); break; }
    }
  }

  if (!averageRating) {
    const ratingPatterns = [
      /(\d\.\d)\s*\/\s*5\.0/,
      /(\d\.\d)\s*out of\s*5/,
      /(\d\.\d)\s*stars?/i,
      /Rated\s+(\d\.\d)/,
      /ratingValue["']?\s*[:=]\s*["']?(\d+\.\d)/i,
    ];
    for (const p of ratingPatterns) {
      const m = fullText.match(p);
      if (m) { averageRating = parseFloat(m[1]); break; }
    }
  }

  const platforms = [];
  const platformChecks = [
    { name: "Google", pattern: /\bGoogle\b/ },
    { name: "Yelp", pattern: /\bYelp\b/ },
    { name: "Facebook", pattern: /\bFacebook\b/ },
    { name: "SeniorAdvisor", pattern: /\bSeniorAdvisor\b/ },
    { name: "Caring", pattern: /\bCaring\.com\b/ },
    { name: "APlaceForMom", pattern: /\bA Place for Mom\b|\bAPlaceForMom\b/ },
  ];
  for (const pc of platformChecks) {
    if (pc.pattern.test(plainText)) platforms.push(pc.name);
  }

  const dateMatches = plainText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g) || [];
  const uniqueDates = [...new Set(dateMatches)].slice(0, 10);

  const reviewerNames = [];
  const reviewerPattern = /\b([A-Z][a-z]+\s[A-Z][a-z]+)\s*,?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/g;
  let rm;
  while ((rm = reviewerPattern.exec(plainText)) !== null) {
    reviewerNames.push(rm[1]);
  }

  let accountSignal = null;
  if (reviewerNames.length > 0 && platforms.length === 1 && platforms[0] === "Facebook") {
    accountSignal = "Reviews sourced from Facebook; may include employee or friend posts";
  }
  if (reviewCount && reviewCount > 0 && reviewerNames.length === 0) {
    accountSignal = "Review count visible but individual reviewer details not extracted";
  }

  const confidence = (jsonLd.averageRating || jsonLd.reviewCount)
    ? "high"
    : (reviewCount && averageRating)
      ? "medium"
      : (reviewCount || averageRating)
        ? "medium"
        : "low";

  return {
    review_count: reviewCount || null,
    average_rating: averageRating || null,
    detected_platforms: platforms,
    sample_review_dates: uniqueDates,
    sample_reviewer_count: reviewerNames.length,
    reviewer_account_signal: accountSignal,
    page_title: meta.title || null,
    page_description: meta.description || null,
    extraction_confidence: confidence,
    _jsonLd_extracted: !!(jsonLd.averageRating || jsonLd.reviewCount),
  };
}

async function nocoCreateReviewRecord(record, facilityId) {
  if (DRY_RUN || !NOCODB_API_TOKEN) return { skipped: true };

  const url = `${NOCODB_URL}/api/v3/data/${NOCODB_BASE_ID}/${NOCODB_TABLE_ID}/records`;

  const payload = {
    fields: {
      facility_name: facilityId ? [{ id: facilityId }] : [],
      city: record.city,
      state: record.state,
      snapshot_at: record.snapshot_at,
      platform_json: record.platform_json,
      total_review_count: record.total_review_count,
      highest_rating: record.highest_rating,
      lowest_rating: record.lowest_rating,
      platform_count: record.platform_count,
      source_page_url: record.source_page_url,
    },
  };

  const { status, body } = await httpRequest("POST", url, [payload], 2);
  if (status >= 200 && status < 300) {
    const parsed = JSON.parse(body);
    const createdId = parsed?.records?.[0]?.id;
    return { ok: true, id: createdId };
  }
  return { ok: false, status, body: body?.slice(0, 300) };
}

// ── Main Pipeline ────────────────────────────────────────────────────────────
async function main() {
  log("Starting review sync pipeline v3 (linked facility_name + JSON-LD + rawHtml)...");

  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY required");
  if (!DRY_RUN && !NOCODB_API_TOKEN) throw new Error("NOCODB_API_TOKEN required (or set REVIEW_DRY_RUN=1)");

  ensureDir(OUT_DIR);

  const chartData = readJson(FACILITIES_JSON);
  const facilities = chartData.facilities || [];
  log(`Loaded ${facilities.length} facilities from chart-facilities.json`);

  const facilityMap = await fetchFacilityMap();
  let linkedCount = 0;
  let unmatchedCount = 0;

  const batch = facilities.slice(0, BATCH_SIZE);
  log(`Processing batch of ${batch.length} facilities (BATCH_SIZE=${BATCH_SIZE})`);

  const results = [];
  let successCount = 0;
  let failCount = 0;

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

    const platforms = [
      { name: "APlaceForMom", query: `"${facName}" ${city} Massachusetts site:aplaceformom.com` },
      { name: "Caring", query: `"${facName}" ${city} Massachusetts site:caring.com` },
      { name: "SeniorAdvisor", query: `"${facName}" ${city} Massachusetts site:senioradvisor.com` },
      { name: "Yelp", query: `"${facName}" ${city} Massachusetts site:yelp.com` },
      { name: "Google", query: `"${facName}" ${city} Massachusetts reviews` },
    ];

    const platformResults = [];
    const seenUrls = new Set();

    for (const plat of platforms) {
      log(`  Searching ${plat.name}...`);
      const links = firecrawlSearch(plat.query);
      if (!links.length) {
        log(`    No results for ${plat.name}`);
        continue;
      }
      const topUrl = links[0].url;
      log(`    Found: ${topUrl}`);

      if (seenUrls.has(topUrl)) {
        log(`    Skipping duplicate URL`);
        continue;
      }
      seenUrls.add(topUrl);

      if (topUrl.includes("m.yelp.com/search")) {
        log(`    Skipping Yelp search result page`);
        continue;
      }

      const genericPatterns = [
        /best\s+assisted\s+living/i,
        /assisted\s+living\s+facilities\s+in/i,
        /top\s+\d+/i,
        /\d+\s+best\s+/i,
      ];
      const isGeneric = genericPatterns.some((p) => p.test(links[0].title || ""));
      if (isGeneric) {
        log(`    Skipping generic directory page: ${(links[0].title || "").slice(0, 60)}`);
        continue;
      }

      const pageData = firecrawlScrapeRawHtml(topUrl);
      if (!pageData) {
        log(`    RawHtml scrape returned no data; trying markdown fallback...`);
        const md = firecrawlScrapeMarkdown(topUrl);
        const countMatch = md.match(/(\d+)\s+reviews?/i);
        const ratingMatch = md.match(/([\d.]+)\s*out of\s*5|([\d.]+)\s*stars?/i);
        const count = countMatch ? parseInt(countMatch[1], 10) : null;
        const rating = ratingMatch ? parseFloat(ratingMatch[1] || ratingMatch[2]) : null;
        if (count || rating) {
          log(`    Markdown fallback: ${count} reviews, ${rating} stars`);
          platformResults.push({
            platform: plat.name,
            url: topUrl,
            review_count: count,
            average_rating: rating,
            extraction_confidence: "low",
            _source: "markdown_fallback",
          });
        } else {
          log(`    No review data extracted from ${plat.name}`);
        }
        continue;
      }

      const signals = extractReviewSignals(pageData.rawHtml, pageData.meta);
      log(`    Extracted: ${signals.review_count ?? "?"} reviews, ${signals.average_rating ?? "?"} stars (${signals.extraction_confidence})`);

      platformResults.push({
        platform: plat.name,
        url: topUrl,
        ...signals,
      });
    }

    const record = {
      facility_name: facName,
      city: city,
      state: "MA",
      snapshot_at: new Date().toISOString(),
      platforms: platformResults,
      total_review_count: platformResults.reduce((sum, p) => sum + (p.review_count || 0), 0),
      highest_rating: (() => {
        const vals = platformResults.map((p) => p.average_rating).filter(Boolean);
        return vals.length ? Math.max(...vals) : null;
      })(),
      lowest_rating: (() => {
        const vals = platformResults.map((p) => p.average_rating).filter(Boolean);
        return vals.length ? Math.min(...vals) : null;
      })(),
      platform_count: platformResults.length,
      source_page_url: platformResults[0]?.url || null,
    };

    results.push(record);

    if (!DRY_RUN) {
      const nocoPayload = {
        city: city,
        state: "MA",
        snapshot_at: record.snapshot_at,
        platform_json: JSON.stringify(platformResults),
        total_review_count: record.total_review_count,
        highest_rating: record.highest_rating,
        lowest_rating: record.lowest_rating,
        platform_count: record.platform_count,
        source_page_url: record.source_page_url,
      };
      const nocoRes = await nocoCreateReviewRecord(nocoPayload, facilityId);
      if (nocoRes.ok) {
        successCount++;
        log(`    NocoDB record created: ${nocoRes.id}`);
      } else if (nocoRes.skipped) {
        log(`    NocoDB write skipped (dry run or no token)`);
      } else {
        failCount++;
        log(`    NocoDB write failed: HTTP ${nocoRes.status} — ${nocoRes.body}`);
      }
      // Gentle pause between NocoDB writes to avoid network saturation
      if (i < batch.length - 1) await sleep(1000);
    }

    if (i < batch.length - 1) {
      log("  Waiting 3s before next facility...");
      await sleep(3000);
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    batchSize: BATCH_SIZE,
    dryRun: DRY_RUN,
    nocoTable: NOCODB_TABLE_ID,
    nocoFacilitiesTable: NOCODB_FACILITIES_TABLE_ID,
    facilitiesProcessed: results.length,
    linkedFacilities: linkedCount,
    unmatchedFacilities: unmatchedCount,
    nocoSuccesses: successCount,
    nocoFailed: failCount,
    data: results,
  }, null, 2));

  log(`\n✅ Done. Local snapshot saved to: ${OUT_FILE}`);
  log(`   Facilities processed: ${results.length}`);
  log(`   Linked to NocoDB: ${linkedCount}`);
  log(`   Unmatched: ${unmatchedCount}`);
  log(`   NocoDB writes success: ${successCount}, failed: ${failCount}`);
  log(`   Total platform records: ${results.reduce((s, r) => s + r.platforms.length, 0)}`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
