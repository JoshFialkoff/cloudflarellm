#!/usr/bin/env node
/**
 * Lead Submitted Silence Alert
 *
 * Queries PostHog for `lead_submitted` events in the last 24 hours.
 * If count === 0, posts a CRITICAL Discord alert and exits 1.
 *
 * Required env:
 *   POSTHOG_API_KEY — personal API key with query access
 *   POSTHOG_PROJECT_ID — numeric project id
 * Optional:
 *   POSTHOG_HOST — default https://us.posthog.com
 *   DISCORD_LEAD_SILENCE_WEBHOOK_URL — primary webhook for critical alerts
 *   DISCORD_ANALYTICS_WEBHOOK_URL — fallback
 *   DISCORD_DAILY_ANALYTICS_WEBHOOK_URL — fallback
 *   DISCORD_WEBHOOK_URL — fallback
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

let discordWebhookModule;
try {
  discordWebhookModule = require("./lib/discord-webhook.cjs");
} catch {
  discordWebhookModule = require("../lib/discord-webhook.cjs");
}
const { postDiscordWebhook } = discordWebhookModule;

const host = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/+$/, "");
const apiKey = String(process.env.POSTHOG_API_KEY || "").trim();
const projectId = String(process.env.POSTHOG_PROJECT_ID || "").trim();

const webhook =
  String(process.env.DISCORD_LEAD_SILENCE_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_ANALYTICS_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_DAILY_ANALYTICS_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_WEBHOOK_URL || "").trim() ||
  "";

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

async function getLeadSubmittedCount(hours = 24) {
  const rows = await runHogQL(`
    SELECT count() AS cnt
    FROM events
    WHERE event = 'lead_submitted'
      AND timestamp >= now() - INTERVAL ${hours} HOUR
  `);
  return Number(rows[0]?.[0] ?? 0);
}

async function run() {
  if (!apiKey || !projectId) {
    console.error("Missing POSTHOG_API_KEY or POSTHOG_PROJECT_ID");
    process.exit(1);
  }

  const count = await getLeadSubmittedCount(24);
  console.log(`lead_submitted (last 24h): ${count}`);

  if (count === 0) {
    const message = [
      "🚨 **CRITICAL: lead_submitted silence detected**",
      "",
      `Zero \`lead_submitted\` events in the last 24 hours.`,
      "",
      "**Likely causes:**",
      "- PostHog SDK initialization broken (check NEXT_PUBLIC_POSTHOG_KEY / api_host)",
      "- Proxy /api/ph/* failing",
      "- Lead capture flow broken (wizard, ask page, or deep-dive)",
      "",
      `Checked at: ${new Date().toISOString()}`,
    ].join("\n");

    if (webhook) {
      try {
        await postDiscordWebhook(webhook, message);
      } catch (err) {
        console.error("Failed to post Discord alert:", err.message);
      }
    }

    console.error("ALERT: lead_submitted is silent!");
    process.exit(1);
  }

  console.log("OK — leads are flowing.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
