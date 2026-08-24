#!/usr/bin/env node
/**
 * Bot Fleet Health Orchestrator
 * Runs all component health checks. Prints everything. Sends ONE Discord
 * alert only if there are failures.
 *
 * Usage:
 *   INFISICAL_DOMAIN=https://secrets.assistedly.ai infisical run --env=dev -- node scripts/run-all-monitors.cjs
 *
 * Env:
 *   DISCORD_MONITOR_ALERT_WEBHOOK_URL — preferred webhook for failure alerts
 */

const { spawnSync } = require("child_process");
const { saveMonitorState, sendDiscordAlert, fmtTs } = require("./lib/monitor-utils.cjs");

const MONITORS = [
  { name: "cloudflare-worker", script: "scripts/monitor-cloudflare-worker.cjs", critical: true },
  { name: "guards", script: "scripts/monitor-guards.cjs", critical: true },
  { name: "nocodb", script: "scripts/monitor-nocodb.cjs", critical: true },
  { name: "intelligence-pipeline", script: "scripts/monitor-intelligence-pipeline.cjs", critical: false },
  { name: "dataforseo", script: "scripts/monitor-dataforseo.cjs", critical: false },
  { name: "erpnext", script: "scripts/monitor-erpnext.cjs", critical: false },
  { name: "recipe-freshness", script: "scripts/monitor-recipes.cjs", critical: false },
  { name: "business-plan-auth", script: "scripts/monitor-business-plan-auth.cjs", critical: false },
  { name: "analytics-auth", script: "scripts/monitor-analytics-auth.cjs", critical: false },
];

async function runAll() {
  console.log(`\n=== Bot Fleet Health Check — ${fmtTs()} ===\n`);
  const failures = [];

  for (const m of MONITORS) {
    const result = spawnSync("node", [m.script], {
      encoding: "utf8",
      cwd: "/Users/joshdev/Assistedly.ai",
      timeout: 90000,
    });

    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    const passed = result.status === 0;

    console.log(`--- ${m.name} ---`);
    console.log(stdout.trim());
    if (stderr.trim()) console.log(stderr.trim());

    if (!passed) {
      const lines = stdout.split("\n").filter(l => l.includes("❌") || l.includes("⚠️"));
      const detail = lines.length ? lines.join(" | ") : "Check failed";
      failures.push({ name: m.name, detail, critical: m.critical });
    }
  }

  console.log("\n=== Summary ===");
  if (failures.length === 0) {
    console.log(`✅ All ${MONITORS.length} monitors passed. No Discord alert sent.`);
    saveMonitorState("bot-fleet-health-check", { lastRun: new Date().toISOString(), status: "ok", failures: 0 });
    process.exit(0);
  }

  const criticalCount = failures.filter(f => f.critical).length;
  const body = failures.map(f => `[${f.critical ? "CRIT" : "WARN"}] ${f.name}: ${f.detail}`);
  const title = `Bot Fleet Health — ${failures.length} failure(s), ${criticalCount} critical`;

  console.log(`❌ ${title}`);
  failures.forEach(f => console.log(`  - [${f.critical ? "CRIT" : "WARN"}] ${f.name}: ${f.detail}`));

  await sendDiscordAlert(title, body);
  saveMonitorState("bot-fleet-health-check", { lastRun: new Date().toISOString(), status: "fail", failures });
  process.exit(1);
}

runAll().catch(err => {
  console.error("Orchestrator crashed:", err.message);
  process.exit(2);
});
