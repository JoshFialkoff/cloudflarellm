#!/usr/bin/env node
/**
 * PostHog error digest → Cursor agent prompt → Discord (updates channel).
 *
 * Fetches grouped $exception counts from PostHog (HogQL), builds a paste-ready
 * Cursor prompt to triage and fix issues, posts to Discord (same webhook chain
 * as other CI updates unless overridden).
 *
 * Required env:
 *   POSTHOG_API_KEY
 *   POSTHOG_PROJECT_ID
 *
 * Optional:
 *   POSTHOG_HOST — default https://us.posthog.com
 *   POSTHOG_ERROR_DIGEST_DAYS — default 7
 *   POSTHOG_ERROR_DIGEST_ORG — display label (e.g. "AI Assisted Living Companion")
 *   POSTHOG_ERROR_TOP_N — default 20
 *   DISCORD_POSTHOG_ERRORS_WEBHOOK_URL — if set, used instead of the chain below
 *   DISCORD_GITHUB_UPDATES_WEBHOOK_URL — preferred updates channel
 *   DISCORD_DEPLOY_WEBHOOK_URL — legacy fallback
 *   POSTHOG_ERRORS_DISCORD_SKIP=1 — print prompt to stdout only, no Discord
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { postDiscordWebhook, splitDiscordContent } = require("./lib/discord-webhook.cjs");

const host = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/+$/, "");
const apiKey = String(process.env.POSTHOG_API_KEY || "").trim();
const projectId = String(process.env.POSTHOG_PROJECT_ID || "").trim();
const days = Math.min(90, Math.max(1, Number.parseInt(process.env.POSTHOG_ERROR_DIGEST_DAYS || "7", 10) || 7));
const topN = Math.min(50, Math.max(5, Number.parseInt(process.env.POSTHOG_ERROR_TOP_N || "20", 10) || 20));
const orgLabel = String(process.env.POSTHOG_ERROR_DIGEST_ORG || "Assistedly (production)").trim();
const skipDiscord = /^(1|true|yes)$/i.test(String(process.env.POSTHOG_ERRORS_DISCORD_SKIP || "").trim());

const webhook =
  String(process.env.DISCORD_POSTHOG_ERRORS_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_GITHUB_UPDATES_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_DEPLOY_WEBHOOK_URL || "").trim() ||
  "";

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

function buildCursorPrompt({ total, rows, uiBase }) {
  const lines = [
    "# Cursor agent brief — PostHog error triage",
    "",
    `Use this repository (Next.js / Assistedly). Organization context: **${orgLabel}**.`,
    "",
    "## Digest",
    `- Window: last **${days}** day(s)`,
    `- Total \`$exception\` events: **${total}**`,
    `- PostHog project: \`${projectId}\` — Error tracking: ${uiBase}/project/${projectId}/error_tracking`,
    "",
    "## Top grouped issues (by volume; investigate highest first)",
    "",
  ];
  let i = 1;
  for (const row of rows) {
    const issueKey = String(row[0] ?? "");
    const cnt = Number(row[1] ?? 0);
    const sampleUrl = String(row[2] ?? "").slice(0, 200);
    const detail = String(row[3] ?? "").replace(/\s+/g, " ").slice(0, 420);
    lines.push(
      `${i}. **${cnt}×** \`${issueKey.slice(0, 180)}\`${sampleUrl ? ` — page: ${sampleUrl}` : ""}${
        detail ? `\n   Preview: ${detail}` : ""
      }`
    );
    i += 1;
  }
  lines.push(
    "",
    "## What to do",
    "1. Map each high-volume group to likely code paths (search for strings, routes, and client boundaries).",
    "2. Implement **minimal** fixes: null checks, error boundaries, API validation, or PostHog capture adjustments as appropriate.",
    "3. Run `npm run lint` and `npm run build`; fix any regressions.",
    "4. Reply with a short summary: root cause per top issue, files changed, and anything to verify in PostHog after deploy.",
    ""
  );
  return lines.join("\n");
}

function buildDiscordHeader(total) {
  return [
    `**PostHog → Cursor** (${orgLabel})`,
    `Weekly-style digest: **${total}** exceptions in the last **${days}** day(s).`,
    `Project \`${projectId}\` — full prompt in thread (split messages).`,
    "",
    "_Paste the following block into a **Cursor Agent** chat on this repo to triage and ship fixes._",
    "",
  ].join("\n");
}

async function main() {
  if (!apiKey || !projectId) {
    process.stderr.write("Missing POSTHOG_API_KEY or POSTHOG_PROJECT_ID\n");
    process.exit(1);
  }

  const uiBase = posthogUiBase();

  const totalRows = await runHogQL(`
    SELECT count() AS total
    FROM events
    WHERE event = '$exception'
      AND timestamp >= now() - INTERVAL ${days} DAY
  `);
  const total = Number(totalRows[0]?.[0] ?? 0);

  const issueRows = await runHogQL(`
    SELECT
      coalesce(
        nullIf(trim(toString(properties.$exception_fingerprint)), ''),
        toString(cityHash64(toString(coalesce(properties.$exception_list, ''))))
      ) AS issue_key,
      count() AS cnt,
      any(properties.$current_url) AS sample_url,
      substring(any(toString(coalesce(properties.$exception_list, ''))), 1, 500) AS detail
    FROM events
    WHERE event = '$exception'
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY issue_key
    ORDER BY cnt DESC
    LIMIT ${topN}
  `);

  const prompt = buildCursorPrompt({ total, rows: issueRows, uiBase });
  process.stdout.write(`${prompt}\n`);

  if (skipDiscord) {
    process.stderr.write("\nPOSTHOG_ERRORS_DISCORD_SKIP set — not posting to Discord.\n");
    return;
  }
  if (!webhook) {
    process.stderr.write(
      "\nNo Discord webhook (set DISCORD_POSTHOG_ERRORS_WEBHOOK_URL, DISCORD_GITHUB_UPDATES_WEBHOOK_URL, or DISCORD_DEPLOY_WEBHOOK_URL).\n"
    );
    process.exit(0);
  }

  const discordBody = `${buildDiscordHeader(total)}\n${prompt}`;
  for (const chunk of splitDiscordContent(discordBody)) {
    await postDiscordWebhook(webhook, chunk);
  }
  process.stderr.write("\nPosted digest + Cursor prompt to Discord.\n");
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(1);
});
