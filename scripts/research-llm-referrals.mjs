#!/usr/bin/env node
/**
 * Research: LLM Referrals to assistedly.ai
 * Queries GA4, PostHog, DataForSEO, D1, and Cloudflare for signals.
 */

import { GoogleAuth } from "google-auth-library";
import { writeFileSync, unlinkSync } from "fs";

const PH_HOST = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/+$/, "");
const PH_KEY = process.env.POSTHOG_API_KEY;
const PH_PROJECT = process.env.POSTHOG_PROJECT_ID || "1360";

const GA4_PROP = process.env.GA4_PROPERTY_ID || "470773585";
const GA4_SA = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

const DFS_KEY = process.env.DATAFORSEO_API_KEY || "";

async function getGA4Token() {
  if (!GA4_SA) return null;
  const tmp = `/tmp/ga4-sa-${Date.now()}.json`;
  writeFileSync(tmp, GA4_SA, { mode: 0o600 });
  const auth = new GoogleAuth({ keyFile: tmp, scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  unlinkSync(tmp);
  return t?.token || t;
}

async function ga4Query(token, dimensions, metrics, days = 30) {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const prop = GA4_PROP.startsWith("properties/") ? GA4_PROP : `properties/${GA4_PROP}`;
  const body = {
    dateRanges: [{ startDate: start, endDate: end }],
    dimensions: dimensions.map(name => ({ name })),
    metrics: metrics.map(name => ({ name })),
  };
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${prop}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`GA4 ${res.status}: ${t.slice(0, 200)}`); }
  return res.json();
}

async function posthogHogQL(sql) {
  const res = await fetch(`${PH_HOST}/api/projects/${PH_PROJECT}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PH_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql }, async: false }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`PH ${res.status}: ${t.slice(0, 200)}`); }
  return res.json();
}

async function dataforseoLlmMentions() {
  if (!DFS_KEY) return { ok: false, error: "No DFS key" };
  const [login, password] = DFS_KEY.split(":");
  const res = await fetch("https://api.dataforseo.com/v3/ai_optimization/llm_mentions/organic/live", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${login}:${password}`).toString("base64"), "Content-Type": "application/json" },
    body: JSON.stringify([{ target: "assistedly.ai", language_code: "en", location_code: 2840 }]),
  });
  if (!res.ok) { const t = await res.text(); return { ok: false, error: t.slice(0, 200) }; }
  const j = await res.json();
  return { ok: true, data: j };
}

async function main() {
  const results = { generatedAt: new Date().toISOString() };

  // 1. GA4 ai_referrer custom dimension
  try {
    const token = await getGA4Token();
    if (token) {
      const ga4 = await ga4Query(token, ["customEvent:ai_referrer"], ["sessions", "activeUsers", "screenPageViews"], 30);
      const rows = (ga4.rows || []).map(r => ({
        ai_referrer: r.dimensionValues?.[0]?.value || "(not set)",
        sessions: Number(r.metricValues?.[0]?.value || 0),
        activeUsers: Number(r.metricValues?.[1]?.value || 0),
        pageViews: Number(r.metricValues?.[2]?.value || 0),
      }));
      results.ga4_ai_referrer = { totalRows: rows.length, rows };
    } else {
      results.ga4_ai_referrer = { error: "No GA4 service account" };
    }
  } catch (e) {
    results.ga4_ai_referrer = { error: e.message };
  }

  // 2. GA4 sessionSource for AI domains
  try {
    const token = await getGA4Token();
    if (token) {
      const ga4 = await ga4Query(token, ["sessionSource"], ["sessions", "activeUsers"], 30);
      const all = (ga4.rows || []).map(r => ({
        source: r.dimensionValues?.[0]?.value || "(not set)",
        sessions: Number(r.metricValues?.[0]?.value || 0),
        activeUsers: Number(r.metricValues?.[1]?.value || 0),
      }));
      const aiSources = all.filter(s =>
        /chatgpt|openai|perplexity|claude|gemini|bard|copilot|bing\.com\/chat|searchgpt/i.test(s.source)
      );
      results.ga4_session_source = { totalSources: all.length, aiSources, topSources: all.slice(0, 10) };
    }
  } catch (e) {
    results.ga4_session_source = { error: e.message };
  }

  // 3. PostHog $referrer analysis
  try {
    if (PH_KEY) {
      const sql = `SELECT properties.$referrer as referrer, countDistinct(person_id) as users, count() as events FROM events WHERE timestamp > now() - INTERVAL 30 DAY AND properties.$referrer IS NOT NULL GROUP BY referrer ORDER BY users DESC LIMIT 50`;
      const ph = await posthogHogQL(sql);
      const rows = (ph?.results || []);
      const aiRows = rows.filter(r =>
        /chatgpt|openai|perplexity|claude|gemini|bard|copilot|bing\.com\/chat|searchgpt/i.test(String(r?.[0] || ""))
      );
      results.posthog_referrers = { totalRows: rows.length, aiRows, topRows: rows.slice(0, 15) };
    } else {
      results.posthog_referrers = { error: "No PostHog API key" };
    }
  } catch (e) {
    results.posthog_referrers = { error: e.message };
  }

  // 4. PostHog ai_referrer property (if gtag.js pushes it)
  try {
    if (PH_KEY) {
      const sql = `SELECT JSONExtractString(properties, 'ai_referrer') as ai_ref, countDistinct(person_id) as users, count() as events FROM events WHERE timestamp > now() - INTERVAL 30 DAY AND JSONExtractString(properties, 'ai_referrer') != '' GROUP BY ai_ref ORDER BY users DESC`;
      const ph = await posthogHogQL(sql);
      results.posthog_ai_referrer = { rows: ph?.results || [] };
    }
  } catch (e) {
    results.posthog_ai_referrer = { error: e.message };
  }

  // 5. DataForSEO LLM mentions
  try {
    results.dataforseo = await dataforseoLlmMentions();
  } catch (e) {
    results.dataforseo = { error: e.message };
  }

  writeFileSync("/tmp/llm-referrals-research.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
