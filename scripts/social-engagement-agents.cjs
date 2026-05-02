#!/usr/bin/env node
/**
 * Converts the "Reddit Analyzer" Dify workflow into executable multi-agent logic.
 *
 * Agents:
 * 1) discoveryAgent: gather candidate posts from Reddit + Facebook (via Firecrawl search)
 * 2) enrichmentAgent: normalize and classify intent/risk/receptivity
 * 3) rankingAgent: score opportunities for engagement priority
 * 4) replyAgent: generate draft replies + CTA variants + guardrails
 *
 * Env:
 * - FIRECRAWL_API_KEY (required)
 * Optional:
 * - OPENAI_API_KEY (if set, improves post analysis/replies; otherwise heuristic mode)
 * - SOCIAL_LOOKBACK_DAYS (default 180)
 * - SOCIAL_MAX_LEADS (default 40)
 */
const fs = require("fs");
const path = require("path");

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const LOOKBACK_DAYS = parseInt(process.env.SOCIAL_LOOKBACK_DAYS || "183", 10);
const MAX_LEADS = parseInt(process.env.SOCIAL_MAX_LEADS || "40", 10);
const TRACKING_LINK =
  process.env.SOCIAL_TRACKING_LINK || "https://aiassistliving.com/blog/";

const firecrawlBase = "https://api.firecrawl.dev/v1";
const openaiBase = "https://api.openai.com/v1/chat/completions";

if (!FIRECRAWL_API_KEY) {
  // eslint-disable-next-line no-console
  console.error("Missing FIRECRAWL_API_KEY");
  process.exit(1);
}

const discoveryUrls = [
  "https://www.reddit.com/r/AssistedLiving/",
  "https://www.reddit.com/r/massachusetts/",
  "https://www.reddit.com/r/boston/",
  "https://www.reddit.com/r/aging/",
  "https://www.facebook.com/groups/",
  "https://www.facebook.com/search/posts/",
];

const discoveryPrompt = [
  "Find public Reddit and Facebook posts from the last 6 months related to assisted living, memory care,",
  "elder care coordination, and senior care in Massachusetts.",
  "Prioritize luxury / high-end / premium / concierge / expensive contexts and intent to choose a provider.",
  "For each result return: platform, post_url, post_date, poster_profile_url, post_content, location_context,",
  "intent_signals, community_promo_attitude, estimated_budget, link_receptivity_score (1-10), post_type.",
  "Only include publicly accessible posts. Exclude private groups or inaccessible pages.",
].join(" ");

const ASSISTED_LIVING_TERMS = [
  "assisted living",
  "memory care",
  "elder care",
  "senior care",
  "alzheim",
  "dementia care",
  "caregiver",
  "nursing home",
];

const NON_RELEVANT_TERMS = [
  "real estate",
  "realtor",
  "broker",
  "property investment",
  "house flip",
  "mortgage",
  "landlord",
  "fatfire",
  "fire movement",
];

const MASSACHUSETTS_TERMS = [
  "massachusetts",
  "boston",
  "ma ",
  " cambridge",
  "worcester",
  "springfield",
  "quincy",
  "lowell",
  "newton",
  "somerville",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRedditMetadata(postUrl) {
  const clean = normText(postUrl).replace(/\/+$/, "");
  if (!clean.includes("reddit.com")) return null;
  const jsonUrl = `${clean}.json`;
  const res = await fetch(jsonUrl, {
    headers: {
      "User-Agent": "aiassistliving-social-agent/1.0",
    },
  });
  if (!res.ok) return null;
  const payload = await res.json();
  const post = payload?.[0]?.data?.children?.[0]?.data;
  if (!post) return null;
  const createdUtc = Number(post.created_utc || 0);
  const postDate = createdUtc
    ? new Date(createdUtc * 1000).toISOString()
    : "";
  const title = normText(post.title);
  const selfText = normText(post.selftext);
  const subreddit = normText(post.subreddit_name_prefixed || post.subreddit);
  return {
    post_date: postDate,
    post_content: [title, selfText].filter(Boolean).join(" - "),
    location_context: subreddit ? `${subreddit} Massachusetts` : "Massachusetts",
  };
}

async function firecrawlSearch(query) {
  const response = await fetch(`${firecrawlBase}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "x-api-key": FIRECRAWL_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: 25,
      scrapeOptions: {
        formats: ["markdown"],
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`firecrawl search failed: ${response.status} ${text.slice(0, 250)}`);
  }

  return response.json();
}

async function firecrawlAgentDiscovery() {
  const { default: Firecrawl } = await import("@mendable/firecrawl-js");
  const { z } = await import("zod");
  const firecrawl = new Firecrawl({ apiKey: FIRECRAWL_API_KEY });

  const schema = z.object({
    posts: z.array(
      z.object({
        platform: z.string(),
        thread_title: z.string(),
        url: z.string(),
        post_date: z.string(),
        user_pain_point_summary: z.string(),
        engagement_strategy: z.string(),
      }),
    ),
  });

  return firecrawl.agent({
    prompt: [
      "Identify recent posts (within the past 3 months) on Reddit, Facebook, and high-quality public forums.",
      "Focus on eldercare, assisted living, memory care, and smart-home support for seniors in Massachusetts.",
      "Exclude irrelevant topics (real estate investing, FIRE financial independence, non-care use-cases).",
      "For each post provide title, URL, post date, pain point summary, and non-spammy founder engagement strategy.",
      `Every engagement strategy must include this tracking link exactly once: ${TRACKING_LINK}`,
    ].join(" "),
    schema,
    urls: [
      "https://aiassistliving.com",
      "https://www.reddit.com/r/AssistedLiving/",
      "https://www.reddit.com/r/massachusetts/",
      "https://www.reddit.com/r/boston/",
      "https://www.reddit.com/r/AgingParents/",
      "https://www.facebook.com/groups/",
      "https://www.agingcare.com/discussions",
    ],
    model: "spark-1-mini",
  });
}

function normText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function platformFromUrl(url) {
  const lower = normText(url).toLowerCase();
  if (lower.includes("reddit.com")) return "reddit";
  if (lower.includes("facebook.com")) return "facebook";
  return "other";
}

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseRelativeDate(value) {
  const lower = normText(value).toLowerCase();
  const m = lower.match(/(\d+)\s*(day|week|month|year)s?\s*ago/);
  if (!m) return null;
  const amount = Number(m[1]);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const unit = m[2];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const factor =
    unit === "day" ? 1 : unit === "week" ? 7 : unit === "month" ? 30 : 365;
  return new Date(now - amount * factor * dayMs);
}

function withinLookback(dateStr) {
  const d = safeDate(dateStr) || parseRelativeDate(dateStr);
  // Strict freshness: if we cannot validate the date, exclude the lead.
  if (!d) return false;
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return d >= cutoff;
}

function isAssistedLivingRelevant(text) {
  const lower = ` ${normText(text).toLowerCase()} `;
  const hasTargetTerm = ASSISTED_LIVING_TERMS.some((t) => lower.includes(t));
  const hasOffTopicTerm = NON_RELEVANT_TERMS.some((t) => lower.includes(t));
  return hasTargetTerm && !hasOffTopicTerm;
}

function isMassachusettsSpecific(text, url) {
  const blob = ` ${normText(text).toLowerCase()} ${normText(url).toLowerCase()} `;
  return MASSACHUSETTS_TERMS.some((t) => blob.includes(t));
}

function isWeakFacebookLead(item) {
  if (item.platform !== "facebook") return false;
  const content = normText(item.post_content);
  // Filter weak FB hits that are mostly nav/search pages or tiny snippets.
  if (content.length < 220) return true;
  if (item.post_url.includes("/search/")) return true;
  if (item.post_url.includes("/groups/") && content.length < 350) return true;
  return false;
}

function buildReplyLink(lead) {
  const url = normText(lead.post_url);
  if (!url) return "";
  if (lead.platform === "reddit") {
    return `${url}${url.includes("?") ? "&" : "?"}context=3`;
  }
  if (lead.platform === "facebook") {
    return url;
  }
  return url;
}

function heuristicAnalyze(post) {
  const text = `${normText(post.post_content)} ${normText(post.intent_signals)} ${normText(post.location_context)}`.toLowerCase();
  const purchaseIntentTerms = ["recommend", "best", "cost", "price", "monthly", "tour", "compare", "which", "need help"];
  const premiumTerms = ["luxury", "high-end", "premium", "concierge", "expensive", "$10,000", "10000"];
  const urgencyTerms = ["asap", "urgent", "immediately", "this week", "next month", "declining", "crisis"];
  const antiPromoTerms = ["no self promotion", "no ads", "spam", "promotion not allowed"];

  const intentScore = purchaseIntentTerms.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
  const premiumScore = premiumTerms.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
  const urgencyScore = urgencyTerms.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
  const antiPromo = antiPromoTerms.some((t) => text.includes(t));
  const providedReceptivity = Math.min(10, Math.max(1, num(post.link_receptivity_score, 5)));

  const relevance = Math.min(10, 3 + intentScore + premiumScore + urgencyScore);
  const engagementFit = antiPromo ? Math.max(1, providedReceptivity - 3) : providedReceptivity;
  const businessImpact = Math.min(10, 2 + intentScore * 1.3 + premiumScore * 1.5 + urgencyScore);
  const risk = antiPromo ? "high" : engagementFit <= 3 ? "medium" : "low";

  return {
    relevance_score: Number(relevance.toFixed(1)),
    engagement_fit_score: Number(engagementFit.toFixed(1)),
    business_impact_score: Number(businessImpact.toFixed(1)),
    risk_level: risk,
    intent_summary: post.intent_signals || "unknown",
  };
}

async function llmAnalyzeAndDraft(topLeads) {
  if (!OPENAI_API_KEY || !topLeads.length) {
    return topLeads.map((lead) => ({
      ...lead,
      suggested_reply:
        lead.platform === "reddit"
          ? `Hi, Josh Fialkoff here - founder of AI Assisted Living Companion. Thanks for sharing this. If helpful, I can share a neutral Massachusetts checklist families use to compare assisted living and memory care (care-fit, total monthly cost, and key tour questions). No pitch; just practical guidance.`
          : `Hi, Josh Fialkoff here, founder of AI Assisted Living Companion. Thanks for posting this. If helpful, I can share a short Massachusetts checklist families use to compare assisted living and memory care options, including tour questions and how to evaluate full monthly costs.`,
      cta_options: [
        lead.platform === "reddit"
          ? "Offer to share a non-promotional comparison checklist in-thread"
          : "Offer to DM or comment a Massachusetts comparison checklist",
        lead.platform === "reddit"
          ? "Offer provider evaluation criteria without naming specific providers"
          : "Offer a step-by-step tour question template for families",
      ],
      guardrails: [
        "Do not claim affiliation unless explicitly stated",
        "Avoid direct promotion in anti-promo communities",
      ],
      one_click_reply_link: buildReplyLink(lead),
    }));
  }

  const prompt = [
    "You are writing as Josh Fialkoff, founder of AI Assisted Living Companion.",
    "Create concise, customized, non-spammy public reply drafts for each lead.",
    "Return strict JSON array of objects with keys: post_url, suggested_reply, cta_options, guardrails.",
    "Reply style: empathetic, practical, no hard sell, no fabricated facts.",
    "Every reply must include a natural founder introduction once (Josh Fialkoff, founder of AI Assisted Living Companion).",
    "Never sound salesy, never push links aggressively, and do not over-claim.",
    `Include this tracking link exactly once when appropriate: ${TRACKING_LINK}`,
    "Platform style requirements:",
    "- Reddit: conversational, transparent, useful bullets, avoid marketing tone.",
    "- Facebook: warmer tone, plain language, short paragraphs, clear supportive CTA.",
    "Leads JSON:",
    JSON.stringify(topLeads),
  ].join("\n");

  const res = await fetch(openaiBase, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    return topLeads;
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) return topLeads;

  try {
    const parsed = JSON.parse(content);
    const replies = Array.isArray(parsed) ? parsed : parsed.items || [];
    const byUrl = new Map(replies.map((r) => [r.post_url, r]));
    return topLeads.map((lead) => {
      const r = byUrl.get(lead.post_url);
      if (!r) return lead;
      return {
        ...lead,
        suggested_reply: r.suggested_reply || lead.suggested_reply,
        cta_options: Array.isArray(r.cta_options) ? r.cta_options : lead.cta_options,
        guardrails: Array.isArray(r.guardrails) ? r.guardrails : lead.guardrails,
        one_click_reply_link: buildReplyLink(lead),
      };
    });
  } catch {
    return topLeads.map((lead) => ({
      ...lead,
      one_click_reply_link: buildReplyLink(lead),
    }));
  }
}

function normalizeRawLeads(raw) {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.leads)
      ? raw.leads
      : Array.isArray(raw?.data?.leads)
        ? raw.data.leads
        : [];

  return arr
    .map((item) => ({
      platform: normText(item.platform) || platformFromUrl(item.post_url || item.url || ""),
      post_url: normText(item.post_url || item.url),
      post_date: normText(item.post_date || item.date),
      poster_profile_url: normText(item.poster_profile_url || item.author_url),
      post_content: normText(item.post_content || item.content || item.summary),
      post_type: normText(item.post_type || "unknown"),
      link_receptivity_score: num(item.link_receptivity_score, 5),
      community_promo_attitude: normText(item.community_promo_attitude || "unknown"),
      estimated_budget: normText(item.estimated_budget || "unknown"),
      intent_signals: normText(item.intent_signals || "unknown"),
      location_context: normText(item.location_context || "unknown"),
    }))
    .filter((item) => item.post_url)
    .filter((item) => ["reddit", "facebook"].includes(item.platform))
    .filter((item) => withinLookback(item.post_date))
    .filter((item) =>
      isAssistedLivingRelevant(`${item.post_content} ${item.intent_signals}`),
    )
    .filter((item) =>
      isMassachusettsSpecific(
        `${item.post_content} ${item.location_context} ${item.intent_signals}`,
        item.post_url,
      ),
    )
    .filter((item) => !isWeakFacebookLead(item));
}

function normalizeRawLeadsRelaxed(raw) {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.leads)
      ? raw.leads
      : Array.isArray(raw?.data?.leads)
        ? raw.data.leads
        : [];

  return arr
    .map((item) => ({
      platform: normText(item.platform) || platformFromUrl(item.post_url || item.url || ""),
      post_url: normText(item.post_url || item.url),
      post_date: normText(item.post_date || item.date),
      poster_profile_url: normText(item.poster_profile_url || item.author_url),
      post_content: normText(item.post_content || item.content || item.summary),
      post_type: normText(item.post_type || "unknown"),
      link_receptivity_score: num(item.link_receptivity_score, 5),
      community_promo_attitude: normText(item.community_promo_attitude || "unknown"),
      estimated_budget: normText(item.estimated_budget || "unknown"),
      intent_signals: normText(item.intent_signals || "unknown"),
      location_context: normText(item.location_context || "unknown"),
      suggested_reply: normText(item.suggested_reply || ""),
    }))
    .filter((item) => item.post_url)
    .filter((item) => ["reddit", "facebook"].includes(item.platform))
    .filter((item) =>
      isAssistedLivingRelevant(`${item.post_content} ${item.intent_signals}`),
    )
    .filter((item) =>
      isMassachusettsSpecific(
        `${item.post_content} ${item.location_context} ${item.intent_signals}`,
        item.post_url,
      ),
    )
    .filter((item) => !isWeakFacebookLead(item))
    .filter((item) => {
      // Relaxed date mode: keep unknown date, reject only when confidently older than window.
      const d = safeDate(item.post_date) || parseRelativeDate(item.post_date);
      if (!d) return true;
      const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
      return d >= cutoff;
    });
}

function normalizeAgentPosts(rawAgentResult) {
  const posts = Array.isArray(rawAgentResult?.data?.posts)
    ? rawAgentResult.data.posts
    : Array.isArray(rawAgentResult?.posts)
      ? rawAgentResult.posts
      : [];

  return posts.map((item) => ({
    platform: normText(item.platform).toLowerCase() || platformFromUrl(item.url || ""),
    post_url: normText(item.url),
    post_date: normText(item.post_date),
    poster_profile_url: "",
    post_content: normText(item.thread_title || item.user_pain_point_summary),
    post_type: "unknown",
    link_receptivity_score: 6,
    community_promo_attitude: "unknown",
    estimated_budget: "unknown",
    intent_signals: normText(item.user_pain_point_summary),
    location_context: "Massachusetts",
    suggested_reply: normText(item.engagement_strategy),
  }));
}

function rankLeads(leads) {
  return leads
    .map((lead) => {
      const analysis = heuristicAnalyze(lead);
      const platformBonus = lead.platform === "reddit" ? 0.4 : 0.2;
      const score =
        analysis.relevance_score * 0.4 +
        analysis.engagement_fit_score * 0.25 +
        analysis.business_impact_score * 0.3 +
        platformBonus -
        (analysis.risk_level === "high" ? 1.2 : analysis.risk_level === "medium" ? 0.5 : 0);

      return {
        ...lead,
        ...analysis,
        priority_score: Number(Math.max(0, Math.min(10, score)).toFixed(2)),
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, MAX_LEADS);
}

function toMarkdown(result) {
  const lines = [];
  lines.push("# Social Engagement Agent Report");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Lookback days: ${result.lookback_days}`);
  lines.push(`Total leads considered: ${result.total_candidates}`);
  lines.push("");
  lines.push("## Top Opportunities");
  for (const lead of result.top_opportunities.slice(0, 15)) {
    lines.push(`- [${lead.platform}] ${lead.post_url}`);
    lines.push(`  - Priority: ${lead.priority_score}/10 | Relevance: ${lead.relevance_score}/10 | Impact: ${lead.business_impact_score}/10`);
    lines.push(`  - Type: ${lead.post_type} | Promo attitude: ${lead.community_promo_attitude}`);
    lines.push(`  - Intent: ${lead.intent_signals}`);
    if (lead.suggested_reply) {
      lines.push(`  - Customized reply: ${lead.suggested_reply}`);
    }
    if (lead.one_click_reply_link) {
      lines.push(`  - Reply now: ${lead.one_click_reply_link}`);
    }
  }
  lines.push("");
  lines.push("## Action Queue (Next 7 Days)");
  lines.push("- Day 1-2: Engage top 5 leads with low-risk helpful replies.");
  lines.push("- Day 3-4: Follow up where users asked direct comparison/cost questions.");
  lines.push("- Day 5-7: Expand to next 10 leads and track clicks + conversations.");
  lines.push("");
  lines.push("## Risks & Guardrails");
  lines.push("- Avoid promotional language in communities hostile to self-promotion.");
  lines.push("- Use educational framing: checklist, questions to ask, neutral guidance.");
  lines.push("- Never fabricate local provider availability, prices, or affiliations.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  // 1) Discovery agent (prefer Firecrawl SDK agent; fallback to search)
  const queries = [
    'site:reddit.com ("assisted living" OR "memory care") ("Massachusetts" OR Boston) (luxury OR premium OR high-end OR concierge OR expensive)',
    'site:reddit.com ("elder care" OR "senior care") ("Massachusetts" OR MA) (cost OR monthly OR recommend OR compare)',
    'site:facebook.com ("assisted living" OR "memory care") ("Massachusetts" OR Boston) (recommendations OR costs OR experiences)',
    'site:facebook.com ("elder care" OR "senior care") ("Massachusetts" OR MA) ("memory care" OR "assisted living")',
  ];

  const aggregated = [];
  let usedDiscoveryMode = "search";
  try {
    const agentResult = await firecrawlAgentDiscovery();
    aggregated.push(...normalizeAgentPosts(agentResult));
    usedDiscoveryMode = "agent";
  } catch {
    const searchResults = [];
    for (const query of queries) {
      // Keep a small delay between requests to avoid throttling.
      await sleep(800);
      const json = await firecrawlSearch(query);
      searchResults.push({ query, json });
    }

    for (const chunk of searchResults) {
      const rows = Array.isArray(chunk?.json?.data) ? chunk.json.data : [];
      for (const row of rows) {
        const url = normText(row.url || row.sourceURL || row.sourceUrl);
        const markdown = normText(row.markdown || row.content || row.description);
        if (!url) continue;
        aggregated.push({
          platform: platformFromUrl(url),
          post_url: url,
          post_date: normText(row.publishedDate || row.date),
          poster_profile_url: "",
          post_content: markdown.slice(0, 1500),
          post_type: "unknown",
          link_receptivity_score: 5,
          community_promo_attitude: "unknown",
          estimated_budget: "unknown",
          intent_signals: markdown.slice(0, 300),
          location_context: "Massachusetts",
        });
      }
    }
  }

  // Enrich Reddit rows with true timestamps/content when search snippets omit dates.
  for (const item of aggregated) {
    if (item.platform !== "reddit") continue;
    if (normText(item.post_date)) continue;
    // Gentle pacing to avoid rate limits.
    await sleep(120);
    try {
      const meta = await fetchRedditMetadata(item.post_url);
      if (!meta) continue;
      if (meta.post_date) item.post_date = meta.post_date;
      if (meta.post_content) {
        item.post_content = meta.post_content.slice(0, 1500);
        item.intent_signals = meta.post_content.slice(0, 300);
      }
      if (meta.location_context) item.location_context = meta.location_context;
    } catch {
      // Leave item as-is if Reddit metadata fetch fails.
    }
  }

  // 2) Enrichment agent (normalize)
  let rawLeads = normalizeRawLeads(aggregated);
  let filter_mode = "strict_date";
  if (!rawLeads.length) {
    rawLeads = normalizeRawLeadsRelaxed(aggregated);
    filter_mode = "relaxed_date_fallback";
  }

  // 3) Ranking agent
  const ranked = rankLeads(rawLeads);

  // 4) Reply agent
  const withReplies = await llmAnalyzeAndDraft(ranked.slice(0, 20));

  const generated_at = new Date().toISOString();
  const output = {
    generated_at,
    source: "Converted from Dify 'Reddit Analyzer' workflow",
    lookback_days: LOOKBACK_DAYS,
    firecrawl_mode: usedDiscoveryMode,
    filter_mode,
    total_candidates: rawLeads.length,
    top_opportunities: withReplies,
  };

  const outDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = generated_at.replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `social-engagement-agent-${stamp}.json`);
  const mdPath = path.join(outDir, `social-engagement-agent-${stamp}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync(mdPath, toMarkdown(output));

  // eslint-disable-next-line no-console
  console.log(`Saved JSON report: ${jsonPath}`);
  // eslint-disable-next-line no-console
  console.log(`Saved markdown report: ${mdPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err);
  process.exit(1);
});
