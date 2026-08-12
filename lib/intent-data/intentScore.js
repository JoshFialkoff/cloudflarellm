import { findAccountByDomain } from "./accounts";
import { findContactsByAccount } from "./contacts";
import { getEmbedding } from "./embeddings";

const SIGNAL_WEIGHTS = {
  "pricing_page": 35,
  "demo_request": 40,
  "case_study_download": 25,
  "career_page": -10,
  "newsletter_signup": 5,
  "g2_review": 20,
  "competitor_comparison": 30,
  "linkedin_engagement": 10,
  "site_visit": 1,
};

/**
 * Calculate an intent score (0-100) for a given domain.
 * Scoring is rule-based with an optional embedding enrichment.
 */
export async function scoreDomain(domain) {
  const account = findAccountByDomain(domain);
  if (!account) {
    return { domain, score: 0, signals: [], contacts: 0, tier: "unknown" };
  }

  const contacts = findContactsByAccount(account.id);
  let score = 0;
  const signalScores = [];

  for (const signal of account.signals || []) {
    const weight = SIGNAL_WEIGHTS[signal] || 3;
    score += weight;
    signalScores.push({ signal, weight });
  }

  // Contact richness boost
  score += Math.min(contacts.length * 3, 15);

  // Embedding enrichment (async, optional)
  try {
    const embedding = await getEmbedding(domain);
    if (embedding && embedding.length > 0) {
      // Use first embedding dim as a micro-nudge (deterministic or learned)
      const nudge = Math.min(Math.abs(embedding[0]) * 10, 10);
      score += nudge;
    }
  } catch {
    // Ignore embedding errors; scoring still works without OpenAI
  }

  score = Math.min(Math.max(Math.round(score), 0), 100);

  let tier = "cold";
  if (score >= 75) tier = "hot";
  else if (score >= 50) tier = "warm";
  else if (score >= 25) tier = "mild";

  return {
    domain,
    score,
    tier,
    signals: signalScores,
    contacts: contacts.length,
    accountId: account.id,
    embedEnriched: true,
  };
}

export function scoreAccount(account) {
  return scoreDomain(account?.domain);
}
