#!/usr/bin/env node
/**
 * Daily #1 Key Insight → Discord
 * Posts a single most important finding from yesterday's data.
 * Designed for 6am ET cron.
 *
 * Required env:
 *   POSTHOG_API_KEY, POSTHOG_PROJECT_ID
 *   DISCORD_DAILY_INSIGHT_WEBHOOK_URL
 *
 * Optional:
 *   LOOKBACK_HOURS — default 24 (yesterday)
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { postDiscordWebhook } = require("../lib/discord-webhook.cjs");

const PROJECT = String(process.env.POSTHOG_PROJECT_ID || "1360").trim();
const API_KEY = String(process.env.POSTHOG_API_KEY || "").trim();
const WEBHOOK = String(process.env.DISCORD_DAILY_INSIGHT_WEBHOOK_URL || "").trim();
const HOST = "https://us.posthog.com";
const LOOKBACK = Math.min(168, Math.max(1, Number.parseInt(process.env.LOOKBACK_HOURS || "24", 10) || 24));
const EXPERIMENT_KEY = "homepage-free-text-entry-2026-08";

function fmtDateNY() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short", day: "numeric",
  }).format(new Date());
}

async function runHogQL(query) {
  const res = await fetch(`${HOST}/api/projects/${PROJECT}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
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

async function getPathConversions(eventName, pathname) {
  const rows = await runHogQL(`
    SELECT count(DISTINCT distinct_id) AS users
    FROM events
    WHERE event = '${eventName}'
      AND timestamp >= now() - INTERVAL ${LOOKBACK} HOUR
      AND properties.\$pathname = '${pathname}'
  `);
  return Number(rows[0]?.[0] || 0);
}

async function getPageviews(pathname) {
  const rows = await runHogQL(`
    SELECT count(DISTINCT distinct_id) AS users
    FROM events
    WHERE event = '\$pageview'
      AND timestamp >= now() - INTERVAL ${LOOKBACK} HOUR
      AND properties.\$pathname = '${pathname}'
  `);
  return Number(rows[0]?.[0] || 0);
}

async function getTopAnomaly() {
  const rows = await runHogQL(`
    SELECT event, count() AS cnt
    FROM events
    WHERE event = '\$exception'
      AND timestamp >= now() - INTERVAL ${LOOKBACK} HOUR
    GROUP BY event
    ORDER BY cnt DESC
    LIMIT 1
  `);
  return rows[0];
}

function pct(n, d) {
  if (!d) return "0.0";
  return ((n / d) * 100).toFixed(1);
}

function fmtChange(current, previous) {
  if (!previous) return "";
  const delta = ((current - previous) / previous) * 100;
  const icon = delta >= 0 ? "📈" : "📉";
  return `${icon} ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs prior ${LOOKBACK}h`;
}

async function main() {
  if (!API_KEY) { console.error("Missing POSTHOG_API_KEY"); process.exit(1); }
  if (!WEBHOOK) { console.error("Missing DISCORD_DAILY_INSIGHT_WEBHOOK_URL"); process.exit(1); }

  // Pull all data in parallel (pathname-based: / = control, /asks = variant)
  const [
    wizControl, wizVariant,
    leadControl, leadVariant,
    pvControl, pvVariant,
    topEx,
  ] = await Promise.all([
    getPathConversions("wizard_completed", "/"),
    getPathConversions("wizard_completed", "/asks"),
    getPathConversions("generate_lead", "/"),
    getPathConversions("generate_lead", "/asks"),
    getPageviews("/"),
    getPageviews("/asks"),
    getTopAnomaly(),
  ]);

  // Prioritize anomaly if spike
  if (topEx && Number(topEx[1]) > 10) {
    const msg = `🔴 **#1 Insight — ${fmtDateNY()}**\n\nTop issue: \`$exception\` fired **${topEx[1]}** times in last ${LOOKBACK}h. Check error analytics.`;
    await postDiscordWebhook(WEBHOOK, msg);
    console.log("Posted anomaly insight.");
    return;
  }

  // Build A/B comparison
  const wizRateControl = pct(wizControl, pvControl);
  const wizRateVariant = pct(wizVariant, pvVariant);
  const leadRateControl = pct(leadControl, pvControl);
  const leadRateVariant = pct(leadVariant, pvVariant);

  const controlPV = pvControl;
  const variantPV = pvVariant;
  const totalPV = controlPV + variantPV;

  if (totalPV < 20) {
    const msg = `🟡 **#1 Insight — ${fmtDateNY()}**\n\nTraffic is low (${totalPV} visits in ${LOOKBACK}h). Not enough data for a reliable A/B read yet.`;
    await postDiscordWebhook(WEBHOOK, msg);
    console.log("Posted low-traffic insight.");
    return;
  }

  // Pick the strongest signal
  const insights = [];

  if (wizControl + wizVariant > 0) {
    insights.push({
      label: "Wizard completion",
      controlRate: wizRateControl,
      variantRate: wizRateVariant,
      controlN: wizControl,
      variantN: wizVariant,
    });
  }

  if (leadControl + leadVariant > 0) {
    insights.push({
      label: "Lead generation",
      controlRate: leadRateControl,
      variantRate: leadRateVariant,
      controlN: leadControl,
      variantN: leadVariant,
    });
  }

  // Pick the metric with the biggest absolute difference
  const top = insights
    .map(i => ({ ...i, diff: Math.abs(Number(i.variantRate) - Number(i.controlRate)) }))
    .sort((a, b) => b.diff - a.diff)[0];

  if (!top) {
    const msg = `🟡 **#1 Insight — ${fmtDateNY()}**\n\nNo conversion events in last ${LOOKBACK}h. Traffic: ${totalPV} pageviews.`;
    await postDiscordWebhook(WEBHOOK, msg);
    console.log("Posted empty-funnel insight.");
    return;
  }

  const winner = Number(top.variantRate) > Number(top.controlRate) ? "🧠 Free-text variant" : "🎯 Control";
  const margin = Math.abs(Number(top.variantRate) - Number(top.controlRate)).toFixed(1);

  const msg = [
    `**#1 Insight — ${fmtDateNY()}**`,
    "",
    `**Metric:** ${top.label}`,
    `**Winner:** ${winner} (+${margin}pp)`,
    "",
    `**Control (**\` / \`**)**: ${top.controlRate}% • ${top.controlN} conversions • ${controlPV} pageviews`,
    `**Variant (**\`/asks\`**)**: ${top.variantRate}% • ${top.variantN} conversions • ${variantPV} pageviews`,
    "",
    `[Dashboard](https://us.posthog.com/project/${PROJECT}/dashboard/2000193) • [Control Funnel](https://us.posthog.com/project/${PROJECT}/insights/VDrLrh9N) • [Variant Funnel](https://us.posthog.com/project/${PROJECT}/insights/LV5NnnUM)`,
  ].join("\n");

  await postDiscordWebhook(WEBHOOK, msg);
  console.log("Posted daily insight to Discord.");
}

main().catch(e => {
  console.error("❌", e?.stack || e);
  process.exit(1);
});
