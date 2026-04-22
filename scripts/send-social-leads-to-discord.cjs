#!/usr/bin/env node
/**
 * Send top social engagement leads to Discord.
 *
 * Required env:
 * - DISCORD_WEBHOOK_URL
 *
 * Optional env:
 * - SOCIAL_DISCORD_MIN_POSTS (default: 2)
 * - SOCIAL_DISCORD_MAX_POSTS (default: 3)
 * - SOCIAL_REPORT_PATH (absolute/relative path to report JSON)
 */
const fs = require("fs");
const path = require("path");

const { postDiscordWebhook } = require("./lib/discord-webhook.cjs");

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const MIN_POSTS = Number.parseInt(process.env.SOCIAL_DISCORD_MIN_POSTS || "2", 10);
const MAX_POSTS = Number.parseInt(process.env.SOCIAL_DISCORD_MAX_POSTS || "3", 10);
const REPORT_PATH = process.env.SOCIAL_REPORT_PATH || "";

if (!WEBHOOK_URL) {
  // eslint-disable-next-line no-console
  console.error("Missing DISCORD_WEBHOOK_URL");
  process.exit(1);
}

function latestSocialReportPath() {
  const reportsDir = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsDir)) return null;
  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.startsWith("social-engagement-agent-") && f.endsWith(".json"))
    .map((f) => ({
      name: f,
      fullPath: path.join(reportsDir, f),
      mtimeMs: fs.statSync(path.join(reportsDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]?.fullPath || null;
}

function clampPostCount(total) {
  const low = Number.isFinite(MIN_POSTS) ? Math.max(1, MIN_POSTS) : 2;
  const high = Number.isFinite(MAX_POSTS) ? Math.max(low, MAX_POSTS) : 3;
  return Math.max(low, Math.min(high, total));
}

function truncate(text, len) {
  const t = typeof text === "string" ? text.trim() : "";
  if (t.length <= len) return t;
  return `${t.slice(0, len - 3)}...`;
}

async function main() {
  const filePath = REPORT_PATH || latestSocialReportPath();
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("No social engagement report found. Run `npm run agent:social` first.");
  }

  const report = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const leads = Array.isArray(report?.top_opportunities) ? report.top_opportunities : [];
  if (!leads.length) {
    throw new Error("Report has no opportunities to send.");
  }

  const postCount = clampPostCount(leads.length);
  const selected = leads.slice(0, postCount);

  const header = [
    `Daily Social Leads (${postCount})`,
    `Generated: ${report.generated_at || "unknown"}`,
    "",
  ].join("\n");

  const blocks = selected.map((lead, idx) => {
    const reply = truncate(lead.suggested_reply || "No customized reply generated.", 350);
    return [
      `${idx + 1}) ${lead.platform || "social"} | Priority ${lead.priority_score ?? "n/a"}/10`,
      `${lead.post_url || "no-url"}`,
      `Reply now: ${lead.one_click_reply_link || lead.post_url || "no-link"}`,
      `Draft reply: ${reply}`,
    ].join("\n");
  });

  // Discord content hard limit is 2000 chars; split into multiple messages safely.
  let chunk = header;
  const payloads = [];
  for (const block of blocks) {
    const candidate = `${chunk}\n${block}\n`;
    if (candidate.length > 1900) {
      payloads.push(chunk);
      chunk = block;
    } else {
      chunk = candidate;
    }
  }
  if (chunk.trim()) payloads.push(chunk);

  for (const message of payloads) {
    await postDiscordWebhook(WEBHOOK_URL, message);
  }

  // eslint-disable-next-line no-console
  console.log(`Sent ${selected.length} lead(s) to Discord from: ${filePath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error.message || error);
  process.exit(1);
});
