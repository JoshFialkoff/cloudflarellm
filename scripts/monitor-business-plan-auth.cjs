#!/usr/bin/env node
/**
 * Monitor: Business Plan Monitor Google Doc Auth
 * Verifies service account can write by checking state file for permission errors.
 */

const { existsSync, readFileSync } = require("fs");
const { join } = require("path");
const { fmtTs } = require("./lib/monitor-utils.cjs");

const STATE_FILE = join(__dirname, "../docs/strategic-planning/business-plan-monitor-state.json");

async function check() {
  if (!existsSync(STATE_FILE)) {
    console.log(`[${fmtTs()}] ❌ Business plan monitor state file missing`);
    return false;
  }

  try {
    const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    if (state.permissionError) {
      console.log(`[${fmtTs()}] ❌ Google Doc auth still failing: ${state.permissionError}`);
      console.log(`    Fix: Share docs with ${state.serviceAccountEmail || "the service account"}`);
      return false;
    }
    if (state.generatedAt) {
      const ageHours = (Date.now() - new Date(state.generatedAt).getTime()) / 3600000;
      if (ageHours > 192) {
        console.log(`[${fmtTs()}] ⚠️ Business plan monitor stale: ${ageHours.toFixed(1)}h since last update`);
        return false;
      }
      console.log(`[${fmtTs()}] ✅ Business plan monitor auth OK. Last update: ${ageHours.toFixed(1)}h ago.`);
      return true;
    }
    console.log(`[${fmtTs()}] ❌ Business plan monitor state missing generatedAt`);
    return false;
  } catch {
    console.log(`[${fmtTs()}] ❌ Business plan monitor state file corrupted`);
    return false;
  }
}

check().then(ok => process.exit(ok ? 0 : 1));
