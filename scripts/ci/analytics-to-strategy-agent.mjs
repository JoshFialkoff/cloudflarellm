#!/usr/bin/env node
/**
 * Analytics → Strategy Agent Handoff v1.0
 *
 * Reads a strategy brief JSON (from analytics-insight-monitor.mjs) and either:
 *   1. Posts a concise strategy prompt to Discord for the marketing-strategy-optimizer agent
 *   2. OR triggers the marketing-strategy-optimizer recipe directly via Goose CLI
 *   3. Archives the brief with timestamp
 *
 * Usage:
 *   node scripts/ci/analytics-to-strategy-agent.mjs
 *
 * Environment:
 *   STRATEGY_BRIEF_IN         — path to JSON brief (default /tmp/analytics-strategy-brief.json)
 *   DISCORD_STRATEGY_WEBHOOK_URL  — preferred webhook for strategy prompts
 *   DISCORD_WEBHOOK_URL           — fallback
 *   DISCORD_DAILY_ANALYTICS_WEBHOOK_URL — fallback
 *   STRATEGY_ARCHIVE_DIR          — where to archive briefs (default /tmp/analytics-brief-archive)
 *   GOOSE_RECIPE                  — recipe name to trigger (default marketing-strategy-optimizer)
 *   SKIP_RECIPE_TRIGGER=1       — only post Discord, don't run recipe
 *   SKIP_DISCORD=1                — only run recipe, don't post Discord
 */
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { postDiscordWebhook, splitDiscordContent } = require("../lib/discord-webhook.cjs");

const briefPath = String(process.env.STRATEGY_BRIEF_IN || "/tmp/analytics-strategy-brief.json").trim();
const archiveDir = String(process.env.STRATEGY_ARCHIVE_DIR || "/tmp/analytics-brief-archive").trim();
const gooseRecipe = String(process.env.GOOSE_RECIPE || "marketing-strategy-optimizer").trim();
const skipRecipeTrigger = /^(1|true|yes)$/i.test(String(process.env.SKIP_RECIPE_TRIGGER || "").trim());
const skipDiscord = /^(1|true|yes)$/i.test(String(process.env.SKIP_DISCORD || "").trim());

const webhook =
  String(process.env.DISCORD_STRATEGY_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_WEBHOOK_URL || "").trim() ||
  String(process.env.DISCORD_DAILY_ANALYTICS_WEBHOOK_URL || "").trim() ||
  "";

function formatDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function loadBrief() {
  if (!existsSync(briefPath)) {
    throw new Error(`Brief not found at ${briefPath}`);
  }
  const raw = readFileSync(briefPath, "utf8");
  return JSON.parse(raw);
}

function buildStrategyPrompt(brief) {
  const lines = [
    `🧠 **Analytics → Strategy Handoff** | ${formatDate()}`,
    "",
    `**Source:** Analytics Insight Monitor (${brief.lookbackHours}h lookback)`,
    `**Overall Conversion Rate:** ${(brief.overallConversionRate * 100).toFixed(2)}%`,
    `**Exceptions:** ${brief.exceptionsSummary.total} total`,
    "",
    "**📊 Funnel Snapshot**",
    ...brief.funnel.map((s) => `• ${s.step}: ${s.uniqueUsers} unique users`),
    "",
  ];

  if (brief.anomalies.length) {
    lines.push("**🚨 Detected Anomalies**");
    for (const a of brief.anomalies) {
      const icon = a.severity === "critical" ? "🔴" : a.severity === "warn" ? "🟡" : "🟢";
      lines.push(`${icon} ${a.message}`);
    }
    lines.push("");
  }

  if (brief.experiment && !brief.experiment.isBalanced) {
    lines.push("**⚠️ Experiment Imbalance:**");
    for (const v of brief.experiment.variantDistribution) {
      lines.push(`• ${v.variant}: ${v.users} users`);
    }
    lines.push("");
  }

  if (brief.topLandingPages?.length) {
    lines.push("**🏠 Top Landing Pages**");
    for (const p of brief.topLandingPages.slice(0, 3)) {
      lines.push(`• ${p.path}: ${p.uniqueUsers} users`);
    }
    lines.push("");
  }

  if (brief.recommendedActions?.length) {
    lines.push("**🎯 Recommended Actions (AI-Generated)**");
    for (const action of brief.recommendedActions) {
      lines.push(`[${action.priority.toUpperCase()}] ${action.type}: ${action.action}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("**Request for Strategy Agent:**");
  lines.push(
    `Using the Unbounding Rationality framework, generate 3–5 strategic options to address the highest-priority anomaly or opportunity above. `
  );
  lines.push(
    `For each option: expected impact (1–10), effort (1–10), and the single concrete first step. Focus on conversion-maximizing tactics.`
  );

  return lines.join("\n");
}

function archiveBrief(brief) {
  try {
    mkdirSync(archiveDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${archiveDir}/brief-${stamp}.json`;
    require("node:fs").writeFileSync(path, JSON.stringify(brief, null, 2));
    process.stderr.write(`Archived brief to ${path}\n`);
    return path;
  } catch (e) {
    process.stderr.write(`Archive failed: ${e.message}\n`);
    return null;
  }
}

async function triggerGooseRecipe() {
  // This function attempts to run the Goose recipe CLI if available.
  // Goose CLI scheduling is preferred over direct execution.
  if (skipRecipeTrigger) return null;

  const { spawn } = require("node:child_process");

  return new Promise((resolve) => {
    const child = spawn("goose", ["run", "--recipe", gooseRecipe], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });

    child.on("close", (code) => {
      process.stderr.write(`Goose recipe '${gooseRecipe}' exited ${code}\n`);
      if (code !== 0) {
        process.stderr.write(` stderr: ${stderr.slice(0, 500)}\n`);
      }
      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      process.stderr.write(`Failed to spawn Goose CLI: ${err.message}\n`);
      resolve({ code: -1, error: err.message });
    });

    // Safety timeout
    setTimeout(() => {
      try { child.kill(); } catch {}
      resolve({ code: -2, error: "timeout" });
    }, 120_000);
  });
}

async function main() {
  const brief = loadBrief();
  archiveBrief(brief);

  const prompt = buildStrategyPrompt(brief);
  process.stdout.write(`${prompt}\n`);

  if (!skipDiscord && webhook) {
    for (const chunk of splitDiscordContent(prompt)) {
      await postDiscordWebhook(webhook, chunk);
    }
    process.stderr.write("Posted strategy prompt to Discord.\n");
  } else if (skipDiscord) {
    process.stderr.write("SKIP_DISCORD set — not posting to Discord.\n");
  } else {
    process.stderr.write("No Discord webhook configured.\n");
  }

  if (!skipRecipeTrigger) {
    process.stderr.write(`Attempting to trigger Goose recipe: ${gooseRecipe}\n`);
    const result = await triggerGooseRecipe();
    if (result?.code === -1 || result?.code === -2) {
      process.stderr.write("Goose CLI not available or timed out. Prompt was still posted to Discord.\n");
    }
  }
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(1);
});
