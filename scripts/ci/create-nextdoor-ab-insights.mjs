#!/usr/bin/env node
/**
 * Create PostHog insights for Nextdoor A/B test
 */

const PROJECT_ID = "1360";
const API_KEY = process.env.POSTHOG_API_KEY || "";
const HOST = "https://us.posthog.com";

if (!API_KEY) {
  console.error("Set POSTHOG_API_KEY env var");
  process.exit(1);
}

async function apiPost(path, body) {
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`POST ${path} failed (${res.status}): ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data;
}

async function createInsight(name, description, steps) {
  const query = {
    kind: "InsightVizNode",
    source: {
      kind: "FunnelsQuery",
      dateRange: { date_from: "-30d", date_to: null },
      series: steps,
      funnelsFilter: {
        funnelVizType: "steps"
      }
    }
  };

  return apiPost("/insights/", {
    name,
    description,
    tags: ["nextdoor", "ab_test", "homepage_2026_08"],
    query,
  });
}

function pageviewStep(pathname, extraProps = []) {
  return {
    kind: "EventsNode",
    event: "$pageview",
    name: "$pageview",
    properties: [
      { key: "traffic_source", value: "nextdoor", operator: "exact", type: "event" },
      ...extraProps,
    ],
  };
}

function eventStep(event, extraProps = []) {
  return {
    kind: "EventsNode",
    event,
    name: event,
    properties: [
      { key: "traffic_source", value: "nextdoor", operator: "exact", type: "event" },
      ...extraProps,
    ],
  };
}

async function main() {
  const controlInsight = await createInsight(
    "ND Homepage Control Funnel",
    "Nextdoor traffic landing on / (control). Measures: pageview → wizard completed → lead generated.",
    [
      pageviewStep("/", [{ key: "utm_content", value: "control", operator: "exact", type: "event" }]),
      eventStep("wizard_completed"),
      eventStep("generate_lead"),
    ]
  );
  console.log("✅ Created control funnel:", controlInsight.short_id || controlInsight.id);

  const variantInsight = await createInsight(
    "ND Free-Text Variant Funnel",
    "Nextdoor traffic landing on /asks (free_text variant). Measures: pageview → wizard completed → lead generated.",
    [
      pageviewStep("/asks", [{ key: "utm_content", value: "free_text", operator: "exact", type: "event" }]),
      eventStep("wizard_completed"),
      eventStep("generate_lead"),
    ]
  );
  console.log("✅ Created variant funnel:", variantInsight.short_id || variantInsight.id);

  // Create dashboard
  const dashboard = await apiPost("/dashboards/", {
    name: "Nextdoor Homepage A/B Test — Aug 2026",
    description: "Compares control (/) vs free-text (/asks) conversion for Nextdoor paid traffic.",
    filters: { date_from: "-30d" },
  });
  console.log("✅ Created dashboard:", dashboard.short_id || dashboard.id);

  // Add insights to dashboard
  for (const insight of [controlInsight, variantInsight]) {
    await apiPost(`/dashboards/${dashboard.id}/insights/`, {
      insight: insight.id,
    });
  }
  console.log("✅ Added insights to dashboard");
  console.log("");
  console.log("--- URLs ---");
  console.log(`Dashboard: ${HOST}/project/${PROJECT_ID}/dashboard/${dashboard.short_id || dashboard.id}`);
  console.log(`Control funnel: ${HOST}/project/${PROJECT_ID}/insights/${controlInsight.short_id || controlInsight.id}`);
  console.log(`Variant funnel: ${HOST}/project/${PROJECT_ID}/insights/${variantInsight.short_id || variantInsight.id}`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
