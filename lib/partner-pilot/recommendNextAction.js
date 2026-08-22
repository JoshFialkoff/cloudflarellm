/**
 * recommendNextAction.js
 *
 * Analyzes a positive partner reply string and recommends the next
 * human action — both a concise label and a short rationale.
 */

const KEYWORD_RULES = [
  {
    keywords: ["call", "schedule", "book", "meeting", "zoom", "talk", "conversation", "chat"],
    action: "Schedule kickoff call",
    rationale: "Partner explicitly invited scheduling. Move fast to capitalize momentum.",
  },
  {
    keywords: ["email", "send", "info", "deck", "proposal", "materials", "one-pager", "packet", "overview"],
    action: "Send partnership one-pager + email sequence",
    rationale: "Partner asked for written materials. Send co-branded one-pager and follow-up sequence.",
  },
  {
    keywords: ["price", "cost", "fee", "revenue", "commission", "economics", "payout", "money", "paid"],
    action: "Send transparent economics memo + schedule pricing call",
    rationale: "Partner is probing economics. Send the counsel-reviewed economics overview and offer a pricing call.",
  },
  {
    keywords: ["legal", "contract", "terms", "agreement", "nda", "review", "compliance", "counsel"],
    action: "Share pilot agreement + loop in legal",
    rationale: "Partner is ready for formal engagement. Send pilot agreement draft and schedule legal review call.",
  },
  {
    keywords: ["demo", "walkthrough", "see", "product", "platform", "how it works"],
    action: "Book demo / walkthrough call",
    rationale: "Partner wants to see the product. Prepare co-branded demo environment and schedule 30-min walkthrough.",
  },
  {
    keywords: ["forwarded", "connect", "introduce", "right person", "team", "colleague"],
    action: "Request intro to decision-maker",
    rationale: "Reply is from a gateway contact. Ask for a warm intro to the partnerships / BD lead.",
  },
];

const DEFAULT_ACTION = {
  action: "Follow up within 24 hours",
  rationale: "Positive but vague reply. Reply with specific ask and a scheduling link.",
};

function scoreReply(reply) {
  const lower = (reply || "").toLowerCase();
  let best = { ...DEFAULT_ACTION, score: 0 };

  for (const rule of KEYWORD_RULES) {
    const hits = rule.keywords.filter((k) => lower.includes(k)).length;
    if (hits > best.score) {
      best = { action: rule.action, rationale: rule.rationale, score: hits };
    }
  }
  return best;
}

function recommendNextAction(reply) {
  const scored = scoreReply(reply);
  return {
    action: scored.action,
    rationale: scored.rationale,
  };
}

module.exports = { recommendNextAction };
