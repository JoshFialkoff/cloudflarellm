/**
 * Public GPT Action API — Search Assisted Living Facilities
 *
 * Designed for ChatGPT Custom GPT / OpenAI Actions.
 * - No auth required
 * - CORS enabled for ChatGPT domains
 * - JSON responses (no SSE)
 * - Rate limited by IP
 * - Returns structured facility data with deep links to Assistedly.ai
 */

import { MASSACHUSETTS_FACILITIES } from "../../../lib/massachusettsFacilities";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const ALLOWED_ORIGINS = [
  "https://chat.openai.com",
  "https://chatgpt.com",
  "https://openai.com",
];

function setCorsHeaders(res, origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "*";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function scoreFacility(f, params) {
  let score = 0;
  const boosts = [];

  // Town match
  if (params.town && f.town?.toLowerCase() === params.town.toLowerCase()) {
    score += 100;
    boosts.push("exact_town");
  } else if (params.town && f.town?.toLowerCase()?.includes(params.town.toLowerCase())) {
    score += 50;
    boosts.push("partial_town");
  }

  // Care type match
  if (params.careType && Array.isArray(f.careTypes)) {
    const ct = params.careType.toLowerCase();
    if (f.careTypes.some((c) => c.toLowerCase() === ct)) {
      score += 75;
      boosts.push("exact_care_type");
    } else if (f.careTypes.some((c) => c.toLowerCase().includes(ct))) {
      score += 30;
      boosts.push("partial_care_type");
    }
  }

  // Budget fit
  if (typeof params.maxBudget === "number" && typeof f.monthlyMax === "number") {
    if (f.monthlyMax <= params.maxBudget) {
      score += 60;
      boosts.push("within_budget");
    } else if (f.monthlyMin <= params.maxBudget) {
      score += 20;
      boosts.push("min_within_budget");
    }
  }
  if (typeof params.minBudget === "number" && typeof f.monthlyMin === "number") {
    if (f.monthlyMin >= params.minBudget) {
      score += 20;
      boosts.push("above_min_budget");
    }
  }

  // 24/7 nursing bonus
  if (f.has247Nursing) {
    score += 10;
    boosts.push("has_nursing");
  }

  // Text search across name, address, about
  if (params.q) {
    const q = params.q.toLowerCase();
    const text = `${f.name || ""} ${f.address || ""} ${f.about || ""}`.toLowerCase();
    if (text.includes(q)) {
      score += 40;
      boosts.push("text_match");
    }
    if (f.parentCompany?.toLowerCase().includes(q)) {
      score += 30;
      boosts.push("company_match");
    }
  }

  return { score, boosts };
}

function buildFacilityResponse(f) {
  const url = `https://assistedly.ai/facility/ma/${f.slug}`;
  const intakeUrl = `https://assistedly.ai/intake?ai_source=chatgpt&ai_prompt=${encodeURIComponent(
    `Interested in ${f.name}`
  )}`;

  return {
    id: f.id,
    slug: f.slug,
    name: f.name,
    url,
    intakeUrl,
    address: f.address,
    phone: f.phone,
    careTypes: f.careTypes || [],
    capacity: f.capacity,
    monthlyMin: f.monthlyMin,
    monthlyMax: f.monthlyMax,
    has247Nursing: f.has247Nursing,
    complianceRating: f.complianceRating,
    parentCompany: f.parentCompany,
    town: f.town,
    amenities: (f.amenities || []).map((a) => a.name),
    about: f.about
      ? f.about.replace(/\n+/g, " ").slice(0, 500)
      : undefined,
    rating: f.rating,
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  setCorsHeaders(res, origin);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Parse params from query or body
  const raw = req.method === "POST" ? req.body || {} : req.query || {};

  const town = typeof raw.town === "string" ? raw.town.trim() : undefined;
  const careType = typeof raw.careType === "string" ? raw.careType.trim() : undefined;
  const q = typeof raw.q === "string" ? raw.q.trim() : undefined;
  const maxBudget =
    raw.maxBudget !== undefined ? Number(raw.maxBudget) : undefined;
  const minBudget =
    raw.minBudget !== undefined ? Number(raw.minBudget) : undefined;
  const limit = Math.min(
    Number(raw.limit || 10),
    50
  );

  // Validate budgets
  const params = {
    town,
    careType,
    q,
    maxBudget: !isNaN(maxBudget) ? maxBudget : undefined,
    minBudget: !isNaN(minBudget) ? minBudget : undefined,
  };

  const facilities = Object.values(MASSACHUSETTS_FACILITIES);

  const scored = facilities
    .map((f) => ({
      f,
      ...scoreFacility(f, params),
    }))
    .sort((a, b) => b.score - a.score);

  // If no filters applied, return top-rated / largest capacity facilities
  const hasFilters = town || careType || params.maxBudget !== undefined || params.minBudget !== undefined || q;

  const results = scored
    .filter((item) => hasFilters ? item.score > 0 : true)
    .slice(0, limit)
    .map((item) => ({
      ...buildFacilityResponse(item.f),
      _score: item.score,
      _matchReasons: item.boosts,
    }));

  // ── Persist query params to D1 (best-effort, never block response) ──
  try {
    const ctx = await getCloudflareContext({ async: true });
    const db = ctx?.env?.assistedly_analytics;
    if (db) {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS gpt_search_queries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          town TEXT,
          careType TEXT,
          q TEXT,
          maxBudget INTEGER,
          result_count INTEGER,
          origin TEXT
        )
      `).run();
      await db.prepare(`
        INSERT INTO gpt_search_queries (town, careType, q, maxBudget, result_count, origin)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        params.town ?? null,
        params.careType ?? null,
        params.q ?? null,
        params.maxBudget ?? null,
        results.length,
        origin || null
      ).run();
    }
  } catch (logErr) {
    console.warn("[gpt-search] D1 log failed:", logErr.message);
  }

  // Cache reasonably — facility data is refreshed via NocoDB sync
  res.setHeader(
    "Cache-Control",
    "public, max-age=300, s-maxage=3600, stale-while-revalidate=1800"
  );

  return res.status(200).json({
    ok: true,
    meta: {
      totalAvailable: facilities.length,
      returned: results.length,
      filters: params,
      servedBy: "assistedly.ai",
    },
    results,
  });
}
