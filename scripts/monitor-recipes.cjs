#!/usr/bin/env node
/**
 * Monitor: Scheduled Recipe Execution Freshness
 * Checks state files written by monitors/recipes to ensure they ran recently.
 */

const { fmtTs, loadMonitorState, ensureStateDir } = require("./lib/monitor-utils.cjs");

const RECIPES = [
  { name: "weekly-facility-sync", maxAgeHours: 192 },
  { name: "weekly-review-sync", maxAgeHours: 192 },
  { name: "business-plan-monitor", maxAgeHours: 192 },
  { name: "bot-fleet-health-check", maxAgeHours: 48 },
];

async function check() {
  ensureStateDir();
  let allOk = true;
  for (const recipe of RECIPES) {
    const state = loadMonitorState(recipe.name);
    if (!state || !state.lastRun) {
      console.log(`[${fmtTs()}] ❌ ${recipe.name}: No execution state found`);
      allOk = false;
      continue;
    }
    const ageMs = Date.now() - new Date(state.lastRun).getTime();
    const ageHours = ageMs / 3600000;
    if (ageHours > recipe.maxAgeHours) {
      console.log(`[${fmtTs()}] ❌ ${recipe.name}: Last run ${ageHours.toFixed(1)}h ago (>${recipe.maxAgeHours}h)`);
      allOk = false;
    } else {
      console.log(`[${fmtTs()}] ✅ ${recipe.name}: Last run ${ageHours.toFixed(1)}h ago`);
    }
  }
  return allOk;
}

check().then(ok => process.exit(ok ? 0 : 1));
