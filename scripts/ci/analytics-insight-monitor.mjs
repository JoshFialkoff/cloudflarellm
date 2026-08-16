#!/usr/bin/env node
/**
 * Analytics Insight Monitor v2.0
 * Monitors PostHog + GA4 Data API + Cloudflare Worker health for:
 *   - Event volume anomalies (PostHog + GA4 key events, sessions)
 *   - Exception trends
 *   - Funnel integrity / drop-off
 *   - Cross-provider discrepancies
 *   - A/B test integrity
 *
 * Outputs:
 *   1. Discord alert (if anomaly or daily summary)
 *   2. Strategy brief JSON (for downstream strategy agent)
 *   3. Exit code 1 if critical issue found (for CI visibility)
 *
 * Required env:
 *   POSTHOG_API_KEY
 *   POSTHOG_PROJECT_ID
 *   POSTHOG_HOST — default https://us.posthog.com
 *
 * Optional env:
 *   LOOKBACK_HOURS            — default 24 (daily), can be 168 for weekly
 *   ANOMALY_THRESHOLD_PCT     — default 30 (% drop to flag)
 *   DISCORD_ANALYTICS_WEBHOOK_URL
 *   DISCORD_DAILY_ANALYTICS_WEBHOOK_URL
 *   DISCORD_GITHUB_UPDATES_WEBHOOK_URL
 *   DISCORD_WEBHOOK_URL
 *   ANALYTICS_MONITOR_SKIP_DISCORD=1 — stdout only
 *   STRATEGY_BRIEF_OUT          — file path to write JSON brief (default /tmp/analytics-strategy-brief.json)
 *   CLOUDFLARE_ACCOUNT_ID       — for Worker health check
 *   CLOUDFLARE_API_TOKEN        — for Worker health check
 *   WORKER_NAME                 — default assistedly-slot4
 *
 * GA4 env (optional — GA4 skipped if missing):
 *   GA4_PROPERTY_ID             — e.g. 470773585
 *   GOOGLE_APPLICATION_CREDENTIALS — path to service-account.json
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { postDiscordWebhook, splitDiscordContent } = require("../lib/discord-webhook.cjs");

// ── Configuration ────────────────────────────────────────────────────
const host = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/+$/, "");
const apiKey = String(process.env.POSTHOG_API_KEY || "").trim();
let projectId = String(process.env.POSTHOG_PROJECT_ID || "").trim();
const lookbackHours = Math.min(168, Math.max(1, Number.parseInt(process.env.LOOKBACK_HOURS || "24", 10) || 24));
const lowTrafficThreshold = Math.max(0, Number.parseInt(process.env.LOW_TRAFFIC_THRESHOLD || "5", 10) || 5);
const anomalyThresholdPct = Math.max(5, Number.parseInt(process.env.ANOMALY_THRESHOLD_PCT || "30", 10) || 30);
const skipDiscord = /^(1|true|yes)$/i.test(String(process.env.ANALYTICS_MONITOR_SKIP_DISCORD || "").trim());
const strategyBriefOut = String(process.env.STRATEGY_BRIEF_OUT || "/tmp/analytics-strategy-brief.json").trim();
const isWeekly = lookbackHours >= 168;

const cfAccountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const cfApiToken = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();
const workerName = String(process.env.WORKER_NAME || "assistedly-slot4").trim();

const ga4PropertyId = String(process.env.GA4_PROPERTY_ID || "").trim();
const ga4CredPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
const ga4ServiceAccountJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
const ga4Enabled = Boolean(ga4PropertyId && (ga4CredPath || ga4ServiceAccountJson));

const cfZoneId = String(process.env.CF_ZONE_ID || "70904cb60620dcfb62f49cccbfe72959").trim();
const cfToken = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();

const dfsApiKey = String(process.env.DATAFORSEO_API_KEY || "").trim();
const dfsEnabled = Boolean(dfsApiKey);

const webhook =
  String(process.env.DISCORD_ANALYTICS_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_DAILY_ANALYTICS_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_GITHUB_UPDATES_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_WEBHOOK_URL || "").trim() ||
  "";

// ── PostHog API helpers ──────────────────────────────────────────────

async function discoverProjectId() {
  if (projectId) return projectId;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${host}/api/projects/`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const first = json?.results?.[0];
    if (first?.id) {
      projectId = String(first.id);
      process.stderr.write(`Auto-discovered PostHog project: ${projectId} (${first.name})\n`);
      return projectId;
    }
  } catch {
    // ignore discovery errors
  }
  return null;
}

function posthogUiBase() {
  try {
    const u = new URL(host);
    if (u.hostname === "us.i.posthog.com") return "https://us.posthog.com";
    if (u.hostname === "eu.i.posthog.com") return "https://eu.posthog.com";
    return `${u.protocol}//${u.hostname.replace(/\.i\./, ".")}`;
  } catch {
    return "https://us.posthog.com";
  }
}

async function runHogQL(query) {
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PostHog query failed (${res.status}): ${body.slice(0, 500)}`);
  }
  const json = await res.json();
  return json?.results || [];
}

// ── PostHog Queries ──────────────────────────────────────────────────

function intervalClause(hours = lookbackHours) {
  return `timestamp >= now() - INTERVAL ${hours} HOUR`;
}

async function queryEventVolume(eventName, hours = lookbackHours) {
  const rows = await runHogQL(`
    SELECT count() AS cnt
    FROM events
    WHERE event = '${eventName}'
      AND ${intervalClause(hours)}
  `);
  return Number(rows[0]?.[0] ?? 0);
}

async function queryEventVolumeByDay(eventName) {
  const rows = await runHogQL(`
    SELECT
      toDate(timestamp) AS day,
      count() AS cnt
    FROM events
    WHERE event = '${eventName}'
      AND ${intervalClause(Math.min(lookbackHours, 168))}
    GROUP BY day
    ORDER BY day DESC
  `);
  return rows.map(([day, cnt]) => ({ day: String(day ?? ""), count: Number(cnt ?? 0) }));
}

async function queryFunnelSteps() {
  const steps = [
    ["wizard_started", "1. Wizard Started"],
    ["wizard_step_entry", "2. Urgency Step", "properties.step_name = 'urgency'"],
    ["wizard_step_entry", "3. Scenarios Step", "properties.step_name = 'scenarios'"],
    ["wizard_step_entry", "4. Budget Step", "properties.step_name = 'budget'"],
    ["wizard_completed", "5. Wizard Completed"],
    ["generate_lead", "6. Lead Generated"],
  ];
  const results = [];
  for (const [event, label, extraFilter] of steps) {
    const filter = extraFilter ? ` AND ${extraFilter}` : "";
    const rows = await runHogQL(`
      SELECT count(DISTINCT person_id) AS unique_users, count() AS total
      FROM events
      WHERE event = '${event}'
        AND ${intervalClause()}${filter}
    `);
    results.push({
      step: label,
      event,
      uniqueUsers: Number(rows[0]?.[0] ?? 0),
      total: Number(rows[0]?.[1] ?? 0),
    });
  }
  return results;
}

async function queryExceptionDigest() {
  const totalRows = await runHogQL(`
    SELECT count() AS total
    FROM events
    WHERE event = '$exception'
      AND ${intervalClause()}
  `);
  const total = Number(totalRows[0]?.[0] ?? 0);

  const issueRows = await runHogQL(`
    SELECT
      coalesce(
        nullIf(trim(toString(properties.\$exception_fingerprint)), ''),
        toString(cityHash64(toString(coalesce(properties.\$exception_list, ''))))
      ) AS issue_key,
      count() AS cnt,
      any(properties.\$current_url) AS sample_url,
      substring(any(toString(coalesce(properties.\$exception_list, ''))), 1, 300) AS detail
    FROM events
    WHERE event = '\$exception'
      AND ${intervalClause()}
    GROUP BY issue_key
    ORDER BY cnt DESC
    LIMIT 10
  `);

  return {
    total,
    topIssues: issueRows.map(([key, cnt, url, detail]) => ({
      fingerprint: String(key ?? "").slice(0, 120),
      count: Number(cnt ?? 0),
      sampleUrl: String(url ?? "").slice(0, 200),
      detail: String(detail ?? "").replace(/\s+/g, " ").slice(0, 200),
    })),
  };
}

async function queryExperimentIntegrity() {
  // Use the latest active experiment flag
  const rows = await runHogQL(`
    SELECT
      properties['\$feature_flag_response'] AS variant,
      count(DISTINCT person_id) AS users
    FROM events
    WHERE event = '\$feature_flag_called'
      AND properties['\$feature_flag_key'] = 'homepage-free-text-entry-2026-08'
      AND ${intervalClause()}
    GROUP BY variant
    ORDER BY users DESC
  `);
  const variants = rows.map(([variant, users]) => ({
    variant: String(variant ?? "unknown"),
    users: Number(users ?? 0),
  }));

  let isBalanced = true;
  if (variants.length >= 2) {
    const maxU = Math.max(...variants.map((v) => v.users));
    const minU = Math.min(...variants.map((v) => v.users));
    if (maxU > 0 && minU / maxU < 0.4) isBalanced = false;
  }

  return { variants, isBalanced };
}

async function queryTopLandingPages() {
  const rows = await runHogQL(`
    SELECT
      properties.\$pathname AS path,
      count(DISTINCT person_id) AS unique_users,
      count() AS pageviews
    FROM events
    WHERE event = '\$pageview'
      AND ${intervalClause()}
      AND properties.\$pathname NOT IN ('', '/')
    GROUP BY path
    ORDER BY unique_users DESC
    LIMIT 10
  `);
  return rows.map(([path, users, views]) => ({
    path: String(path ?? ""),
    uniqueUsers: Number(users ?? 0),
    pageviews: Number(views ?? 0),
  }));
}

async function queryTopEvents() {
  const rows = await runHogQL(`
    SELECT
      event,
      count() AS cnt
    FROM events
    WHERE ${intervalClause()}
      AND NOT startsWith(event, '\$')
    GROUP BY event
    ORDER BY cnt DESC
    LIMIT 15
  `);
  return rows.map(([event, cnt]) => ({ event: String(event ?? ""), count: Number(cnt ?? 0) }));
}

// ── GA4 Data API ─────────────────────────────────────────────────────

let GoogleAuth;
try {
  ({ GoogleAuth } = require("google-auth-library"));
} catch {
  // google-auth-library not installed — GA4 will gracefully skip
}

async function getGoogleAccessToken(scopes) {
  if (!GoogleAuth || !ga4Enabled) return null;
  let keyFile = ga4CredPath;
  let cleanup = null;
  try {
    if (!keyFile && ga4ServiceAccountJson) {
      const tmpPath = `/tmp/ga4-service-account-${Date.now()}.json`;
      writeFileSync(tmpPath, ga4ServiceAccountJson, { mode: 0o600 });
      keyFile = tmpPath;
      cleanup = () => {
        try { require("node:fs").unlinkSync(tmpPath); } catch {}
      };
    }
    const auth = new GoogleAuth({
      keyFile,
      scopes: scopes || ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    if (cleanup) cleanup();
    return tokenRes?.token || tokenRes;
  } catch (e) {
    if (cleanup) cleanup();
    process.stderr.write(`Google auth error: ${e.message}\n`);
    return null;
  }
}

// Backward compat alias
async function getGA4AccessToken() {
  return getGoogleAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]);
}

function ga4Date(daysAgoStart, daysAgoEnd) {
  if (daysAgoStart === 0) return { startDate: "today", endDate: "today" };
  const range = { startDate: `${daysAgoStart}daysAgo`, endDate: daysAgoEnd === 0 ? "today" : `${daysAgoEnd}daysAgo` };
  return range;
}

async function queryGA4Report(accessToken, startDaysAgo, endDaysAgo) {
  const body = {
    dateRanges: [ga4Date(startDaysAgo, endDaysAgo)],
    metrics: [
      { name: "sessions" },
      { name: "keyEvents" },
      { name: "activeUsers" },
      { name: "screenPageViews" },
      { name: "eventCount" },
    ],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
  };

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GA4 API ${res.status}: ${txt.slice(0, 500)}`);
  }
  return res.json();
}

async function queryGA4Metrics() {
  if (!ga4Enabled) return null;
  const accessToken = await getGA4AccessToken();
  if (!accessToken) return null;

  const days = Math.max(1, Math.ceil(lookbackHours / 24));

  const [current, previous] = await Promise.all([
    queryGA4Report(accessToken, days, 0),
    queryGA4Report(accessToken, days * 2, days),
  ]);

  function extractTotal(report) {
    const totals = {};
    if (!report || !report.rows) return totals;
    // If totals row is present, prefer it
    if (report.totals && report.totals[0] && report.totals[0].metricValues) {
      const metricNames = (report.metricHeaders || []).map((h) => h.name);
      report.totals[0].metricValues.forEach((v, i) => {
        totals[metricNames[i]] = Number(v.value ?? 0);
      });
    }
    // Fallback: sum from rows
    if (Object.keys(totals).length === 0) {
      const metricNames = (report.metricHeaders || []).map((h) => h.name);
      report.rows.forEach((row) => {
        row.metricValues.forEach((v, i) => {
          const key = metricNames[i];
          totals[key] = (totals[key] || 0) + Number(v.value ?? 0);
        });
      });
    }
    return totals;
  }

  function extractChannelBreakdown(report) {
    if (!report || !report.rows) return [];
    const dimName = (report.dimensionHeaders || [])[0]?.name;
    const metricNames = (report.metricHeaders || []).map((h) => h.name);
    return report.rows.map((row) => ({
      channel: String(row.dimensionValues?.[0]?.value ?? "(other)"),
      ...Object.fromEntries(
        (row.metricValues || []).map((v, i) => [metricNames[i], Number(v.value ?? 0)])
      ),
    }));
  }

  const currentTotal = extractTotal(current);
  const previousTotal = extractTotal(previous);

  return {
    current: currentTotal,
    previous: previousTotal,
    channelBreakdown: extractChannelBreakdown(current),
    lookbackDays: days,
  };
}

// ── Cloudflare Worker health ─────────────────────────────────────────

async function queryWorkerHealth() {
  if (!cfApiToken || !cfAccountId) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/workers/services/${workerName}`,
      {
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
    const json = await res.json();
    return { ok: json.success, service: json.result };
  } catch (e) {
    return { ok: false, error: String(e.message) };
  }
}

// ── Cloudflare Zone Analytics ───────────────────────────────────────

async function queryCloudflareZoneAnalytics() {
  // Bot analytics token (cfat_*) has Zone:Read but not Analytics:Read.
  // Use REST zone details for health; skip GraphQL traffic analytics.
  if (!cfToken || !cfZoneId) return null;
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}`, {
      headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return { ok: false, status: res.status, error: 'zone fetch failed' };
    const json = await res.json();
    if (!json.success) return { ok: false, error: json.errors?.[0]?.message || 'zone api error' };
    return {
      ok: true,
      zoneName: json.result?.name,
      status: json.result?.status,
      plan: json.result?.plan?.name,
      devMode: json.result?.development_mode,
      totalRequests: 0, totalPageViews: 0, totalVisits: 0, totalCached: 0, cacheHitRate: 0,
      peakHour: null, peakRequests: 0, countries: [], errors4xx: [], errors5xx: [], errorTotal: 0,
    };
  } catch (e) {
    return { ok: false, error: String(e.message) };
  }
}

// ── Google Search Console ───────────────────────────────────────────

const gscSiteUrl = String(process.env.GSC_SITE_URL || "https://assistedly.ai/").trim();
const gscEnabled = Boolean(ga4Enabled && gscSiteUrl);

async function querySearchConsoleMetrics() {
  if (!gscEnabled) return null;
  const accessToken = await getGoogleAccessToken([
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/webmasters.readonly",
  ]);
  if (!accessToken) return null;

  const days = Math.max(1, Math.ceil(lookbackHours / 24));
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().slice(0, 10);

  const site = encodeURIComponent(gscSiteUrl);

  async function request(dimensions) {
    const body = { startDate, endDate, dimensions, rowLimit: 10, dataState: "all" };
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GSC API ${res.status}: ${txt.slice(0, 300)}`);
    }
    return res.json();
  }

  try {
    const [byQuery, byPage] = await Promise.all([
      request(["query"]),
      request(["page"]),
    ]);

    const totalClicks = (byQuery.rows || []).reduce((s, r) => s + (r.clicks || 0), 0);
    const totalImpressions = (byQuery.rows || []).reduce((s, r) => s + (r.impressions || 0), 0);
    const avgPosition = byQuery.rows?.length
      ? byQuery.rows.reduce((s, r) => s + (r.position || 0), 0) / byQuery.rows.length
      : 0;

    return {
      ok: true,
      totalClicks,
      totalImpressions,
      avgPosition: Number(avgPosition.toFixed(1)),
      ctr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
      topQueries: (byQuery.rows || []).slice(0, 5).map((r) => ({
        query: String(r.keys?.[0] || ""),
        clicks: Number(r.clicks || 0),
        impressions: Number(r.impressions || 0),
        ctr: Number(r.ctr ? r.ctr * 100 : 0).toFixed(1),
        position: Number(r.position || 0).toFixed(1),
      })),
      topPages: (byPage.rows || []).slice(0, 5).map((r) => ({
        page: String(r.keys?.[0] || ""),
        clicks: Number(r.clicks || 0),
        impressions: Number(r.impressions || 0),
        ctr: Number(r.ctr ? r.ctr * 100 : 0).toFixed(1),
        position: Number(r.position || 0).toFixed(1),
      })),
    };
  } catch (e) {
    return { ok: false, error: String(e.message) };
  }
}

// ── DataForSEO Signals ──────────────────────────────────────────────────

async function queryDataForSeoSignals() {
  if (!dfsEnabled) return null;
  try {
    const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live", {
      method: "POST",
      headers: { Authorization: `Basic ${dfsApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify([{
        target: "assistedly.ai",
        location_code: Number(process.env.DATAFORSEO_LOCATION_CODE || "2840"),
        language_code: String(process.env.DATAFORSEO_LANG || "en"),
        limit: 10,
      }]),
    });
    const json = await res.json();
    const task = json?.tasks?.[0];
    const result = task?.result?.[0];
    if (!result) return { ok: false, error: "No DataForSEO result" };

    const organic = result.metrics?.organic || {};
    const items = (result.items || [])
      .filter((it) => it.keyword_data?.keyword)
      .map((it) => ({
        keyword: String(it.keyword_data.keyword),
        searchVolume: Number(it.keyword_data?.keyword_info?.search_volume || 0),
        position: Number(it.ranked_serp_element?.serp_item?.rank_absolute || 0),
        etv: Number(it.ranked_serp_element?.serp_item?.etv || 0),
        url: String(it.ranked_serp_element?.serp_item?.url || ""),
      }))
      .sort((a, b) => (a.position || 999) - (b.position || 999));

    return {
      ok: true,
      totalKeywords: Number(organic.count || 0),
      estimatedTraffic: Number(organic.etv || 0),
      top10: Number(organic.pos_1 || 0) + Number(organic.pos_2_3 || 0) + Number(organic.pos_4_10 || 0),
      top20: Number(organic.pos_11_20 || 0),
      newKeywords: Number(organic.is_new || 0),
      upKeywords: Number(organic.is_up || 0),
      downKeywords: Number(organic.is_down || 0),
      lostKeywords: Number(organic.is_lost || 0),
      topKeywords: items.slice(0, 5),
    };
  } catch (e) {
    return { ok: false, error: String(e.message) };
  }
}

// ── Anomaly detection ──────────────────────────────────────────────────

function detectAnomaly(current, baseline, label) {
  if (baseline === 0) return current > 0 ? null : { label, severity: "warn", message: `${label}: no baseline data` };
  const pct = ((current - baseline) / baseline) * 100;
  if (pct <= -anomalyThresholdPct) {
    return {
      label,
      severity: "critical",
      message: `${label} dropped ${Math.abs(pct).toFixed(1)}% (${baseline} → ${current})`,
      pct,
      current,
      baseline,
    };
  }
  if (pct <= -15) {
    return {
      label,
      severity: "warn",
      message: `${label} down ${Math.abs(pct).toFixed(1)}% (${baseline} → ${current})`,
      pct,
      current,
      baseline,
    };
  }
  if (pct >= anomalyThresholdPct * 2) {
    // Require higher threshold for spikes to avoid noise
    return {
      label,
      severity: "warn",
      message: `${label} spiked ${pct.toFixed(1)}% (${baseline} → ${current})`,
      pct,
      current,
      baseline,
    };
  }
  return null;
}

// ── Report building ────────────────────────────────────────────────────

function formatDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date());
}

function buildDiscordReport({ funnel, exceptions, experiment, landingPages, topEvents, anomalies, workerHealth, ga4, cloudflare, dataforseo, searchConsole }) {
  const lines = [];

  // ── Header ────────────────────────────────────────────────────────
  lines.push(`📊 **Analytics Insights** — ${formatDate()} (${lookbackHours}h lookback)`);
  lines.push("");

  // ── GA4 Totals ────────────────────────────────────────────────────
  if (ga4) {
    const c = ga4.current;
    lines.push(`**Total Sessions:** ${c.sessions?.toLocaleString() ?? 0}`);
    lines.push(`**Total Users:** ${c.activeUsers?.toLocaleString() ?? 0}`);
    lines.push(`**Total Conversions (Key Events):** ${c.keyEvents?.toLocaleString() ?? 0}`);
  } else {
    lines.push("**GA4 data unavailable.**");
  }
  lines.push("");

  // ── Channel Breakdown ─────────────────────────────────────────────
  if (ga4 && ga4.channelBreakdown.length) {
    const channels = ga4.channelBreakdown
      .filter((ch) => (ch.sessions ?? 0) > 0 || (ch.keyEvents ?? 0) > 0)
      .sort((a, b) => (b.sessions ?? 0) - (a.sessions ?? 0));

    for (const ch of channels) {
      const name = ch.channel || "Unassigned";
      const sessions = ch.sessions ?? 0;
      const conversions = ch.keyEvents ?? 0;
      const rate = sessions > 0 ? ((conversions / sessions) * 100).toFixed(1) : "0.0";
      let label = "";
      if (Number(rate) > 100) label = " (high)";
      else if (Number(rate) < 15) label = " (low)";

      lines.push(`${name}:`);
      lines.push(`Sessions: ${sessions.toLocaleString()}`);
      lines.push(`Conversions: ${conversions.toLocaleString()}`);
      lines.push(`Conversion Rate: ${rate}%${label}`);
      lines.push("");
    }
  }

  // ── Search Console ──────────────────────────────────────────────
  if (searchConsole && searchConsole.ok) {
    lines.push("**Search Performance**");
    lines.push(`- Clicks: ${searchConsole.totalClicks.toLocaleString()} | Impressions: ${searchConsole.totalImpressions.toLocaleString()} | Avg Position: ${searchConsole.avgPosition} | CTR: ${searchConsole.ctr}%`);
    if (searchConsole.topQueries.length) {
      lines.push("- Top Queries:");
      for (const q of searchConsole.topQueries) {
        lines.push(`  • "${q.query.slice(0, 40)}" — ${q.clicks} clicks, pos ${q.position}`);
      }
    }
    if (searchConsole.topPages.length) {
      lines.push("- Top Pages:");
      for (const p of searchConsole.topPages.slice(0, 3)) {
        lines.push(`  • ${p.page.replace(gscSiteUrl, "/").slice(0, 50)} — ${p.clicks} clicks`);
      }
    }
    lines.push("");
  }

  // ── Funnel Snapshot (compact) ─────────────────────────────────────
  const started = funnel.find((s) => s.event === "wizard_started");
  const completed = funnel.find((s) => s.event === "wizard_completed");
  const leadGen = funnel.find((s) => s.event === "generate_lead");
  if (started) {
    const completionRate = completed && started.uniqueUsers > 0
      ? ((completed.uniqueUsers / started.uniqueUsers) * 100).toFixed(1)
      : "0.0";
    const leadRate = completed && leadGen && completed.uniqueUsers > 0
      ? ((leadGen.uniqueUsers / completed.uniqueUsers) * 100).toFixed(1)
      : "0.0";
    lines.push(`**Wizard:** ${started.uniqueUsers} started → ${completed ? completed.uniqueUsers : 0} completed (${completionRate}%) → ${leadGen ? leadGen.uniqueUsers : 0} leads (${leadRate}%)`);
    lines.push("");
  }

  // ── Anomalies (compact inline) ────────────────────────────────────
  if (anomalies.length) {
    lines.push("**Anomalies:**");
    for (const a of anomalies) {
      const icon = a.severity === "critical" ? "🔴" : a.severity === "warn" ? "🟡" : "🟢";
      lines.push(`${icon} ${a.message}`);
    }
    lines.push("");
  }

  // ── Infrastructure Health ─────────────────────────────────────────
  const infraIssues = [];
  if (workerHealth && !workerHealth.ok) infraIssues.push(`Worker unhealthy: ${workerHealth.error || workerHealth.status}`);
  if (cloudflare && !cloudflare.ok) infraIssues.push(`Cloudflare: ${cloudflare.error || "unavailable"}`);
  if (exceptions.total > 20) infraIssues.push(`${exceptions.total} exceptions logged`);
  if (!experiment.isBalanced) infraIssues.push("A/B test imbalance detected");
  if (infraIssues.length) {
    lines.push("**Infrastructure / Health:**");
    for (const issue of infraIssues) lines.push(`• ${issue}`);
    lines.push("");
  }

  // ── Recommendations ────────────────────────────────────────────────
  lines.push("**Recommendations**");

  // Channel-specific recs
  if (ga4 && ga4.channelBreakdown.length) {
    const direct = ga4.channelBreakdown.find((c) => /direct/i.test(c.channel));
    const paidSocial = ga4.channelBreakdown.find((c) => /paid.?social|paid_search|paid/i.test(c.channel));
    const organic = ga4.channelBreakdown.find((c) => /organic/i.test(c.channel));
    const unassigned = ga4.channelBreakdown.find((c) => /unassigned|referral|display|email/i.test(c.channel));

    if (direct) {
      lines.push("Direct Traffic:");
      lines.push("- Maintain high engagement strategies to preserve conversion rates.");
      lines.push("- Consider optimizing landing pages to further enhance user experience.");
      lines.push("");
    }

    if (paidSocial) {
      lines.push("Paid Social Performance:");
      const psRate = (paidSocial.sessions ?? 0) > 0 ? (paidSocial.keyEvents ?? 0) / paidSocial.sessions : 0;
      if (psRate > 1) {
        lines.push("- Replicate successful campaigns driving high event volume.");
        lines.push("- Test new creatives based on high-performing ads.");
      } else {
        lines.push("- Review ad creatives and audience targeting for efficiency.");
      }
      lines.push("- Pause underperforming ads with low conversion rates.");
      lines.push("");
    }

    if (organic) {
      lines.push("Organic Search:");
      lines.push("- Monitor keyword rankings and optimize underperforming pages.");
      if ((topEvents.find((e) => /seo|search/i.test(e.event))?.count ?? 0) === 0) {
        lines.push("- Ensure on-page SEO signals are aligned with target queries.");
      }
      lines.push("");
    }

    if (unassigned || ga4.channelBreakdown.some((c) => /unassigned/i.test(c.channel))) {
      lines.push("Unassigned Traffic:");
      lines.push("- Implement UTM parameters for better tracking.");
      lines.push("- Review landing page sources to ensure proper attribution.");
      lines.push("");
    }
  }

  // Exception recommendation
  if (exceptions.total > 0) {
    lines.push("Engineering:");
    lines.push(`- Investigate top exception: \`${exceptions.topIssues[0]?.fingerprint.slice(0, 80)}\` (${exceptions.topIssues[0]?.count} occurrences).`);
    lines.push("");
  }

  // ── SEO Signals ───────────────────────────────────────────────────
  if (dataforseo && dataforseo.ok) {
    lines.push("**SEO Signals**");
    lines.push(`- Organic Keywords: ${dataforseo.totalKeywords.toLocaleString()} (top 10: ${dataforseo.top10}, top 20: ${dataforseo.top20})`);
    lines.push(`- Est. Traffic Value: ${dataforseo.estimatedTraffic.toFixed(2)}`);
    if (dataforseo.newKeywords > 0 || dataforseo.lostKeywords > 0) {
      lines.push(`- New: ${dataforseo.newKeywords} | Up: ${dataforseo.upKeywords} | Down: ${dataforseo.downKeywords} | Lost: ${dataforseo.lostKeywords}`);
    }
    if (dataforseo.topKeywords.length) {
      lines.push("- Top Keywords:");
      for (const kw of dataforseo.topKeywords.slice(0, 3)) {
        lines.push(`  • ${kw.keyword} — pos ${kw.position}, vol ${kw.searchVolume.toLocaleString()}, etv ${kw.etv.toFixed(2)}`);
      }
    }
    lines.push("");
  }

  // ── Next Steps ────────────────────────────────────────────────────
  lines.push("**Next Steps**");
  lines.push("Daily Review Checklist:");
  lines.push(`- Sessions: Monitor growth trend (current ${ga4?.current?.sessions ?? "N/A"}).`);
  lines.push(`- Users: Track engagement and returning visitor rate.`);
  lines.push(`- Conversions: Track key events vs. wizard completions.`);
  lines.push("- Paid Social Performance: Analyze daily performance metrics and CPA.");
  lines.push("- Wizard Leads: Ensure lead generation is on target.");
  if (!dataforseo || !dataforseo.ok) {
    lines.push("- SEO Signals: Review top landing pages for keyword performance.");
  }
  lines.push("");

  // ── Source Status ─────────────────────────────────────────────────
  if (infraIssues.length === 0 && anomalies.length === 0) {
    lines.push("✅ No sources are reported as failed or missing.");
  } else {
    const failParts = [];
    if (workerHealth && !workerHealth.ok) failParts.push("Worker");
    if (cloudflare && !cloudflare.ok) failParts.push("Cloudflare");
    if (anomalies.some((a) => a.severity === "critical")) failParts.push("Critical metrics");
    lines.push(`⚠️ Sources needing attention: ${failParts.join(", ")}.`);
  }

  return lines.join("\n");
}

function buildStrategyBrief({ funnel, exceptions, experiment, landingPages, topEvents, anomalies, workerHealth, ga4, cloudflare, dataforseo, searchConsole }) {
  const brief = {
    generatedAt: new Date().toISOString(),
    lookbackHours,
    source: "analytics-insight-monitor",
    funnel,
    exceptionsSummary: {
      total: exceptions.total,
      topIssueFingerprint: exceptions.topIssues[0]?.fingerprint || null,
      topIssueCount: exceptions.topIssues[0]?.count || 0,
    },
    experiment: {
      isBalanced: experiment.isBalanced,
      variantDistribution: experiment.variants,
    },
    anomalies: anomalies.map((a) => ({
      severity: a.severity,
      message: a.message,
      metric: a.label,
      pctChange: a.pct,
    })),
    topLandingPages: landingPages.slice(0, 5),
    topEvents: topEvents.slice(0, 5),
    cloudflareSummary: cloudflare && cloudflare.ok
      ? {
          totalRequests: cloudflare.totalRequests,
          totalPageViews: cloudflare.totalPageViews,
          totalVisits: cloudflare.totalVisits,
          cacheHitRate: cloudflare.cacheHitRate,
          errorTotal: cloudflare.errorTotal,
          peakHour: cloudflare.peakHour,
          peakRequests: cloudflare.peakRequests,
          topCountries: cloudflare.countries.slice(0, 5),
          errors4xx: cloudflare.errors4xx.slice(0, 3),
          errors5xx: cloudflare.errors5xx.slice(0, 3),
        }
      : null,
    ga4Summary: ga4
      ? {
          keyEvents: ga4.current?.keyEvents ?? 0,
          sessions: ga4.current?.sessions ?? 0,
          activeUsers: ga4.current?.activeUsers ?? 0,
          pageViews: ga4.current?.screenPageViews ?? 0,
          eventCount: ga4.current?.eventCount ?? 0,
          previousKeyEvents: ga4.previous?.keyEvents ?? 0,
          previousSessions: ga4.previous?.sessions ?? 0,
          topChannels: ga4.channelBreakdown
            .sort((a, b) => (b.sessions ?? 0) - (a.sessions ?? 0))
            .slice(0, 5),
        }
      : null,
    dataforseoSummary: dataforseo && dataforseo.ok
      ? {
          totalKeywords: dataforseo.totalKeywords,
          estimatedTraffic: dataforseo.estimatedTraffic,
          top10: dataforseo.top10,
          top20: dataforseo.top20,
          newKeywords: dataforseo.newKeywords,
          upKeywords: dataforseo.upKeywords,
          downKeywords: dataforseo.downKeywords,
          lostKeywords: dataforseo.lostKeywords,
          topKeywords: dataforseo.topKeywords,
        }
      : null,
    searchConsoleSummary: searchConsole && searchConsole.ok
      ? {
          totalClicks: searchConsole.totalClicks,
          totalImpressions: searchConsole.totalImpressions,
          avgPosition: searchConsole.avgPosition,
          ctr: searchConsole.ctr,
          topQueries: searchConsole.topQueries,
          topPages: searchConsole.topPages,
        }
      : null,
    overallConversionRate: funnel[0]?.uniqueUsers > 0
      ? Number(((funnel[funnel.length - 1]?.uniqueUsers ?? 0) / funnel[0].uniqueUsers).toFixed(4))
      : 0,
    workerHealthy: workerHealth?.ok ?? null,
    recommendedActions: [],
  };

  if (exceptions.total > 20) {
    brief.recommendedActions.push({
      type: "engineering",
      priority: "high",
      action: `Investigate top exception: ${exceptions.topIssues[0]?.fingerprint.slice(0, 80)} (${exceptions.topIssues[0]?.count} occurrences)`,
    });
  }

  const intakeToComplete = funnel.find((s) => s.event === "wizard_completed");
  const started = funnel.find((s) => s.event === "wizard_started");
  if (started && intakeToComplete && started.uniqueUsers > 0) {
    const completionRate = intakeToComplete.uniqueUsers / started.uniqueUsers;
    if (completionRate < 0.15) {
      brief.recommendedActions.push({
        type: "product",
        priority: "high",
        action: `Wizard completion rate is ${(completionRate * 100).toFixed(1)}% — investigate mid-funnel drop-off (step 2→3)`,
      });
    }
  }

  const leadGen = funnel.find((s) => s.event === "generate_lead");
  if (intakeToComplete && leadGen && intakeToComplete.uniqueUsers > 0) {
    const leadRate = leadGen.uniqueUsers / intakeToComplete.uniqueUsers;
    if (leadRate < 0.3) {
      brief.recommendedActions.push({
        type: "conversion",
        priority: "medium",
        action: `Lead capture rate is ${(leadRate * 100).toFixed(1)}% of completed wizards — experiment with CTA or reduce auth friction`,
      });
    }
  }

  // GA4 cross-provider sniff
  if (ga4 && started) {
    const phWizardStarted = started.uniqueUsers;
    const gaSessions = ga4.current?.sessions ?? 0;
    if (gaSessions > 0 && phWizardStarted > 0) {
      const ratio = phWizardStarted / gaSessions;
      if (ratio < 0.05 || ratio > 0.8) {
        brief.recommendedActions.push({
          type: "analytics",
          priority: "medium",
          action: `Cross-provider discrepancy: PostHog wizard_started (${phWizardStarted}) vs GA4 sessions (${gaSessions}) ratio is ${(ratio * 100).toFixed(1)}% — verify tracking integrity`,
        });
      }
    }
  }

  if (cloudflare && cloudflare.ok) {
    if (cloudflare.cacheHitRate < 20) {
      brief.recommendedActions.push({
        type: "infrastructure",
        priority: "high",
        action: `Cloudflare cache hit rate ${cloudflare.cacheHitRate.toFixed(1)}% — review cache control headers for static assets`,
      });
    }
    const errorRate = cloudflare.totalRequests > 0 ? (cloudflare.errorTotal / cloudflare.totalRequests) * 100 : 0;
    if (errorRate > 1) {
      brief.recommendedActions.push({
        type: "engineering",
        priority: "medium",
        action: `CF error rate ${errorRate.toFixed(2)}% — investigate ${cloudflare.errors5xx.length} 5xx and ${cloudflare.errors4xx.length} 4xx status patterns`,
      });
    }
    const topCountry = cloudflare.countries[0];
    if (topCountry && topCountry.country && topCountry.country !== "US" && topCountry.count > cloudflare.totalRequests * 0.3) {
      brief.recommendedActions.push({
        type: "security",
        priority: "low",
        action: `Unusual traffic from ${topCountry.country} (${topCountry.count} requests) — verify not bot traffic`,
      });
    }
  }

  const topLanding = landingPages[0];
  if (topLanding && topLanding.path) {
    brief.recommendedActions.push({
      type: "content",
      priority: "low",
      action: `High-traffic page ${topLanding.path} had ${topLanding.uniqueUsers} unique users — optimize CTA placement`,
    });
  }

  return brief;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  if (!apiKey) {
    process.stderr.write("Missing POSTHOG_API_KEY\n");
    process.exit(1);
  }

  if (!projectId) {
    const discovered = await discoverProjectId();
    if (!discovered) {
      process.stderr.write("Missing POSTHOG_PROJECT_ID and auto-discovery failed. Set POSTHOG_PROJECT_ID explicitly.\n");
      process.exit(1);
    }
  }

  const previousWindowHours = lookbackHours * 2;

  // Pull data in parallel
  const [
    funnel,
    exceptions,
    experiment,
    landingPages,
    topEvents,
    currentWizardStarted,
    previousWizardStarted,
    currentExceptions,
    previousExceptions,
    workerHealth,
    ga4,
    cloudflare,
    dataforseo,
    searchConsole,
  ] = await Promise.all([
    queryFunnelSteps(),
    queryExceptionDigest(),
    queryExperimentIntegrity(),
    queryTopLandingPages(),
    queryTopEvents(),
    queryEventVolume("wizard_started", lookbackHours),
    queryEventVolume("wizard_started", previousWindowHours).then((n) => n / 2),
    queryEventVolume("$exception", lookbackHours),
    queryEventVolume("$exception", previousWindowHours).then((n) => n / 2),
    queryWorkerHealth(),
    queryGA4Metrics(),
    queryCloudflareZoneAnalytics(),
    queryDataForSeoSignals(),
    querySearchConsoleMetrics(),
  ]);

  const anomalies = [];

  // PostHog anomalies
  const wizardAnomaly = detectAnomaly(currentWizardStarted, previousWizardStarted, "wizard_started");
  if (wizardAnomaly && (currentWizardStarted >= lowTrafficThreshold || previousWizardStarted >= lowTrafficThreshold)) {
    anomalies.push(wizardAnomaly);
  } else if (wizardAnomaly) {
    anomalies.push({ ...wizardAnomaly, severity: "info", message: `${wizardAnomaly.message} (low traffic — not critical)` });
  }

  const exceptionAnomaly = detectAnomaly(currentExceptions, previousExceptions, "$exception");
  if (exceptionAnomaly) anomalies.push(exceptionAnomaly);

  const leadCurrent = funnel.find((s) => s.event === "generate_lead")?.uniqueUsers ?? 0;
  const leadPrevious = await queryEventVolume("generate_lead", previousWindowHours).then((n) => n / 2);
  const leadAnomaly = detectAnomaly(leadCurrent, leadPrevious, "generate_lead");
  if (leadAnomaly && (leadCurrent >= lowTrafficThreshold || leadPrevious >= lowTrafficThreshold)) {
    anomalies.push(leadAnomaly);
  } else if (leadAnomaly) {
    anomalies.push({ ...leadAnomaly, severity: "info", message: `${leadAnomaly.message} (low traffic — not critical)` });
  }

  // Cloudflare anomalies
  if (cloudflare && cloudflare.ok) {
    const cfPrevReq = cloudflare.totalRequests > 0 ? Math.round(cloudflare.totalRequests * 0.9) : 0;
    const cfPrevPv = cloudflare.totalPageViews > 0 ? Math.round(cloudflare.totalPageViews * 0.9) : 0;
    const cfMetrics = [
      ["CF requests", cloudflare.totalRequests, cfPrevReq],
      ["CF pageViews", cloudflare.totalPageViews, cfPrevPv],
    ];
    for (const [label, curr, prev] of cfMetrics) {
      const a = detectAnomaly(curr, prev, label);
      if (a && (curr >= lowTrafficThreshold || prev >= lowTrafficThreshold)) anomalies.push(a);
    }
    if (cloudflare.cacheHitRate < 20 && cloudflare.totalRequests > 100) {
      anomalies.push({ label: "CF cache hit rate", severity: "warn", message: `Cloudflare cache hit rate is ${cloudflare.cacheHitRate.toFixed(1)}% (${cloudflare.totalCached}/${cloudflare.totalRequests})`, current: cloudflare.cacheHitRate, baseline: 20, pct: -cloudflare.cacheHitRate });
    }
    const errorRate = cloudflare.totalRequests > 0 ? (cloudflare.errorTotal / cloudflare.totalRequests) * 100 : 0;
    if (errorRate > 1) {
      anomalies.push({ label: "CF error rate", severity: "warn", message: `Cloudflare error rate is ${errorRate.toFixed(2)}% (${cloudflare.errorTotal} errors / ${cloudflare.totalRequests} requests)`, current: errorRate, baseline: 1, pct: errorRate });
    }
  } else if (cloudflare && !cloudflare.ok) {
    process.stderr.write(`CF Analytics skipped: ${cloudflare.error}\n`);
  }

  // GA4 anomalies
  if (ga4) {
    const ga4Metrics = [
      ["sessions", ga4.current?.sessions ?? 0, ga4.previous?.sessions ?? 0],
      ["keyEvents", ga4.current?.keyEvents ?? 0, ga4.previous?.keyEvents ?? 0],
      ["activeUsers", ga4.current?.activeUsers ?? 0, ga4.previous?.activeUsers ?? 0],
      ["screenPageViews", ga4.current?.screenPageViews ?? 0, ga4.previous?.screenPageViews ?? 0],
      ["eventCount", ga4.current?.eventCount ?? 0, ga4.previous?.eventCount ?? 0],
    ];
    for (const [label, curr, prev] of ga4Metrics) {
      const a = detectAnomaly(curr, prev, `GA4 ${label}`);
      if (a && (curr >= lowTrafficThreshold || prev >= lowTrafficThreshold)) {
        anomalies.push(a);
      }
    }

    // Channel-specific anomaly: any channel dropping >50% or absent
    const prevChannels = new Map();
    if (ga4.previous) {
      // We didn't capture per-channel previous — only totals. Skip for now.
    }
  }

  const discordBody = buildDiscordReport({ funnel, exceptions, experiment, landingPages, topEvents, anomalies, workerHealth, ga4, cloudflare, dataforseo, searchConsole });
  process.stdout.write(`${discordBody}\n`);

  const brief = buildStrategyBrief({ funnel, exceptions, experiment, landingPages, topEvents, anomalies, workerHealth, ga4, cloudflare, dataforseo, searchConsole });
  writeFileSync(strategyBriefOut, JSON.stringify(brief, null, 2));
  process.stderr.write(`\nStrategy brief written to ${strategyBriefOut}\n`);

  if (skipDiscord) {
    process.stderr.write("ANALYTICS_MONITOR_SKIP_DISCORD set — not posting to Discord.\n");
  } else if (webhook) {
    for (const chunk of splitDiscordContent(discordBody)) {
      await postDiscordWebhook(webhook, chunk);
    }
    process.stderr.write("Posted analytics insight report to Discord.\n");
  } else {
    process.stderr.write("No Discord webhook configured.\n");
  }

  const hasCritical = anomalies.some((a) => a.severity === "critical") || (workerHealth && !workerHealth.ok);
  if (hasCritical) {
    process.stderr.write("\nCritical issues detected.\n");
    process.exit(1);
  }
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(1);
});
