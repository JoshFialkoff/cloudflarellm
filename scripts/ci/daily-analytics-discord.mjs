#!/usr/bin/env node
/**
 * Daily PostHog analytics digest → Discord (6 AM Eastern target delivery).
 *
 * Required env:
 *   POSTHOG_API_KEY
 *   POSTHOG_PROJECT_ID
 *
 * Optional:
 *   POSTHOG_HOST — default https://us.posthog.com
 *   DAILY_ANALYTICS_LOOKBACK_HOURS — default 24
 *   DAILY_ANALYTICS_URGENCY_THRESHOLD — default 50 (next-best-step heuristic)
 *   DAILY_ANALYTICS_VIDEO_DURATION_THRESHOLD_SEC — default 10
 *   DISCORD_DAILY_ANALYTICS_WEBHOOK_URL — preferred webhook for this report
 *   DISCORD_GITHUB_UPDATES_WEBHOOK_URL — fallback
 *   DISCORD_WEBHOOK_URL — local dev fallback (same as Reddit/social agents)
 *   DISCORD_DEPLOY_WEBHOOK_URL — legacy fallback
 *   DAILY_ANALYTICS_DISCORD_SKIP=1 — stdout only, no Discord POST
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { postDiscordWebhook, splitDiscordContent } = require("../lib/discord-webhook.cjs");

const host = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/+$/, "");
const apiKey = String(process.env.POSTHOG_API_KEY || "").trim();
const projectId = String(process.env.POSTHOG_PROJECT_ID || "").trim();
const lookbackHours = Math.min(
  168,
  Math.max(1, Number.parseInt(process.env.DAILY_ANALYTICS_LOOKBACK_HOURS || "24", 10) || 24)
);
const urgencyThreshold = Math.max(
  0,
  Number.parseInt(process.env.DAILY_ANALYTICS_URGENCY_THRESHOLD || "50", 10) || 50
);
const videoDurationThresholdSec = Math.max(
  0,
  Number.parseInt(process.env.DAILY_ANALYTICS_VIDEO_DURATION_THRESHOLD_SEC || "10", 10) || 10
);
const skipDiscord = /^(1|true|yes)$/i.test(String(process.env.DAILY_ANALYTICS_DISCORD_SKIP || "").trim());

const webhook =
  String(process.env.DISCORD_DAILY_ANALYTICS_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_GITHUB_UPDATES_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_DEPLOY_WEBHOOK_URL || "").trim() ||
  "";

const TYPEBOT_PLAYER_URGENCY_STEP_ID = "wf89z6xtdnqv411kqnshkbp7";

const URGENCY_FILTER = `
  (
    properties.step_id = 'urgency'
    OR properties.step_id = '${TYPEBOT_PLAYER_URGENCY_STEP_ID}'
    OR properties.question_label = 'urgency_question'
  )
`;

const VIDEO_PLAY_FILTER = `
  (
    event = 'landing_hero_video_play'
    OR (event = 'video_play' AND properties.video_name = 'homepage-founder')
  )
`;

const VIDEO_PROGRESS_FILTER = `
  event IN ('video_progress', 'landing_hero_video_progress')
  AND (
    properties.video_name = 'homepage-founder'
    OR properties.video_id = '6f4i0VEgFWI'
  )
`;

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

function formatOtherQuestions(rows) {
  if (!rows.length) return "None";
  return rows
    .map(([label, count]) => `${label || "unknown"}: ${Number(count ?? 0)}`)
    .join(", ");
}

function pickRecommendation({ urgencyCount, otherCounts, videoPlays, avgDurationSec, hasProgressData }) {
  if (hasProgressData && avgDurationSec < videoDurationThresholdSec && videoPlays > 0) {
    return "Improve video hook — add a compelling first 5 seconds.";
  }
  if (urgencyCount < urgencyThreshold) {
    return "Test a shorter, clearer version of the urgency question.";
  }
  if (Object.keys(otherCounts).length > 0) {
    return "Ensure users flow from urgency question to next step — add a micro-CTA after the question.";
  }
  return "Run an A/B test on the bot's first question to increase answer rates.";
}

function formatReportDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildMessage({ urgencyCount, otherRows, videoPlays, avgDurationSec, hasProgressData, recommendation }) {
  const otherLine = formatOtherQuestions(otherRows);
  const durationLine = hasProgressData
    ? `${Math.round(avgDurationSec)} seconds`
    : "N/A (no video_progress events in window)";

  return [
    `📊 **Daily Analytics Report** | ${formatReportDate()}`,
    "",
    `**Urgency Question Responses:** ${urgencyCount} responses`,
    `**Other Questions Answered:** ${otherLine}`,
    "",
    `**Founder Message Views:** ${videoPlays} plays`,
    `**Average View Duration:** ${durationLine}`,
    "",
    `✅ **Next Best Step:** ${recommendation}`,
  ].join("\n");
}

async function main() {
  if (!apiKey || !projectId) {
    process.stderr.write("Missing POSTHOG_API_KEY or POSTHOG_PROJECT_ID\n");
    process.exit(1);
  }

  const intervalClause = `timestamp >= now() - INTERVAL ${lookbackHours} HOUR`;

  const urgencyRows = await runHogQL(`
    SELECT count() AS cnt
    FROM events
    WHERE event = 'typebot_question_answered'
      AND ${intervalClause}
      AND ${URGENCY_FILTER}
  `);
  const urgencyCount = Number(urgencyRows[0]?.[0] ?? 0);

  const otherRows = await runHogQL(`
    SELECT
      coalesce(
        nullIf(toString(properties.step_id), ''),
        nullIf(toString(properties.question_label), ''),
        'unknown'
      ) AS label,
      count() AS cnt
    FROM events
    WHERE event = 'typebot_question_answered'
      AND ${intervalClause}
      AND NOT ${URGENCY_FILTER}
    GROUP BY label
    ORDER BY cnt DESC
    LIMIT 20
  `);

  const videoPlayRows = await runHogQL(`
    SELECT count() AS cnt
    FROM events
    WHERE ${intervalClause}
      AND ${VIDEO_PLAY_FILTER}
  `);
  const videoPlays = Number(videoPlayRows[0]?.[0] ?? 0);

  const progressRows = await runHogQL(`
    SELECT
      toString(properties.$session_id) AS session_id,
      max(toFloat(coalesce(properties.current_time, 0))) AS max_time
    FROM events
    WHERE ${intervalClause}
      AND ${VIDEO_PROGRESS_FILTER}
    GROUP BY session_id
    HAVING session_id != '' AND session_id != 'null'
  `);

  const hasProgressData = progressRows.length > 0;
  let avgDurationSec = 0;
  if (hasProgressData) {
    const maxTimes = progressRows.map((row) => Number(row[1] ?? 0)).filter((n) => Number.isFinite(n) && n > 0);
    if (maxTimes.length) {
      avgDurationSec = maxTimes.reduce((a, b) => a + b, 0) / maxTimes.length;
    }
  }

  const otherCounts = Object.fromEntries(
    otherRows.map(([label, count]) => [String(label ?? "unknown"), Number(count ?? 0)])
  );

  const recommendation = pickRecommendation({
    urgencyCount,
    otherCounts,
    videoPlays,
    avgDurationSec,
    hasProgressData,
  });

  const message = buildMessage({
    urgencyCount,
    otherRows,
    videoPlays,
    avgDurationSec,
    hasProgressData,
    recommendation,
  });

  process.stdout.write(`${message}\n`);

  if (skipDiscord) {
    process.stderr.write("\nDAILY_ANALYTICS_DISCORD_SKIP set — not posting to Discord.\n");
    return;
  }
  if (!webhook) {
    process.stderr.write(
      "\nNo Discord webhook (set DISCORD_DAILY_ANALYTICS_WEBHOOK_URL, DISCORD_GITHUB_UPDATES_WEBHOOK_URL, DISCORD_WEBHOOK_URL, or DISCORD_DEPLOY_WEBHOOK_URL).\n"
    );
    process.exit(0);
  }

  for (const chunk of splitDiscordContent(message)) {
    await postDiscordWebhook(webhook, chunk);
  }
  process.stderr.write("\nPosted daily analytics report to Discord.\n");
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(1);
});
