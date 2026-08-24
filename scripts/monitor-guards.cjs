#!/usr/bin/env node
/**
 * Monitor: Critical Guard Scripts Pass/Fail
 * Runs guard-critical-features.mjs and guard-no-second-header.mjs.
 */

const { spawnSync } = require("child_process");
const { fmtTs } = require("./lib/monitor-utils.cjs");

const GUARDS = [
  "scripts/guard-critical-features.mjs",
  "scripts/guard-no-second-header.mjs",
  "scripts/guard-data-quality.mjs",
  "scripts/guard-proprietary-data.mjs",
];

async function check() {
  let allOk = true;
  for (const script of GUARDS) {
    const result = spawnSync("node", [script], {
      encoding: "utf8",
      cwd: "/Users/joshdev/Assistedly.ai",
      timeout: 60000,
    });
    const passed = result.status === 0 && result.stdout.includes("✅");
    if (passed) {
      console.log(`[${fmtTs()}] ✅ ${script}: PASSED`);
    } else {
      console.log(`[${fmtTs()}] ❌ ${script}: FAILED (exit ${result.status})`);
      const lines = (result.stderr || result.stdout || "").split("\n").filter(Boolean).slice(-3);
      lines.forEach(l => console.log(`    > ${l}`));
      allOk = false;
    }
  }
  return allOk;
}

check().then(ok => process.exit(ok ? 0 : 1));
