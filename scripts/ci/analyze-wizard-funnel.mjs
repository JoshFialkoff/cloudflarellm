#!/usr/bin/env node
/**
 * Wizard Funnel Analyzer — PostHog HogQL queries for funnel + experiment + drop-off.
 *
 * Outputs:
 *   1. A/B test exposure & conversion by variant (budget-form vs scenarios-first)
 *   2. Funnel step-by-step drop-off (urgency → scenarios → budget → AI response → complete)
 *   3. "Leads lost by step" breakdown
 *   4. Recommendations
 *
 * Required env:
 *   POSTHOG_API_KEY
 *   POSTHOG_PROJECT_ID
 *   POSTHOG_HOST — default https://us.posthog.com
 *
 * Optional env:
 *   LOOKBACK_DAYS — default 14
 *   OUTPUT_JSON=1 — emit JSON for downstream tooling
 *   DISCORD_ANALYTICS_WEBHOOK_URL — post to Discord
 *   ANALYTICS_SKIP_DISCORD=1 — stdout only
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { postDiscordWebhook, splitDiscordContent } = require("../lib/discord-webhook.cjs");

const host = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/+$/, "");
const apiKey = String(process.env.POSTHOG_API_KEY || "").trim();
const projectId = String(process.env.POSTHOG_PROJECT_ID || "").trim();
const lookbackDays = Math.min(90, Math.max(1, Number.parseInt(process.env.LOOKBACK_DAYS || "14", 10) || 14));
const outputJson = /^(1|true|yes)$/i.test(String(process.env.OUTPUT_JSON || "").trim());
const skipDiscord = /^(1|true|yes)$/i.test(String(process.env.ANALYTICS_SKIP_DISCORD || "").trim());

const webhook =
  String(process.env.DISCORD_ANALYTICS_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_DAILY_ANALYTICS_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_DEPLOY_WEBHOOK_URL || "").trim() ||
  "";

// ─── PostHog API helpers ──────────────────────────────────────────────

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
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PostHog query failed (${res.status}): ${body.slice(0, 500)}`);
  }
  const json = await res.json();
  return json?.results || [];
}

// ─── Query helpers ────────────────────────────────────────────────────

function intervalClause() {
  return `timestamp >= now() - INTERVAL ${lookbackDays} DAY`;
}

// ─── Queries ──────────────────────────────────────────────────────────

async function queryExperimentExposure() {
  // Get $feature_flag_called events for the experiment flag
  const rows = await runHogQL(`
    SELECT
      properties['$feature_flag_response'] AS variant,
      count(DISTINCT person_id) AS unique_users,
      count() AS total_exposures
    FROM events
    WHERE event = '$feature_flag_called'
      AND properties['$feature_flag_key'] = 'homepage-wizard-budget-vs-scenarios'
      AND ${intervalClause()}
    GROUP BY variant
    ORDER BY unique_users DESC
  `);
  return rows.map((r) => ({
    variant: String(r[0] ?? "unknown"),
    uniqueUsers: Number(r[1] ?? 0),
    totalExposures: Number(r[2] ?? 0),
  }));
}

async function queryVariantShown() {
  const rows = await runHogQL(`
    SELECT
      toString(properties.wizard_path_variant) AS variant,
      count(DISTINCT person_id) AS unique_users,
      count() AS total_shown
    FROM events
    WHERE event = 'wizard_path_variant_shown'
      AND ${intervalClause()}
    GROUP BY variant
    ORDER BY unique_users DESC
  `);
  return rows.map((r) => ({
    variant: String(r[0] ?? "unknown"),
    uniqueUsers: Number(r[1] ?? 0),
    totalShown: Number(r[2] ?? 0),
  }));
}

async function queryWizardStarted() {
  const rows = await runHogQL(`
    SELECT count(DISTINCT person_id) AS unique_users, count() AS total
    FROM events
    WHERE event = 'wizard_started'
      AND ${intervalClause()}
  `);
  return {
    uniqueUsers: Number(rows[0]?.[0] ?? 0),
    total: Number(rows[0]?.[1] ?? 0),
  };
}

async function queryStepCompletions() {
  const rows = await runHogQL(`
    SELECT
      toString(properties.step_name) AS step,
      toString(properties.percent_complete) AS pct,
      count(DISTINCT person_id) AS unique_users,
      count() AS total
    FROM events
    WHERE event = 'typebot_question_answered'
      AND properties.step_name IS NOT NULL
      AND ${intervalClause()}
    GROUP BY step, pct
    ORDER BY pct ASC, step ASC
  `);
  return rows.map((r) => ({
    step: String(r[0] ?? "unknown"),
    percentComplete: Number(r[1] ?? 0),
    uniqueUsers: Number(r[2] ?? 0),
    total: Number(r[3] ?? 0),
  }));
}

async function queryWizardCompleted() {
  const rows = await runHogQL(`
    SELECT count(DISTINCT person_id) AS unique_users, count() AS total
    FROM events
    WHERE event = 'wizard_completed'
      AND ${intervalClause()}
  `);
  return {
    uniqueUsers: Number(rows[0]?.[0] ?? 0),
    total: Number(rows[0]?.[1] ?? 0),
  };
}

async function queryWizardAbandoned() {
  // Users who started but never completed = wizard_started minus wizard_completed
  const startedRows = await runHogQL(`
    SELECT count(DISTINCT person_id) AS cnt
    FROM events
    WHERE event = 'wizard_started'
      AND ${intervalClause()}
  `);
  const completedRows = await runHogQL(`
    SELECT count(DISTINCT person_id) AS cnt
    FROM events
    WHERE event = 'wizard_completed'
      AND ${intervalClause()}
  `);
  const started = Number(startedRows[0]?.[0] ?? 0);
  const completed = Number(completedRows[0]?.[0] ?? 0);
  return { started, completed, abandoned: started - completed, abandonRate: started > 0 ? ((started - completed) / started * 100) : 0 };
}

async function queryLastStepBeforeDrop() {
  // Users who started wizard but never completed — what was their last step?
  const rows = await runHogQL(`
    SELECT
      last_step,
      count() AS cnt
    FROM (
      SELECT
        person_id,
        argMax(toString(if(step_name != '', step_name, 'wizard_started')), max_t) AS last_step
      FROM (
        SELECT
          person_id,
          event,
          timestamp AS max_t,
          toString(properties.step_name) AS step_name
        FROM events
        WHERE event IN ('typebot_question_answered', 'wizard_step_entry', 'wizard_completed', 'wizard_started')
          AND ${intervalClause()}
      )
      GROUP BY person_id
      HAVING
        countIf(event = 'wizard_completed') = 0
        AND countIf(event = 'wizard_started') > 0
    )
    GROUP BY last_step
    ORDER BY cnt DESC
  `);
  return rows.map((r) => ({
    step: String(r[0] ?? "unknown"),
    count: Number(r[1] ?? 0),
  }));
}

async function queryFunnelByVariant() {
  // wizard_started → wizard_completed, broken down by variant
  const rows = await runHogQL(`
    SELECT
      toString(properties.wizard_path_variant) AS variant,
      count(DISTINCT person_id) AS started,
      count(DISTINCT if(event = 'wizard_completed', person_id, NULL)) AS completed
    FROM events
    WHERE event IN ('wizard_started', 'wizard_completed')
      AND ${intervalClause()}
    GROUP BY variant
    ORDER BY started DESC
  `);
  return rows.map((r) => ({
    variant: String(r[0] ?? "unknown"),
    started: Number(r[1] ?? 0),
    completed: Number(r[2] ?? 0),
    conversionRate: Number(r[1]) > 0 ? (Number(r[2]) / Number(r[1]) * 100) : 0,
  }));
}

async function queryTypebotCompleted() {
  const rows = await runHogQL(`
    SELECT
      count(DISTINCT person_id) AS unique_users,
      count() AS total
    FROM events
    WHERE event = 'typebot_completed'
      AND ${intervalClause()}
  `);
  return {
    uniqueUsers: Number(rows[0]?.[0] ?? 0),
    total: Number(rows[0]?.[1] ?? 0),
  };
}

async function queryLeadGenerated() {
  const rows = await runHogQL(`
    SELECT
      count(DISTINCT person_id) AS unique_users,
      count() AS total
    FROM events
    WHERE event = 'generate_lead'
      AND ${intervalClause()}
  `);
  return {
    uniqueUsers: Number(rows[0]?.[0] ?? 0),
    total: Number(rows[0]?.[1] ?? 0),
  };
}

async function queryAiResponseTimes() {
  const rows = await runHogQL(`
    SELECT
      avg(toFloat(properties.duration_ms)) AS avg_ms,
      quantile(0.5)(toFloat(properties.duration_ms)) AS p50_ms,
      quantile(0.95)(toFloat(properties.duration_ms)) AS p95_ms
    FROM events
    WHERE event = 'wizard_ai_responded'
      AND ${intervalClause()}
  `);
  return {
    avgMs: Math.round(Number(rows[0]?.[0] ?? 0)),
    p50Ms: Math.round(Number(rows[0]?.[1] ?? 0)),
    p95Ms: Math.round(Number(rows[0]?.[2] ?? 0)),
  };
}

async function queryFacilitiesShownTiming() {
  const rows = await runHogQL(`
    SELECT
      avg(toFloat(properties.duration_ms)) AS avg_ms,
      quantile(0.5)(toFloat(properties.duration_ms)) AS p50_ms
    FROM events
    WHERE event = 'wizard_facilities_shown'
      AND ${intervalClause()}
  `);
  return {
    avgMs: Math.round(Number(rows[0]?.[0] ?? 0)),
    p50Ms: Math.round(Number(rows[0]?.[1] ?? 0)),
  };
}

// ─── Dashboard insight URLs (use setup-posthog-dashboard.mjs to create) ─

// ─── Reporting ────────────────────────────────────────────────────────

function pct(value, total) {
  if (!total) return "0.0%";
  return `${(value / total * 100).toFixed(1)}%`;
}

function bar(value, total, width = 30) {
  if (!total) return "[" + "·".repeat(width) + "]";
  const filled = Math.max(1, Math.round((value / total) * width));
  const empty = width - filled;
  return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}

function buildReport(data) {
  const ui = posthogUiBase();
  const lines = [
    `📊 **Wizard Funnel Analysis** | Last ${lookbackDays} days`,
    ``,
    `**Experiment Exposure**`,
    ``,
  ];

  // Experiment exposure
  for (const v of data.experimentExposure) {
    const total = data.experimentExposure.reduce((s, x) => s + x.uniqueUsers, 0);
    lines.push(`  \`${v.variant}\`: ${v.uniqueUsers} users ${bar(v.uniqueUsers, total)} ${pct(v.uniqueUsers, total)}`);
  }

  const variantShown = data.variantShown;
  if (variantShown.length > 0) {
    lines.push(``, `  **Variant shown (wizard_path_variant_shown):**`);
    for (const v of variantShown) {
      const total = variantShown.reduce((s, x) => s + x.uniqueUsers, 0);
      lines.push(`  \`${v.variant}\`: ${v.uniqueUsers} users ${bar(v.uniqueUsers, total)} ${pct(v.uniqueUsers, total)}`);
    }
  }

  // Funnel
  lines.push(``, `**Wizard Funnel**`, ``);
  const events = [
    { name: "Wizard Started", count: data.wizardStarted.uniqueUsers },
    ...data.stepCompletions.map((s) => ({ name: `${s.step} (${s.percentComplete}%)`, count: s.uniqueUsers })),
    { name: "AI Responded", count: data.aiResponseTime.avgMs > 0 ? data.wizardStarted.uniqueUsers : 0 },
    { name: "Wizard Completed", count: data.wizardCompleted.uniqueUsers },
    { name: "Lead Generated", count: data.leadGenerated.uniqueUsers },
  ];

  const funnelStart = events[0]?.count || 1;
  for (const ev of events) {
    const p = pct(ev.count, funnelStart);
    const drop = ev.count > 0 ? ((funnelStart - ev.count) / funnelStart * 100).toFixed(1) : "N/A";
    lines.push(`  ${ev.name}: ${ev.count} users ${p} (${drop}% dropped)`);
  }

  // Abandoned
  lines.push(``, `**Drop-off Analysis**`);
  lines.push(`  Users who started but didn't complete: **${data.abandoned.abandoned}** (${data.abandoned.abandonRate.toFixed(1)}%)`);
  lines.push(``, `  **Last step before drop:**`);
  for (const d of data.lastStepBeforeDrop) {
    lines.push(`  • \`${d.step}\`: ${d.count} users`);
  }

  // Variant funnel comparison
  lines.push(``, `**Funnel by Variant**`);
  for (const v of data.funnelByVariant) {
    const conversionStr = v.conversionRate.toFixed(1);
    lines.push(`  \`${v.variant}\`: ${v.started} started → ${v.completed} completed (${conversionStr}%)`);
  }

  // Performance
  if (data.aiResponseTime.avgMs > 0) {
    lines.push(``, `**Performance (AI Response)**`);
    lines.push(`  Avg: ${data.aiResponseTime.avgMs}ms | P50: ${data.aiResponseTime.p50Ms}ms | P95: ${data.aiResponseTime.p95Ms}ms`);
  }
  if (data.facilitiesTiming.avgMs > 0) {
    lines.push(`  Facilities shown avg: ${data.facilitiesTiming.avgMs}ms`);
  }

  // Typebot vs native
  if (data.typebotCompleted.total > 0 || data.wizardCompleted.total > 0) {
    lines.push(``, `**Completion Events**`);
    lines.push(`  typebot_completed: ${data.typebotCompleted.total} (legacy event)`);
    lines.push(`  wizard_completed: ${data.wizardCompleted.total} (native event)`);
    lines.push(`  generate_lead: ${data.leadGenerated.total}`);
  }

  // Recommendations
  lines.push(``, `**🔍 Recommendations**`, ``);
  const dropRate = data.abandoned.abandonRate;
  if (dropRate > 70) {
    lines.push(`  ⚠️ **${dropRate.toFixed(0)}% abandon rate** — critical. Prioritize funnel fixes.`);
  } else if (dropRate > 50) {
    lines.push(`  ⚠️ **${dropRate.toFixed(0)}% abandon rate** — needs attention.`);
  } else {
    lines.push(`  ✅ **${dropRate.toFixed(0)}% abandon rate** — within expected range.`);
  }

  // Find biggest drop-off step
  const stepDrops = [];
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1].count;
    const curr = events[i].count;
    if (prev > 0) {
      stepDrops.push({ step: events[i].name, drop: ((prev - curr) / prev * 100) });
    }
  }
  const worst = stepDrops.sort((a, b) => b.drop - a.drop)[0];
  if (worst) {
    lines.push(`  🔴 Biggest drop: **${worst.step}** (${worst.drop.toFixed(1)}% loss at this step)`);
  }

  // Variant recommendation
  const variantConversion = data.funnelByVariant.filter(v => v.variant !== "unknown");
  if (variantConversion.length === 2) {
    const v1 = variantConversion[0];
    const v2 = variantConversion[1];
    const diff = v1.conversionRate - v2.conversionRate;
    const winner = diff > 0 ? v1.variant : v2.variant;
    const loser = diff > 0 ? v2.variant : v1.variant;
    lines.push(`  🏆 **${winner}** converts ${Math.abs(diff).toFixed(1)}% better than **${loser}**`);
    if (Math.abs(diff) < 2) {
      lines.push(`  ℹ️ Difference is small — extend experiment or check sample size.`);
    }
  } else {
    lines.push(`  ℹ️ Insufficient variant data to compare. Check experiment flag is firing correctly.`);
  }

  // Dashboard links
  lines.push(``, `**📈 Dashboards**`);
  lines.push(`  PostHog project: ${ui}/project/${projectId}`);
  if (data.funnelInsightUrl) lines.push(`  Wizard Funnel: ${data.funnelInsightUrl}`);
  if (data.variantInsightUrl) lines.push(`  A/B Test by Variant: ${data.variantInsightUrl}`);

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  if (!apiKey || !projectId) {
    process.stderr.write("Missing POSTHOG_API_KEY or POSTHOG_PROJECT_ID\n");
    process.exit(1);
  }

  process.stderr.write(`Analyzing funnel over last ${lookbackDays} days...\n`);

  const [
    experimentExposure,
    variantShown,
    wizardStarted,
    stepCompletions,
    wizardCompleted,
    abandoned,
    lastStepBeforeDrop,
    funnelByVariant,
    typebotCompleted,
    leadGenerated,
    aiResponseTime,
    facilitiesTiming,
  ] = await Promise.all([
    queryExperimentExposure().catch((e) => { process.stderr.write(`Experiment query error: ${e}\n`); return []; }),
    queryVariantShown().catch((e) => { process.stderr.write(`Variant query error: ${e}\n`); return []; }),
    queryWizardStarted().catch((e) => { process.stderr.write(`Wizard start query error: ${e}\n`); return { uniqueUsers: 0, total: 0 }; }),
    queryStepCompletions().catch((e) => { process.stderr.write(`Step query error: ${e}\n`); return []; }),
    queryWizardCompleted().catch((e) => { process.stderr.write(`Wizard completed query error: ${e}\n`); return { uniqueUsers: 0, total: 0 }; }),
    queryWizardAbandoned().catch((e) => { process.stderr.write(`Abandoned query error: ${e}\n`); return { started: 0, completed: 0, abandoned: 0, abandonRate: 0 }; }),
    queryLastStepBeforeDrop().catch((e) => { process.stderr.write(`Last step query error: ${e}\n`); return []; }),
    queryFunnelByVariant().catch((e) => { process.stderr.write(`Funnel variant query error: ${e}\n`); return []; }),
    queryTypebotCompleted().catch((e) => { process.stderr.write(`Typebot completed query error: ${e}\n`); return { uniqueUsers: 0, total: 0 }; }),
    queryLeadGenerated().catch((e) => { process.stderr.write(`Lead query error: ${e}\n`); return { uniqueUsers: 0, total: 0 }; }),
    queryAiResponseTimes().catch((e) => { process.stderr.write(`AI response query error: ${e}\n`); return { avgMs: 0, p50Ms: 0, p95Ms: 0 }; }),
    queryFacilitiesShownTiming().catch((e) => { process.stderr.write(`Facilities timing query error: ${e}\n`); return { avgMs: 0, p50Ms: 0 }; }),
  ]);

  // Create PostHog dashboards
  // Use setup-posthog-dashboard.mjs to create PostHog dashboard & insights
  const funnelInsightUrl = "";
  const variantInsightUrl = "";

  const reportData = {
    experimentExposure,
    variantShown,
    wizardStarted,
    stepCompletions,
    wizardCompleted,
    abandoned,
    lastStepBeforeDrop,
    funnelByVariant,
    typebotCompleted,
    leadGenerated,
    aiResponseTime,
    facilitiesTiming,
    funnelInsightUrl,
    variantInsightUrl,
  };

  if (outputJson) {
    process.stdout.write(JSON.stringify(reportData, null, 2) + "\n");
    return;
  }

  if (reportData.wizardStarted.uniqueUsers === 0 && reportData.abandoned.started === 0) {
    process.stderr.write(
      "\n⚠️ No wizard events found in the last 14 days. Possible causes:\n" +
      "  1. The PostHog project may use a different event name (check 'wizard_started' in PostHog Data Management)\n" +
      "  2. Site hasn't been active in the last 14 days\n" +
      "  3. The API key may not have access to this project's data\n\n" +
      "  To debug, run this from your terminal:\n" +
      '  node -e "\n' +
      "    fetch('https://us.posthog.com/api/projects/" + projectId + "/query/', {\n" +
      "      method: 'POST', headers: { Authorization: 'Bearer ' + process.env.POSTHOG_API_KEY, 'Content-Type': 'application/json' },\n" +
      "      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: \\\"SELECT event, count() FROM events WHERE timestamp >= now() - INTERVAL 30 DAY GROUP BY event ORDER BY count() DESC LIMIT 15\\\" }})\n" +
      "    }).then(r => r.json()).then(j => console.log(JSON.stringify(j.results?.slice(0,15) || j, null, 2)))\n" +
      '  "\n'
    );
  }

  const message = buildReport(reportData);
  process.stdout.write(`${message}\n`);

  if (skipDiscord) {
    process.stderr.write("\nANALYTICS_SKIP_DISCORD set — not posting to Discord.\n");
    return;
  }
  if (!webhook) {
    process.stderr.write(
      "\nNo Discord webhook (set DISCORD_ANALYTICS_WEBHOOK_URL or sibling).\n"
    );
    process.exit(0);
  }

  for (const chunk of splitDiscordContent(message)) {
    await postDiscordWebhook(webhook, chunk);
  }
  process.stderr.write("\nPosted wizard funnel analysis to Discord.\n");
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(1);
});
