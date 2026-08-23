/**
 * Forensics Engine — Spam / Authenticity Signal Detection
 * Version: 2026-08-23-v1
 *
 * Rule-based detection (no ML model) for:
 *   - Single-review accounts
 *   - Burst clustering (3+ reviews within N days)
 *   - Cross-platform duplicate texts
 *   - Template language repetition
 *   - Rating distribution skew
 *   - Employee reviewer flags
 */

const crypto = require("crypto");

// ── Public Interface ──────────────────────────────────────────────────────────
function computeForensics(reviews, facilityName) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return emptyReport(facilityName);
  }

  const signals = {
    singleReviewAccounts: countSingleReviewAccounts(reviews),
    burstClusteringEvents: detectBurstClustering(reviews, 7, 3),
    crossPlatformDuplicates: detectCrossPlatformDuplicates(reviews, 0.85),
    templateLanguageFlags: detectTemplateLanguage(reviews, 4, 3),
    ratingDistributionSkew: computeRatingSkew(reviews),
    employeeReviewerFlags: detectEmployeeReviewers(reviews),
    suspiciousTimingFlags: detectSuspiciousTiming(reviews),
    extremeRatingFlags: detectExtremeRatings(reviews),
  };

  const flagged = buildFlaggedReviews(reviews, signals);
  const riskScore = computeWeightedRisk(signals, reviews.length);
  const recommendations = generateRecommendations(signals, reviews.length);

  return {
    facility_name: facilityName,
    computed_at: new Date().toISOString(),
    total_reviews_analyzed: reviews.length,
    overall_risk_score: riskScore,
    risk_level: riskLevel(riskScore),
    signals,
    flagged_reviews: flagged,
    recommendations,
    report_markdown: generateMarkdownReport(facilityName, signals, flagged, riskScore, recommendations),
    model_version: "forensics-v1-2026-08-23",
  };
}

// ── Signal Detection Functions ──────────────────────────────────────────────
function countSingleReviewAccounts(reviews) {
  let count = 0;
  for (const r of reviews) {
    const total = r.reviewer_total_reviews;
    if (total !== null && total !== undefined && total === 1) {
      count++;
    }
    // Also flag if name is very generic and we couldn't find total reviews
    if ((total === null || total === undefined) && isGenericName(r.reviewer_name)) {
      // Not counted as single-review since unknown, but noted elsewhere
    }
  }
  return count;
}

function detectBurstClustering(reviews, windowDays = 7, threshold = 3) {
  const parsedDates = reviews
    .map((r) => parseDate(r.review_date))
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (parsedDates.length < threshold) return 0;

  let events = 0;
  let i = 0;
  while (i < parsedDates.length) {
    let j = i + 1;
    while (
      j < parsedDates.length &&
      (parsedDates[j] - parsedDates[i]) / (1000 * 60 * 60 * 24) <= windowDays
    ) {
      j++;
    }
    const countInWindow = j - i;
    if (countInWindow >= threshold) {
      events++;
    }
    i++;
  }

  return events;
}

function detectCrossPlatformDuplicates(reviews, similarityThreshold = 0.85) {
  const dupPairs = [];
  const texts = reviews.map((r) => ({
    id: r._full_text_hash || hashText(r.review_text),
    text: cleanTextForComparison(r.review_text),
    platform: r.platform,
    reviewer: r.reviewer_name,
  }));

  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (texts[i].platform === texts[j].platform) continue;
      const sim = jaccardSimilarity(texts[i].text, texts[j].text);
      if (sim >= similarityThreshold) {
        dupPairs.push({
          reviewA: { reviewer: texts[i].reviewer, platform: texts[i].platform },
          reviewB: { reviewer: texts[j].reviewer, platform: texts[j].platform },
          similarity: Math.round(sim * 100) / 100,
        });
      }
    }
  }

  return dupPairs.length;
}

function detectTemplateLanguage(reviews, ngramSize = 4, minFrequency = 3) {
  const ngramCounts = {};
  const ngramReviewers = {};

  for (const r of reviews) {
    const words = cleanTextForComparison(r.review_text).split(/\s+/).filter(Boolean);
    if (words.length < ngramSize) continue;

    const seenThisReview = new Set();
    for (let i = 0; i <= words.length - ngramSize; i++) {
      const gram = words.slice(i, i + ngramSize).join(" ");
      if (seenThisReview.has(gram)) continue;
      seenThisReview.add(gram);

      ngramCounts[gram] = (ngramCounts[gram] || 0) + 1;
      if (!ngramReviewers[gram]) ngramReviewers[gram] = new Set();
      ngramReviewers[gram].add(r.reviewer_name || r._full_text_hash || "anon");
    }
  }

  let flags = 0;
  for (const [gram, count] of Object.entries(ngramCounts)) {
    const distinctReviewers = (ngramReviewers[gram] || new Set()).size;
    if (count >= minFrequency && distinctReviewers >= minFrequency) {
      flags++;
    }
  }

  return flags;
}

function computeRatingSkew(reviews) {
  const ratings = reviews.map((r) => r.rating).filter((r) => r !== null && r !== undefined);
  if (ratings.length < 5) return null;

  // Chi-square against uniform distribution (1–5 stars)
  // But we expect more 4–5 for legitimate senior living, so flag extreme uniform or extreme skew
  const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) {
    const rounded = Math.round(r);
    if (buckets[rounded] !== undefined) buckets[rounded]++;
  }

  const total = ratings.length;
  const expected = total / 5;
  let chiSquare = 0;
  for (const count of Object.values(buckets)) {
    chiSquare += Math.pow(count - expected, 2) / expected;
  }

  // Normalize: 0 = perfectly uniform, higher = more skewed
  // For 5 categories, chi-square > 9.49 is p<0.05
  return Math.round((chiSquare / total) * 100) / 100;
}

function detectEmployeeReviewers(reviews) {
  let flags = 0;
  const employeePatterns = [
    /I work here/i,
    /I am an employee/i,
    /as a staff member/i,
    /working at/i,
    /I was hired/i,
    /my job here/i,
    /facility is great.*I work/i,
    /proud to work/i,
  ];

  for (const r of reviews) {
    const text = (r.review_text || "").toLowerCase();
    for (const p of employeePatterns) {
      if (p.test(r.review_text || "")) {
        flags++;
        break;
      }
    }
  }

  return flags;
}

function detectSuspiciousTiming(reviews) {
  // Reviews posted at unusual hours or in rapid succession by different accounts
  // Without exact timestamps, we approximate via date-only clustering
  const dateGroups = {};
  for (const r of reviews) {
    const d = parseDate(r.review_date);
    if (!d) continue;
    const key = d.toISOString().slice(0, 10);
    dateGroups[key] = (dateGroups[key] || 0) + 1;
  }

  let suspicious = 0;
  for (const count of Object.values(dateGroups)) {
    if (count >= 4) suspicious++;
  }
  return suspicious;
}

function detectExtremeRatings(reviews) {
  const ratings = reviews.map((r) => r.rating).filter((r) => r !== null && r !== undefined);
  if (ratings.length < 5) return 0;

  const all5or1 = ratings.filter((r) => r === 5 || r === 1).length;
  return Math.round((all5or1 / ratings.length) * 100);
}

// ── Risk Scoring ────────────────────────────────────────────────────────────
function computeWeightedRisk(signals, totalReviews) {
  if (totalReviews === 0) return 0;

  const weights = {
    singleReviewAccounts: 8,
    burstClusteringEvents: 12,
    crossPlatformDuplicates: 15,
    templateLanguageFlags: 10,
    ratingDistributionSkew: 6,
    employeeReviewerFlags: 10,
    suspiciousTimingFlags: 10,
    extremeRatingFlags: 5,
  };

  let rawScore = 0;
  let maxPossible = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const val = signals[key];
    maxPossible += weight;
    if (typeof val === "number") {
      if (key === "extremeRatingFlags") {
        // Percentage-based 0-100
        rawScore += (val / 100) * weight;
      } else if (key === "ratingDistributionSkew") {
        // Normalized score; >0.5 is suspicious
        rawScore += Math.min((val || 0) / 0.5, 1) * weight;
      } else {
        // Count-based, cap at reasonable max
        const cap = key === "singleReviewAccounts" ? Math.min(totalReviews, 10) : 5;
        rawScore += Math.min(val, cap) / cap * weight;
      }
    }
  }

  const normalized = Math.round((rawScore / maxPossible) * 100);
  return Math.min(100, Math.max(0, normalized));
}

function riskLevel(score) {
  if (score < 20) return "LOW";
  if (score < 40) return "MEDIUM";
  if (score < 60) return "HIGH";
  return "CRITICAL";
}

// ── Flagged Review Builder ──────────────────────────────────────────────────
function buildFlaggedReviews(reviews, signals) {
  const flagged = [];

  for (const r of reviews) {
    const flags = [];

    if (r.reviewer_total_reviews === 1) flags.push("single_review_account");
    if (r.is_owner_response) flags.push("owner_response");

    const text = (r.review_text || "").toLowerCase();
    const employeePatterns = [
      /I work here/i,
      /I am an employee/i,
      /as a staff member/i,
    ];
    for (const p of employeePatterns) {
      if (p.test(r.review_text || "")) {
        flags.push("possible_employee_review");
        break;
      }
    }

    if (r.rating === 1 || r.rating === 5) flags.push("extreme_rating");
    if (text.length < 50) flags.push("very_short_review");

    if (flags.length > 0) {
      flagged.push({
        reviewer_name: maskName(r.reviewer_name),
        platform: r.platform,
        flags,
        confidence: flags.length >= 2 ? "high" : "medium",
        review_date: r.review_date,
        rating: r.rating,
      });
    }
  }

  return flagged;
}

// ── Recommendations ───────────────────────────────────────────────────────────
function generateRecommendations(signals, totalReviews) {
  const recs = [];

  if (signals.singleReviewAccounts > 0) {
    recs.push(
      `${signals.singleReviewAccounts} reviewer(s) have only posted one review total — monitor but not alarming if scattered over time.`
    );
  }

  if (signals.burstClusteringEvents > 0) {
    recs.push(
      `${signals.burstClusteringEvents} burst cluster(s) detected (3+ reviews within 7 days). This may indicate a coordinated campaign or event response.`
    );
  }

  if (signals.crossPlatformDuplicates > 0) {
    recs.push(
      `${signals.crossPlatformDuplicates} cross-platform duplicate text pair(s) found. Check if reviewers cross-posted legitimately or if content was solicited.`
    );
  }

  if (signals.templateLanguageFlags > 0) {
    recs.push(
      `${signals.templateLanguageFlags} template-like phrase(s) detected across 3+ distinct reviewers. May indicate a solicitation campaign.`
    );
  }

  if (signals.employeeReviewerFlags > 0) {
    recs.push(
      `${signals.employeeReviewerFlags} review(s) contain language suggesting the reviewer is or was an employee. Consider internal review policy.`
    );
  }

  if (signals.suspiciousTimingFlags > 0) {
    recs.push(
      `${signals.suspiciousTimingFlags} day(s) had 4+ reviews posted. Review timing distribution warrants closer inspection.`
    );
  }

  if (signals.extremeRatingFlags > 80) {
    recs.push(
      `${signals.extremeRatingFlags}% of reviews are exclusively 1- or 5-star. This extreme polarization can indicate review manipulation or selection bias.`
    );
  }

  if (recs.length === 0) {
    recs.push("No significant authenticity risks detected. Continue routine monitoring.");
  }

  return recs;
}

// ── Markdown Report ───────────────────────────────────────────────────────────
function generateMarkdownReport(name, signals, flagged, score, recs) {
  const lines = [
    `# Facility Forensics Report: ${name}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Overall Risk Score:** ${score}/100 (${riskLevel(score)})`,
    "", "## Signal Summary", "",
    `| Signal | Value |`,
    `|---|---|`,
    `| Single-review accounts | ${signals.singleReviewAccounts} |`,
    `| Burst clustering events | ${signals.burstClusteringEvents} |`,
    `| Cross-platform duplicates | ${signals.crossPlatformDuplicates} |`,
    `| Template language flags | ${signals.templateLanguageFlags} |`,
    `| Rating distribution skew | ${signals.ratingDistributionSkew ?? "N/A"} |`,
    `| Employee reviewer flags | ${signals.employeeReviewerFlags} |`,
    `| Suspicious timing flags | ${signals.suspiciousTimingFlags} |`,
    `| Extreme rating % | ${signals.extremeRatingFlags}% |`,
    "", "## Recommendations", "",
  ];

  for (const r of recs) {
    lines.push(`- ${r}`);
  }

  if (flagged.length > 0) {
    lines.push("", "## Flagged Reviews", "");
    for (const f of flagged.slice(0, 20)) {
      lines.push(
        `- **${f.reviewer_name}** (${f.platform}, ${f.rating}★) — ${f.flags.join(", ")} [confidence: ${f.confidence}]`
      );
    }
  }

  return lines.join("\n");
}

function emptyReport(facilityName) {
  return {
    facility_name: facilityName,
    computed_at: new Date().toISOString(),
    total_reviews_analyzed: 0,
    overall_risk_score: 0,
    risk_level: "LOW",
    signals: {
      singleReviewAccounts: 0,
      burstClusteringEvents: 0,
      crossPlatformDuplicates: 0,
      templateLanguageFlags: 0,
      ratingDistributionSkew: null,
      employeeReviewerFlags: 0,
      suspiciousTimingFlags: 0,
      extremeRatingFlags: 0,
    },
    flagged_reviews: [],
    recommendations: ["No reviews available for analysis."],
    report_markdown: generateMarkdownReport(facilityName, {}, [], 0, ["No reviews available for analysis."]),
    model_version: "forensics-v1-2026-08-23",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function cleanTextForComparison(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericName(name) {
  if (!name) return true;
  const generic = ["anonymous", "a google user", "a caring.com user", "user", "verified reviewer"];
  return generic.includes(name.toLowerCase());
}

function maskName(name) {
  if (!name) return "Anonymous";
  if (name.length <= 2) return name;
  return name[0] + "***" + name[name.length - 1];
}

function hashText(text) {
  return crypto.createHash("sha256").update(text || "").digest("hex").slice(0, 16);
}

// ── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  computeForensics,
  detectBurstClustering,
  detectTemplateLanguage,
  detectCrossPlatformDuplicates,
  computeWeightedRisk,
  generateMarkdownReport,
};
