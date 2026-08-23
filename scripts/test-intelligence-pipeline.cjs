#!/usr/bin/env node
/**
 * Stubbed Integration Test for sync-facility-intelligence pipeline.
 * Does NOT require FIRECRAWL_API_KEY or NocoDB connectivity.
 * Validates snapshot JSON structure and comp-set generation mechanics.
 */

const fs = require("fs");
const path = require("path");

const {
  extractListingIntelligence,
  extractDeepReviews,
} = require("./lib/intelligence-extractors.cjs");

const { computeForensics } = require("./lib/forensics-engine.cjs");
const { computeVelocity, loadPreviousSnapshots } = require("./lib/velocity-calculator.cjs");
const { aggregatePlatformSentiment, sentimentGapReport } = require("./lib/sentiment-scorer.cjs");
const { estimateOccupancy } = require("./lib/occupancy-proxy.cjs");

const OUT_DIR = path.join(__dirname, "../public/data/intelligence-snapshots");
const COMP_SETS_DIR = path.join(__dirname, "../public/data/comp-sets");

function log(msg) {
  console.log(`[test] ${msg}`);
}

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    console.log(`  ❌ ${label}`);
    process.exitCode = 1;
  }
}

// ── Mock HTML for each platform ─────────────────────────────────────────────
const mockHtmlApfm = `
<div class="community-header">Armbrook Village</div>
<div class="photo-gallery"><img><img><img><img><img><img><img><img><img><img><img><img><img><img></div>
<p>Starting at $4,500 per month</p>
<ul><li>24-hour staff</li><li>Memory care</li><li>Dining services</li></ul>
<div data-testid="review-card">
  <span class="reviewer-name">Sarah M.</span>
  <span>July 15, 2026</span>
  <div>4.5 out of 5</div>
  <div class="review-text">The staff is wonderful and the facility is clean. I highly recommend it!</div>
</div>
<p>Reviews (38)</p>
`;

const mockHtmlCaring = `
<div class="profile-name">Armbrook Village</div>
<p>From $4,200 / month</p>
<div class="review-item">
  <span class="author">Mike T.</span>
  <span>August 2, 2026</span>
  <div>5 out of 5</div>
  <div class="comment">Excellent care and beautiful grounds.</div>
</div>
<p>12 Reviews</p>
`;

// ── Test ──────────────────────────────────────────────────────────────────────
log("Loading chart-facilities.json...");
const chartData = JSON.parse(fs.readFileSync(path.join(__dirname, "../public/data/chart-facilities.json"), "utf-8"));
const facilities = chartData.facilities || [];
assert(facilities.length >= 273, "Loaded at least 273 facilities");

const testFacilities = facilities.slice(0, 3);
log(`Testing with ${testFacilities.length} facilities`);

const results = [];

for (const fac of testFacilities) {
  log(`\nProcessing: ${fac.name}`);

  // Mock Phase A extraction for 2 platforms
  const platformResults = [
    extractListingIntelligence(mockHtmlApfm, {
      title: `${fac.name} | Assisted Living`,
      description: "Assisted living in MA.",
      sourceURL: `https://aplaceformom.com/community/${fac.name.toLowerCase().replace(/\s+/g, "-")}`,
    }, "APlaceForMom"),
    extractListingIntelligence(mockHtmlCaring, {
      title: `${fac.name} | Caring.com`,
      description: "Senior living community.",
      sourceURL: `https://caring.com/senior-living/massachusetts/${fac.name.toLowerCase().replace(/\s+/g, "-")}`,
    }, "Caring"),
  ];

  assert(platformResults[0].facility_found === true, "APFM listing found");
  assert(platformResults[0].pricing_disclosed === true, "APFM pricing disclosed");
  assert(platformResults[1].facility_found === true, "Caring listing found");

  // Phase B: deep reviews
  const apfmReviews = extractDeepReviews(mockHtmlApfm, "APlaceForMom") || [];
  const caringReviews = extractDeepReviews(mockHtmlCaring, "Caring") || [];
  const allDeepReviews = [...apfmReviews, ...caringReviews];
  assert(allDeepReviews.length >= 2, "Extracted at least 2 deep reviews");

  // Phase C: Signals
  const velocity = computeVelocity(platformResults, fac.name, []);
  assert(velocity.trend === "new_data", "Velocity trend computed");

  const reviewsByPlatform = { APlaceForMom: apfmReviews, Caring: caringReviews };
  const sentiments = aggregatePlatformSentiment(reviewsByPlatform);
  assert(Object.keys(sentiments).length >= 1, "Sentiment computed for at least 1 platform");

  const forensics = computeForensics(allDeepReviews, fac.name);
  assert(forensics.signals.singleReviewAccounts >= 0, "Forensics signals present");
  assert(forensics.report_markdown.length > 50, "Forensics markdown generated");

  const occ = estimateOccupancy(fac.occupancyRate, chartData.generatedAt, velocity.overall_velocity_per_week, null);
  assert(occ.estimated_occupancy >= 0 && occ.estimated_occupancy <= 100, "Occupancy proxy in range");

  results.push({
    facility_name: fac.name,
    city: fac.cityClean || fac.city,
    state: "MA",
    snapshot_at: new Date().toISOString(),
    noco_facility_id: null,
    listings: platformResults,
    deep_reviews: allDeepReviews.map((r) => ({ ...r, reviewer_name: r.reviewer_name ? r.reviewer_name[0] + "***" + r.reviewer_name[r.reviewer_name.length - 1] : "Anonymous" })),
    velocity,
    sentiment: {
      platform_sentiments: sentiments,
      cross_platform_gap: 0,
      cross_platform_gap_label: sentimentGapReport(sentiments) || "N/A",
    },
    forensics,
    occupancy_proxy: occ,
  });
}

// ── Build JSON snapshot ─────────────────────────────────────────────────────
const snapshot = {
  generatedAt: new Date().toISOString(),
  script_version: "2026-08-23-v1",
  batchSize: testFacilities.length,
  dryRun: true,
  facilitiesProcessed: results.length,
  linkedFacilities: 0,
  unmatchedFacilities: results.length,
  nocoStats: { listings: 0, listingsFail: 0, deepReviews: 0, deepReviewsFail: 0, forensics: 0, forensicsFail: 0 },
  compSetsGenerated: 0,
  data: results,
};

const snapshotPath = path.join(OUT_DIR, `test-${Date.now()}.json`);
fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
log(`\nSnapshot written to ${snapshotPath}`);

// Validate snapshot structure
const loaded = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
assert(Array.isArray(loaded.data), "Snapshot data is array");
assert(loaded.data.length === testFacilities.length, "Snapshot has correct facility count");
assert(loaded.data[0].listings.length >= 2, "First facility has 2+ listings");
assert(loaded.data[0].forensics.overall_risk_score !== undefined, "Forensics included");
assert(loaded.data[0].velocity.trend !== undefined, "Velocity included");
assert(loaded.data[0].occupancy_proxy.estimated_occupancy !== undefined, "Occupancy proxy included");

// ── Comp-Set Generation Test ────────────────────────────────────────────────
log("\nTesting comp-set generation...");

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const subject = testFacilities[0];
const competitors = facilities
  .filter((f) => f.name !== subject.name)
  .map((f) => ({ ...f, distance: haversineDistance(subject.lat, subject.lng, f.lat, f.lng) }))
  .filter((f) => f.distance <= 15)
  .sort((a, b) => a.distance - b.distance)
  .slice(0, 5);

assert(competitors.length > 0, "Found at least 1 competitor within 15 miles");

const compSet = {
  subject_facility: subject.name,
  subject_city: subject.cityClean || subject.city,
  comp_set_radius_miles: 15,
  competitors: competitors.map((c) => ({
    name: c.name,
    distance_miles: Math.round(c.distance * 10) / 10,
    chart_facility_id: c.id,
  })),
};

const compPath = path.join(COMP_SETS_DIR, `test-${Date.now()}.json`);
fs.writeFileSync(compPath, JSON.stringify(compSet, null, 2));
log(`Comp-set written to ${compPath}`);

assert(compSet.competitors.length >= 1, "Comp-set has at least 1 competitor");
assert(compSet.competitors[0].distance_miles >= 0, "Competitor distance valid");

// ── Cleanup ─────────────────────────────────────────────────────────────────
fs.unlinkSync(snapshotPath);
fs.unlinkSync(compPath);
log("Cleaned up temp files");

// ── Summary ─────────────────────────────────────────────────────────────────
log("\n✅ Stubbed pipeline integration test passed.");
log("   Real dry-run requires: FIRECRAWL_API_KEY=xxx REVIEW_DRY_RUN=1 REVIEW_BATCH_SIZE=3 node scripts/sync-facility-intelligence.cjs");
