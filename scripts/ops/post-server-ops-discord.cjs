/**
 * Post server-ops requests to Discord. Mutating actions require !!APPROVED in channel.
 *
 * Env (first set wins):
 *   DISCORD_SERVER_OPS_WEBHOOK_URL
 *   DISCORD_STATUS_WEBHOOK_URL
 *   DISCORD_GITHUB_UPDATES_WEBHOOK_URL
 *   DISCORD_DEPLOY_WEBHOOK_URL
 *
 * Usage:
 *   node scripts/ops/post-server-ops-discord.cjs --analysis reports/server-health/<stamp>/analysis.json
 *   node scripts/ops/post-server-ops-discord.cjs --text "message"
 */
const fs = require("fs");
const path = require("path");
const { postDiscordWebhook, splitDiscordContent } = require("../lib/discord-webhook.cjs");
const INVENTORY = require("./server-inventory.json");

function webhookUrl() {
  return (
    String(process.env.DISCORD_SERVER_OPS_WEBHOOK_URL || "").trim() ||
    String(process.env.DISCORD_STATUS_WEBHOOK_URL || "").trim() ||
    String(process.env.DISCORD_GITHUB_UPDATES_WEBHOOK_URL || "").trim() ||
    String(process.env.DISCORD_DEPLOY_WEBHOOK_URL || "").trim()
  );
}

function formatAnalysis(analysis) {
  const lines = [
    "**Server ops report** (read-only scan)",
    `Keystash user: \`${INVENTORY.keystashUsername}\``,
    `Sheet: ${INVENTORY.spreadsheetUrl}`,
    "",
  ];

  for (const s of analysis.servers || []) {
    lines.push(
      `• **${s.ip}**` +
        (s.hostname ? ` (${s.hostname})` : "") +
        ` — ${s.status}` +
        (s.issues ? ` — ${s.issues}` : "") +
        (s.disk_root_pct !== "" ? ` — disk ${s.disk_root_pct}%` : ""),
    );
  }

  const pending = analysis.actionsPendingApproval || [];
  if (pending.length) {
    lines.push("", "**Actions pending Discord approval** (reply with `!!APPROVED`):");
    for (const p of pending) {
      lines.push(`• ${p.ip}: ${p.suggestedAction} (${p.issue})`);
      if (p.rebootWindow?.recommendedUtc) {
        lines.push(`  Window: ${p.rebootWindow.recommendedUtc}`);
      }
    }
  } else {
    lines.push("", "No mutating actions proposed this run.");
  }

  lines.push("", "_No reboots or restarts will run until `!!APPROVED` is posted._");
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const webhook = webhookUrl();
  if (!webhook) {
    console.error(
      "Missing Discord webhook. Set DISCORD_SERVER_OPS_WEBHOOK_URL (or status/deploy fallback).",
    );
    process.exit(1);
  }

  let text = "";
  const analysisIdx = args.indexOf("--analysis");
  if (analysisIdx >= 0) {
    const file = args[analysisIdx + 1];
    const analysis = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
    text = formatAnalysis(analysis);
  } else {
    const textIdx = args.indexOf("--text");
    text = textIdx >= 0 ? args.slice(textIdx + 1).join(" ") : args.join(" ");
  }

  if (!text.trim()) {
    console.error("Usage: --analysis <path> | --text <message>");
    process.exit(1);
  }

  for (const chunk of splitDiscordContent(text)) {
    await postDiscordWebhook(webhook, chunk);
  }
  console.log("Posted to Discord.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
