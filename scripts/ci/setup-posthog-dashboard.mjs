#!/usr/bin/env node
/**
 * PostHog Dashboard Setup — "Leads Lost By Step" + "Wizard Funnel By Variant"
 *
 * Creates PostHog dashboards and insights for the Assistedly wizard funnel.
 * Safe to re-run (creates with unique names).
 *
 * Required env:
 *   POSTHOG_API_KEY
 *   POSTHOG_PROJECT_ID
 *   POSTHOG_HOST — default https://us.posthog.com
 *
 * Optional:
 *   LOOKBACK_DAYS — default 14
 *   DRY_RUN=1 — print URLs without creating
 */

const host = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/+$/, "");
const apiKey = String(process.env.POSTHOG_API_KEY || "").trim();
const projectId = String(process.env.POSTHOG_PROJECT_ID || "").trim();
const lookbackDays = Math.min(90, Math.max(1, Number.parseInt(process.env.LOOKBACK_DAYS || "14", 10) || 14));
const dryRun = /^(1|true|yes)$/i.test(String(process.env.DRY_RUN || "").trim());

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

async function apiPost(path, body) {
  const res = await fetch(`${host}/api/projects/${projectId}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(`${host}/api/projects/${projectId}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GET ${path} failed (${res.status})`);
  }
  return res.json();
}

// ─── Insight definitions ─────────────────────────────────────────────

function funnelInsight(name, description, events, extra = {}) {
  return {
    name,
    derived_name: name,
    description,
    filters: {
      insight: "FUNNELS",
      date_from: `-${lookbackDays}d`,
      events: events.map((e, i) => ({
        id: e.id,
        type: "events",
        order: i,
        name: e.label || e.id,
        ...(e.properties ? { properties: e.properties } : {}),
      })),
      funnel_viz_type: "steps",
      layout: "horizontal",
      exclusions: [],
      ...extra,
    },
  };
}

const STEP_FUNNEL_INSIGHT = funnelInsight(
  "🔴 Leads Lost by Step — Wizard Funnel",
  `Auto-generated: wizard step-by-step funnel. Lookback: ${lookbackDays}d. Shows where users drop off.`,
  [
    { id: "wizard_started", label: "1. Wizard Started" },
    { id: "wizard_step_entry", label: "2. Urgency Step", properties: [{ key: "step_name", value: "urgency", operator: "exact", type: "event" }] },
    { id: "wizard_step_entry", label: "3. Scenarios/Budget Step", properties: [{ key: "step_name", value: "scenarios", operator: "exact", type: "event" }] },
    { id: "wizard_step_entry", label: "4. Budget Step", properties: [{ key: "step_name", value: "budget", operator: "exact", type: "event" }] },
    { id: "wizard_completed", label: "5. Wizard Completed" },
    { id: "generate_lead", label: "6. Lead Generated" },
  ]
);

const VARIANT_FUNNEL_INSIGHT = funnelInsight(
  "🔬 A/B Test: budget-form vs scenarios-first",
  `Auto-generated: experiment funnel broken down by variant. Lookback: ${lookbackDays}d.`,
  [
    { id: "wizard_started", label: "Started" },
    { id: "wizard_completed", label: "Completed" },
    { id: "generate_lead", label: "Lead Generated" },
  ],
  { breakdown: "wizard_path_variant", breakdown_type: "event" }
);

const DROP_OFF_INSIGHT = funnelInsight(
  "📉 Drop-Off Analysis — Last Step Before Abandon",
  `Auto-generated: users who started but never completed. Lookback: ${lookbackDays}d.`,
  [
    { id: "wizard_started", label: "Started Wizard" },
    { id: "wizard_dropped_off", label: "Dropped Off Before Complete" },
  ]
);

const DURATION_INSIGHT = {
  name: "⏱️ AI Response Time Distribution",
  derived_name: "AI Response Time Distribution",
  description: `Auto-generated: response time for wizard_ai_responded. Lookback: ${lookbackDays}d.`,
  filters: {
    insight: "TRENDS",
    date_from: `-${lookbackDays}d`,
    events: [{ id: "wizard_ai_responded", type: "events", math: "avg", math_property: "duration_ms" }],
    display: "ActionsBar",
    breakdown: "wizard_path_variant",
    breakdown_type: "event",
  },
};

const SATISFACTION_INSIGHT = {
  name: "⭐ Results Satisfaction Ratings",
  derived_name: "Results Satisfaction Ratings",
  description: `Auto-generated: satisfaction rates from results_satisfaction_rated. Lookback: ${lookbackDays}d.`,
  filters: {
    insight: "TRENDS",
    date_from: `-${lookbackDays}d`,
    events: [{ id: "results_satisfaction_rated", type: "events" }],
    display: "ActionsBar",
    breakdown: "properties.rating",
  },
};

// ─── Create dashboard ────────────────────────────────────────────────

async function createOrFindDashboard(title, description) {
  // Check if dashboard already exists
  const existing = await apiGet(`/dashboards/?search=${encodeURIComponent(title)}`);
  if (existing?.results?.length > 0) {
    const match = existing.results.find((d) => d.name === title);
    if (match) {
      process.stderr.write(`Dashboard "${title}" already exists (id=${match.id})\n`);
      return match;
    }
  }

  if (dryRun) {
    process.stderr.write(`[DRY RUN] Would create dashboard: "${title}"\n`);
    return { id: "dry-run", name: title };
  }

  const dashboard = await apiPost("/dashboards/", {
    name: title,
    description,
    pinned: "true",
    filters: { date_from: `-${lookbackDays}d` },
  });
  process.stderr.write(`Created dashboard: "${title}" (id=${dashboard.id})\n`);
  return dashboard;
}

async function createInsightWithText(insightDef) {
  if (dryRun) {
    process.stderr.write(`[DRY RUN] Would create insight: "${insightDef.name}"\n`);
    return { short_id: "dry-run", id: "dry-run" };
  }
  return await apiPost("/insights/", insightDef);
}

async function addInsightToDashboard(dashboardId, insightId) {
  if (dryRun || dashboardId === "dry-run") {
    process.stderr.write(`[DRY RUN] Would add insight ${insightId} to dashboard ${dashboardId}\n`);
    return;
  }
  // PostHog API: POST /dashboards/{id}/insights/ with {insight: id}
  await apiPost(`/dashboards/${dashboardId}/insights/`, { insight: insightId });
  process.stderr.write(`  Added insight to dashboard\n`);
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  if (!apiKey || !projectId) {
    process.stderr.write("Missing POSTHOG_API_KEY or POSTHOG_PROJECT_ID\n");
    process.exit(1);
  }

  const ui = posthogUiBase();
  process.stderr.write(`PostHog project: ${ui}/project/${projectId}\n`);
  if (dryRun) process.stderr.write("[DRY RUN MODE]\n");
  process.stderr.write("\n");

  // 1. Create main dashboard
  const dashboard = await createOrFindDashboard(
    "🎯 Wizard Funnel Optimization",
    "Auto-generated dashboard: wizard funnel metrics, A/B test breakdown, drop-off analysis, and performance. Updated by analyze-wizard-funnel.mjs."
  );

  // 2. Create insights
  const insights = [
    STEP_FUNNEL_INSIGHT,
    VARIANT_FUNNEL_INSIGHT,
    DROP_OFF_INSIGHT,
    DURATION_INSIGHT,
    SATISFACTION_INSIGHT,
  ];

  const results = [];
  for (const insightDef of insights) {
    try {
      const insight = await createInsightWithText(insightDef);
      results.push({ name: insightDef.name, insight, status: "created" });

      // Add to dashboard
      if (dashboard?.id) {
        await addInsightToDashboard(dashboard.id, insight.id);
      }
    } catch (e) {
      process.stderr.write(`Failed to create insight "${insightDef.name}": ${e.message}\n`);
      results.push({ name: insightDef.name, status: "error", error: e.message });
    }
  }

  // 3. Summary
  process.stdout.write("\n");
  process.stdout.write(`## PostHog Dashboard Setup Complete\n\n`);
  process.stdout.write(`| Insight | Status | Link |\n`);
  process.stdout.write(`|---------|--------|------|\n`);

  for (const r of results) {
    const link = r.insight?.short_id
      ? `${ui}/project/${projectId}/insights/${r.insight.short_id}`
      : "—";
    process.stdout.write(`| ${r.name} | ${r.status === "created" ? "✅" : "❌"} | ${link} |\n`);
  }

  if (dashboard?.id && !dryRun) {
    process.stdout.write(`\n**Dashboard**: ${ui}/project/${projectId}/dashboard/${dashboard.id}\n`);
  } else if (dryRun) {
    process.stdout.write(`\n[DRY RUN] No dashboard was created. Set DRY_RUN=0 to create.\n`);
  }
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(1);
});
