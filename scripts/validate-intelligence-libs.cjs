#!/usr/bin/env node
/**
 * Quick validation script for intelligence library functions.
 * Does NOT require FIRECRAWL_API_KEY or NocoDB.
 */

const {
  extractListingIntelligence,
  extractDeepReviews,
  extractPriceFromText,
  normalizeAmenities,
} = require("./lib/intelligence-extractors.cjs");

const { computeForensics } = require("./lib/forensics-engine.cjs");
const { computeVelocity } = require("./lib/velocity-calculator.cjs");
const { aggregatePlatformSentiment, sentimentGapReport } = require("./lib/sentiment-scorer.cjs");
const { estimateOccupancy } = require("./lib/occupancy-proxy.cjs");

// ── Mock Data ─────────────────────────────────────────────────────────────────
const mockHtml = `
<html>
<head><title>Springfield Elder Care Village | Assisted Living | Springfield, MA</title></head>
<body>
<div class="gallery"><img src="a.jpg"><img src="b.jpg"><img src="c.jpg"></div>
<h1>Springfield Elder Care Village</h1>
<p>Starting at $4,500 per month</p>
<p>Amenities: 24-hour staff, memory care, dining services, medication management</p>
<div data-testid="review-card">
  <span class="reviewer-name">Jane D.</span>
  <span>July 15, 2026</span>
  <div>4.5 out of 5</div>
  <div class="review-text">The staff is wonderful and the facility is clean. I highly recommend it!</div>
</div>
<div data-testid="review-card">
  <span class="reviewer-name">John S.</span>
  <span>August 1, 2026</span>
  <div>5 out of 5</div>
  <div class="review-text">Amazing place. The care is excellent and my mother is very happy here.</div>
</div>
<p>Reviews (38)</p>
</body>
</html>
`;

const mockMeta = {
  title: "Springfield Elder Care Village | Assisted Living | Springfield, MA",
  description: "Assisted living and memory care community in Springfield, MA. 24-hour staff.",
  sourceURL: "https://www.aplaceformom.com/community/springfield-elder-care-village",
};

// ── Tests ─────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}

console.log("\n=== Intelligence Extractors ===\n");

const listing = extractListingIntelligence(mockHtml, mockMeta, "APlaceForMom");
assert(listing.platform === "APlaceForMom", "listing.platform correct");
assert(listing.facility_found === true, "facility_found detected");
assert(listing.photos_present === true, "photos_present detected");
assert(listing.photo_count_estimate >= 3, "photo_count_estimate >= 3");
assert(listing.pricing_disclosed === true, "pricing_disclosed detected");
assert(listing.price_parsed_low === 4500, "price_parsed_low = 4500");
assert(listing.amenities_list.includes("24-hour staff"), "amenities include 24-hour staff");
assert(listing.amenities_list.includes("memory care"), "amenities include memory care");
assert(listing.care_types_listed.includes("assisted living"), "care_types include assisted living");
assert(listing.total_reviews_on_page === 38, "total_reviews_on_page = 38");
assert(listing.extraction_confidence === "high", "extraction_confidence = high");

const deepReviews = extractDeepReviews(mockHtml, "APlaceForMom");
assert(Array.isArray(deepReviews), "deepReviews is array");
assert(deepReviews.length >= 2, "deepReviews has >= 2 items");
assert(deepReviews[0].reviewer_name === "Jane D.", "first reviewer name correct");
assert(deepReviews[0].rating === 4.5, "first rating correct");
assert(deepReviews[0].review_text.includes("wonderful"), "first review text correct");
assert(deepReviews[1].reviewer_name === "John S.", "second reviewer name correct");

const priceData = extractPriceFromText("Prices range from $3,200 - $5,100 per month");
assert(priceData.low === 3200 && priceData.high === 5100, "price range parsed");

const amenities = normalizeAmenities("Pet friendly community with Wi-Fi and a fitness center.");
assert(amenities.includes("pet friendly"), "pet friendly detected");
assert(amenities.includes("wi-fi"), "wi-fi detected");
assert(amenities.includes("fitness center"), "fitness center detected");

console.log("\n=== Sentiment Scorer ===\n");

const reviewsByPlatform = {
  APlaceForMom: deepReviews,
  Google: [
    ...deepReviews,
    { review_text: "Not great. The food was bad and staff seemed rude." },
  ],
};
const sentiments = aggregatePlatformSentiment(reviewsByPlatform);
assert(sentiments.APlaceForMom.count >= 1, "sentiment has review count");
assert(sentiments.APlaceForMom.average > 0, "sentiment average is positive");
assert(sentiments.APlaceForMom.label === "positive", "sentiment label = positive");

const gapReport = sentimentGapReport(sentiments);
assert(gapReport !== null, "gapReport produced with multiple platforms");

// Also test that single-platform returns null (correct behavior)
const singlePlatform = { Google: sentiments.APlaceForMom };
const singleGap = sentimentGapReport(singlePlatform);
assert(singleGap === null, "gapReport returns null for single platform");

console.log("\n=== Velocity Calculator ===\n");

const currentPlatforms = [
  { platform: "APlaceForMom", review_count: 40 },
  { platform: "Google", review_count: 12 },
];
const velocity = computeVelocity(currentPlatforms, "Springfield Elder Care Village", []);
assert(velocity.trend === "new_data", "velocity trend = new_data when no prior snapshot");
assert(velocity.overall_velocity_per_week === 0, "overall_velocity = 0 with no prior");

console.log("\n=== Forensics Engine ===\n");

// Build mock deep reviews with some signals
const mockDeepReviews = [
  ...deepReviews,
  {
    reviewer_name: "Alice One",
    review_date: "2026-08-02",
    rating: 5,
    review_text: "Amazing place. Excellent care. I highly recommend it!",
    is_owner_response: false,
    reviewer_total_reviews: 1,
    platform: "Google",
    _full_text_hash: "abc123",
  },
  {
    reviewer_name: "Bob Two",
    review_date: "2026-08-03",
    rating: 5,
    review_text: "Amazing place. Excellent care. I highly recommend it!",
    is_owner_response: false,
    reviewer_total_reviews: 1,
    platform: "Caring",
    _full_text_hash: "abc123",
  },
];

const forensics = computeForensics(mockDeepReviews, "Springfield Elder Care Village");
assert(forensics.total_reviews_analyzed === mockDeepReviews.length, "forensics count correct");
assert(forensics.overall_risk_score >= 0 && forensics.overall_risk_score <= 100, "risk score in range");
assert(Array.isArray(forensics.flagged_reviews), "flagged_reviews is array");
assert(forensics.signals.singleReviewAccounts >= 2, "singleReviewAccounts detected");
assert(forensics.signals.crossPlatformDuplicates >= 1, "crossPlatformDuplicates detected");
assert(forensics.signals.templateLanguageFlags >= 1, "templateLanguage detected");
assert(forensics.report_markdown.includes("Springfield Elder Care Village"), "markdown report generated");

console.log("\n=== Occupancy Proxy ===\n");

const occ = estimateOccupancy(85, "2026-08-01", 1.4, null);
assert(occ.foia_value === 85, "occ foia_value correct");
assert(occ.estimated_occupancy >= 80 && occ.estimated_occupancy <= 100, "occ estimated in range");
assert(occ.confidence !== "low", "occ confidence elevated when FOIA is fresh");

// Test fallback with no FOIA
const occ2 = estimateOccupancy(null, null, 0.1, null);
assert(occ2.estimated_occupancy <= 75, "occ fallback below average when quiet");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

process.exit(failed > 0 ? 1 : 0);
