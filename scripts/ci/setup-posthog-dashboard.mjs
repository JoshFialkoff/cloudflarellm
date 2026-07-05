#!/usr/bin/env node
/**
 * PostHog Dashboard Setup — "Leads Lost By Step" + "Wizard Funnel By Variant"
 *
 * Creates PostHog dashboards and insights for the Assistedly wizard funnel.
 * Uses the new PostHog query-based insight API (legacy filters deprecated).
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

async function apiPatch(path, body) {
  const res = await fetch(`${host}/api/projects/${projectId}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} failed (${res.status}): ${text.slice(0, 300)}`);
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

// ─── Helper: build an event node for the query API ───────────────────

function eventNode(event, name, properties) {
  const node = {
    kind: "EventsNode",
    event,
    name: name || event,
  };
  if (properties && properties.length > 0) {
    node.properties = properties;
  }
  return node;
}

function dateRange() {
  return { date_from: `-${lookbackDays}d` };
}

// ─── Insight definitions (new query-based API) ───────────────────────

const STEP_FUNNEL_INSIGHT = {
  name: "🔴 Leads Lost by Step — Wizard Funnel",
  description: `Wizard step-by-step funnel. Lookback: ${lookbackDays}d. Shows where users drop off.`,
  query: {
    kind: "InsightVizNode",
    source: {
      kind: "FunnelsQuery",
      series: [
        eventNode("wizard_started", "1. Wizard Started"),
        eventNode("wizard_step_entry", "2. Urgency Step", [{ key: "step_name", value: "urgency", operator: "exact", type: "event" }]),
        eventNode("wizard_step_entry", "3. Scenarios/Budget Step", [{ key: "step_name", value: "scenarios", operator: "exact", type: "event" }]),
        eventNode("wizard_step_entry", "4. Budget Step", [{ key: "step_name", value: "budget", operator: "exact", type: "event" }]),
        eventNode("wizard_completed", "5. Wizard Completed"),
        eventNode("generate_lead", "6. Lead Generated"),
      ],
      dateRange: dateRange(),
      funnelsFilter: { funnelVizType: "steps", layout: "horizontal" },
    },
  },
};

const VARIANT_FUNNEL_INSIGHT = {
  name: "🔬 A/B Test: budget-form vs scenarios-first",
  description: `Experiment funnel broken down by wizard_path_variant. Lookback: ${lookbackDays}d.`,
  query: {
    kind: "InsightVizNode",
    source: {
      kind: "FunnelsQuery",
      series: [
        eventNode("wizard_started", "Started"),
        eventNode("wizard_completed", "Completed"),
        eventNode("generate_lead", "Lead Generated"),
      ],
      dateRange: dateRange(),
      funnelsFilter: { funnelVizType: "steps", layout: "horizontal" },
      breakdownFilter: { breakdown: "wizard_path_variant", breakdown_type: "event" },
    },
  },
};

const DROP_OFF_INSIGHT = {
  name: "📉 Drop-Off Analysis — Last Step Before Abandon",
  description: `Users who started but never completed. Lookback: ${lookbackDays}d.`,
  query: {
    kind: "InsightVizNode",
    source: {
      kind: "FunnelsQuery",
      series: [
        eventNode("wizard_started", "Started Wizard"),
        eventNode("wizard_dropped_off", "Dropped Off Before Complete"),
      ],
      dateRange: dateRange(),
      funnelsFilter: { funnelVizType: "steps", layout: "horizontal" },
    },
  },
};

const DURATION_INSIGHT = {
  name: "⏱️ AI Response Time Distribution",
  description: `Response time for wizard_ai_responded by variant. Lookback: ${lookbackDays}d.`,
  query: {
    kind: "InsightVizNode",
    source: {
      kind: "TrendsQuery",
      series: [{
        kind: "EventsNode",
        event: "wizard_ai_responded",
        name: "AI Response Time",
        math: "avg",
        math_property: "duration_ms",
      }],
      dateRange: dateRange(),
      interval: "day",
      trendsFilter: { display: "ActionsBar" },
      breakdownFilter: { breakdown: "wizard_path_variant", breakdown_type: "event" },
    },
  },
};

const SATISFACTION_INSIGHT = {
  name: "⭐ Results Satisfaction Ratings",
  description: `Satisfaction rates from results_satisfaction_rated. Lookback: ${lookbackDays}d.`,
  query: {
    kind: "InsightVizNode",
    source: {
      kind: "TrendsQuery",
      series: [{
        kind: "EventsNode",
        event: "results_satisfaction_rated",
        name: "Satisfaction Rating",
      }],
      dateRange: dateRange(),
      interval: "day",
      trendsFilter: { display: "ActionsBar" },
      breakdownFilter: { breakdown: "properties.rating" },
    },
  },
};

// ─── Create dashboard ────────────────────────────────────────────────

async function createOrFindDashboard(title, description) {
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
  if (dryRun || dashboardId === "dry-run") return;
  // Fetch existing tiles, then PATCH with the new one appended
  const dashboard = await apiGet(`/dashboards/${dashboardId}/`);
  const existingTiles = dashboard?.tiles || [];
  const newTile = { insight: insightId, layouts: {} };
  await apiPatch(`/dashboards/${dashboardId}/`, { tiles: [...existingTiles, newTile] });
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

  // 1. Create or find dashboard
  const dashboard = await createOrFindDashboard(
    "🎯 Wizard Funnel Optimization",
    "Auto-generated dashboard: wizard funnel metrics, A/B test breakdown, drop-off analysis, and performance."
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
      if (dashboard?.id) {
        await addInsightToDashboard(dashboard.id, insight.id);
      }
    } catch (e) {
      process.stderr.write(`Failed to create insight "${insightDef.name}": ${e.message}\n`);
      results.push({ name: insightDef.name, status: "error", error: e.message });
    }
  }

  // 3. Summary
  process.stdout.write("\n## PostHog Dashboard Setup Complete\n\n");
  process.stdout.write("| Insight | Status | Link |\n");
  process.stdout.write("|---------|--------|------|\n");

  for (const r of results) {
    const link = r.insight?.short_id
      ? `${ui}/project/${projectId}/insights/${r.insight.short_id}`
      : "—";
    process.stdout.write(`| ${r.name} | ${r.status === "created" ? "✅" : "❌"} | ${link} |\n`);
  }

  if (dashboard?.id && !dryRun) {
    process.stdout.write(`\n**Dashboard**: ${ui}/project/${projectId}/dashboard/${dashboard.id}\n`);
  } else if (dryRun) {
    process.stdout.write("\n[DRY RUN] No changes made. Set DRY_RUN=0 to create.\n");
  }
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(1);
});
