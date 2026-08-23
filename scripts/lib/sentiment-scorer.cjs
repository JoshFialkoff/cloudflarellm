/**
 * Sentiment Scorer — Rule-Based Text Sentiment Analysis
 * Version: 2026-08-23-v1
 *
 * No ML model dependency. Uses keyword lists + simple heuristics.
 */

// ── Word Lists ────────────────────────────────────────────────────────────────
const POSITIVE_WORDS = new Set([
  "excellent", "amazing", "loving", "great", "clean", "staff", "caring",
  "recommend", "happy", "safe", "wonderful", "fantastic", "outstanding",
  "superb", "perfect", "beautiful", "friendly", "professional", "attentive",
  "compassionate", "kind", "helpful", "responsive", "organized", "peaceful",
  "comfortable", "homelike", "warm", "nurturing", "dedicated", "knowledgeable",
  "skilled", "patient", "lovely", "impressed", "grateful", "thankful",
  "satisfied", "pleased", "delighted", "thrilled", "exceptional", "remarkable",
  "top-notch", "five-star", "highly", "best", "love", "loved", "loving",
  "family", "home", "recommend", "recommended", "recommending", " chose ",
  "chose", "choice", " gem ", "gem", "treasure", "blessing", "angel",
]);

const NEGATIVE_WORDS = new Set([
  "terrible", "awful", "dirty", "neglect", "bad", "rude", "unprofessional",
  "warning", "avoid", "sad", "horrible", "disgusting", "unacceptable",
  "poor", "inadequate", "negligent", "abusive", "uncaring", "cold",
  "impersonal", "disorganized", "chaotic", "unsafe", "hazard", "hazardous",
  "risky", "dangerous", "infection", "fall", "injury", "injured",
  "medication error", "understaffed", "short-staffed", "overworked",
  "complaint", "complained", "lawsuit", "violation", "fine", "citation",
  "unresponsive", "ignored", "dismissive", "hostile", "mean", "cruel",
  "deceptive", "misleading", "fraud", "scam", "overcharge", "expensive",
  "rip-off", "disappointed", "disappointing", "regret", "angry", "upset",
  "frustrated", "unhappy", "miserable", "suffering", "pain", "painful",
  "worst", "nightmare", "horror", "tragedy", "disaster", "never again",
  "would not recommend", "do not recommend", "can't recommend",
]);

const INTENSIFIERS = new Set([
  "very", "extremely", "incredibly", "absolutely", "totally", "completely",
  "utterly", "highly", "so", "really", "truly", "especially", "remarkably",
]);

const NEGATORS = new Set([
  "not", "no", "never", "none", "nothing", "nobody", "neither", "nowhere",
  "hardly", "barely", "scarcely", "rarely", "seldom", "doesn't", "isn't",
  "wasn't", "shouldn't", "wouldn't", "couldn't", "can't", "don't", "didn't",
  "won't", "without", "lack", "lacking", "missing", "absent",
]);

// ── Core Scoring ──────────────────────────────────────────────────────────────
function scoreText(text) {
  if (!text || text.length < 5) return 0;

  const words = text.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  let score = 0;
  const windowSize = 3;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isIntensifier = INTENSIFIERS.has(word);
    const sentimentWord = isSentimentWord(word);

    if (!sentimentWord) continue;

    let multiplier = 1.0;

    // Check preceding words for negation / intensification
    for (let j = Math.max(0, i - windowSize); j < i; j++) {
      if (NEGATORS.has(words[j])) multiplier *= -1;
      if (INTENSIFIERS.has(words[j])) multiplier *= 1.5;
    }

    const baseScore = sentimentWord === "positive" ? 1 : -1;
    score += baseScore * multiplier;
  }

  // Normalize to -1 … +1
  return Math.max(-1, Math.min(1, score / Math.max(words.length * 0.05, 3)));
}

function isSentimentWord(word) {
  if (POSITIVE_WORDS.has(word)) return "positive";
  if (NEGATIVE_WORDS.has(word)) return "negative";
  return null;
}

// ── Aggregation ───────────────────────────────────────────────────────────────
function aggregatePlatformSentiment(reviewsByPlatform) {
  const result = {};

  for (const [platform, reviews] of Object.entries(reviewsByPlatform)) {
    if (!Array.isArray(reviews) || reviews.length === 0) {
      result[platform] = { average: 0, count: 0, label: "insufficient_data" };
      continue;
    }

    const scores = reviews.map((r) => scoreText(r.review_text)).filter((s) => s !== 0);
    if (scores.length === 0) {
      result[platform] = { average: 0, count: reviews.length, label: "neutral" };
      continue;
    }

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    let label = "neutral";
    if (avg > 0.15) label = "positive";
    if (avg < -0.15) label = "negative";
    if (avg >= -0.05 && avg <= 0.05) label = "mixed";

    result[platform] = {
      average: Math.round(avg * 1000) / 1000,
      count: scores.length,
      label,
    };
  }

  return result;
}

function sentimentGapReport(platformSentiments) {
  const platforms = Object.entries(platformSentiments).filter(([, v]) => v.count > 0);
  if (platforms.length < 2) return null;

  platforms.sort((a, b) => b[1].average - a[1].average);
  const best = platforms[0];
  const worst = platforms[platforms.length - 1];
  const gap = best[1].average - worst[1].average;

  if (gap < 0.1) {
    return `Sentiment is broadly consistent across platforms (max gap ${Math.round(gap * 100) / 100}).`;
  }

  return `${worst[0]} sentiment is ${Math.round(gap * 1000) / 1000} points lower than ${best[0]}. Investigate ${worst[0]} review quality or response practices.`;
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  scoreText,
  aggregatePlatformSentiment,
  sentimentGapReport,
};
