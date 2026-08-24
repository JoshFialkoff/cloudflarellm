/**
 * Monitor Utilities — Shared helpers for all component health checkers
 * Version: 2026-08-23-v1
 *
 * Design: Each checker script is standalone (exit 0 = OK, exit 1 = FAIL).
 * The orchestrator collects results and sends ONE Discord report for all failures.
 */

const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");
const { homedir } = require("os");
const { postDiscordWebhook, splitDiscordContent } = require("./discord-webhook.cjs");

const STATE_DIR = join(homedir(), ".config", "goose", "monitor-state");

function ensureStateDir() {
  mkdirSync(STATE_DIR, { recursive: true });
}

function loadMonitorState(name) {
  const p = join(STATE_DIR, `${name}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function saveMonitorState(name, state) {
  ensureStateDir();
  writeFileSync(join(STATE_DIR, `${name}.json`), JSON.stringify(state, null, 2));
}

function getWebhookUrl() {
  return String(process.env.DISCORD_MONITOR_ALERT_WEBHOOK_URL || "").trim() ||
    String(process.env.DISCORD_DEPLOY_WEBHOOK_URL || "").trim() ||
    String(process.env.DISCORD_WEBHOOK_URL || "").trim() ||
    "";
}

async function sendDiscordAlert(title, bodyLines) {
  const webhook = getWebhookUrl();
  if (!webhook) {
    console.log("[monitor] No Discord webhook configured — printing only:");
    console.log(`## ${title}\n` + bodyLines.join("\n"));
    return;
  }
  const content = `## 🚨 ${title}\n` + bodyLines.map(l => `- ${l}`).join("\n");
  const chunks = splitDiscordContent(content);
  for (const chunk of chunks) {
    await postDiscordWebhook(webhook, chunk);
  }
}

function fmtTs(d = new Date()) {
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

module.exports = {
  ensureStateDir, loadMonitorState, saveMonitorState,
  getWebhookUrl, sendDiscordAlert, fmtTs,
};
