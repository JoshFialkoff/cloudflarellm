#!/usr/bin/env node
/**
 * Monitor: Intelligence Pipeline Execution Health
 * Checks that snapshots exist and are < 48h old.
 */

const { existsSync, readdirSync, statSync, readFileSync } = require("fs");
const { join } = require("path");
const { fmtTs } = require("./lib/monitor-utils.cjs");

const SNAPSHOT_DIR = join(__dirname, "../public/data/intelligence-snapshots");
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

async function check() {
  if (!existsSync(SNAPSHOT_DIR)) {
    console.log(`[${fmtTs()}] ❌ Snapshot dir missing: ${SNAPSHOT_DIR}`);
    return false;
  }

  const files = readdirSync(SNAPSHOT_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => ({ name: f, mtime: statSync(join(SNAPSHOT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    console.log(`[${fmtTs()}] ❌ No intelligence snapshots found`);
    return false;
  }

  const latest = files[0];
  const ageMs = Date.now() - latest.mtime;
  const ageHours = (ageMs / 3600000).toFixed(1);

  if (ageMs > MAX_AGE_MS) {
    console.log(`[${fmtTs()}] ❌ Latest intelligence snapshot is ${ageHours}h old (>48h). File: ${latest.name}`);
    return false;
  }

  try {
    const data = JSON.parse(readFileSync(join(SNAPSHOT_DIR, latest.name), "utf8"));
    const facCount = data?.data?.length || data?.facilities?.length || 0;
    if (facCount === 0) {
      console.log(`[${fmtTs()}] ❌ Latest snapshot has 0 facilities`);
      return false;
    }
    console.log(`[${fmtTs()}] ✅ Intelligence pipeline healthy. Latest: ${latest.name}, ${facCount} facilities, ${ageHours}h old.`);
    return true;
  } catch {
    console.log(`[${fmtTs()}] ❌ Latest snapshot is corrupted: ${latest.name}`);
    return false;
  }
}

check().then(ok => process.exit(ok ? 0 : 1));
