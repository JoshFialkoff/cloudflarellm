#!/usr/bin/env node
/**
 * Cron entry point for behavior-triggered email journeys.
 * Runs all three journeys: abandoned wizard, shortlist nudge, facility follow-up.
 *
 * Schedule via existing cron/launchd or:
 *   node scripts/run-behavior-email-journeys.mjs
 *
 * Env:
 *   BEHAVIOR_EMAILS_ENABLED=true
 *   BEHAVIOR_EMAIL_LOOKBACK_HOURS=72
 *   BEHAVIOR_EMAIL_COOLDOWN_DAYS=14
 *   BEHAVIOR_EMAIL_MAX_PER_USER=3
 */

import { runAllBehaviorJourneys } from '../lib/behaviorEmailJourneys.js';

async function main() {
  console.log(`[${new Date().toISOString()}] Starting behavior email journeys…`);
  try {
    await runAllBehaviorJourneys();
    console.log(`[${new Date().toISOString()}] Done.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Journey run failed:`, err);
    process.exitCode = 1;
  }
}

main();
