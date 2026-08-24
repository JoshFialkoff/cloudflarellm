#!/usr/bin/env node
/**
 * Monitor: Analytics Auth Self-Heal Bot
 *
 * Detects missing analytics auth configuration and auto-heals by:
 * 1. Checking if GA4_PROPERTY_ID is present in env (Infisical)
 * 2. Checking if analytics-insight-monitor.mjs has a hardcoded fallback
 * 3. Patching the fallback if needed (using known values from sibling scripts)
 * 4. Reporting status to Discord
 *
 * Usage:
 *   INFISICAL_DOMAIN=https://secrets.assistedly.ai infisical run --env=dev -- node scripts/monitor-analytics-auth.cjs
 *
 * Exit: 0 = all good, 1 = issue fixed or still broken
 */

const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");
const { sendDiscordAlert, fmtTs } = require("./lib/monitor-utils.cjs");

const MONITOR_PATH = join(__dirname, "ci", "analytics-insight-monitor.mjs");
const KNOWN_FALLBACK = '470773585';

function checkEnv(key) {
  return Boolean(String(process.env[key] || "").trim());
}

function readMonitorSource() {
  try { return readFileSync(MONITOR_PATH, "utf8"); }
  catch (e) { return null; }
}

function hasFallback(source, fallback) {
  // Accept either numeric fallback or the full properties/ prefix
  return source.includes(`|| "${fallback}"`) || source.includes(`|| '${fallback}'`) ||
         source.includes(`|| "properties/${fallback}"`) || source.includes(`|| 'properties/${fallback}'`);
}

function patchFallback(source, fallback) {
  // Replace: process.env.GA4_PROPERTY_ID || ""  with  process.env.GA4_PROPERTY_ID || "properties/470773585"
  return source.replace(
    /process\.env\.GA4_PROPERTY_ID \|\| ""/g,
    `process.env.GA4_PROPERTY_ID || "${fallback}"`
  );
}

async function main() {
  const problems = [];
  const fixes = [];

  const ga4IdOk = checkEnv("GA4_PROPERTY_ID");
  const ga4SaOk = checkEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  const ga4CredOk = checkEnv("GOOGLE_APPLICATION_CREDENTIALS");

  console.log(`[${fmtTs()}] Analytics Auth Check`);
  console.log(`  GA4_PROPERTY_ID: ${ga4IdOk ? "✅" : "❌ missing"}`);
  console.log(`  GOOGLE_SERVICE_ACCOUNT_JSON: ${ga4SaOk ? "✅" : "❌ missing"}`);
  console.log(`  GOOGLE_APPLICATION_CREDENTIALS: ${ga4CredOk ? "✅" : "❌ missing (fallback OK if GOOGLE_SERVICE_ACCOUNT_JSON present)"}`);

  if (!ga4IdOk && !ga4SaOk) {
    problems.push("GA4 completely unconfigured — both GA4_PROPERTY_ID and GOOGLE_SERVICE_ACCOUNT_JSON missing");
  } else if (!ga4IdOk && ga4SaOk) {
    problems.push("GA4_PROPERTY_ID missing from env — monitor will rely on hardcoded fallback");
  }

  const source = readMonitorSource();
  if (!source) {
    problems.push("Cannot read analytics-insight-monitor.mjs");
  } else {
    const fallbackOk = hasFallback(source, KNOWN_FALLBACK);
    if (!fallbackOk) {
      problems.push("analytics-insight-monitor.mjs lacks GA4_PROPERTY_ID fallback");
      const fixed = patchFallback(source, KNOWN_FALLBACK);
      if (fixed !== source) {
        writeFileSync(MONITOR_PATH, fixed, "utf8");
        fixes.push(`Patched analytics-insight-monitor.mjs with fallback "${KNOWN_FALLBACK}"`);
        console.log(`  ✅ Patched fallback into ${MONITOR_PATH}`);
      } else {
        problems.push("Patch attempted but source unchanged — manual fix required");
      }
    } else {
      console.log(`  ✅ Fallback ${KNOWN_FALLBACK} already present`);
    }
  }

  if (fixes.length > 0) {
    const title = "Analytics Auth Self-Heal Bot — issues fixed";
    await sendDiscordAlert(title, [
      ...fixes,
      "Verify by running: npm run ci:analytics:weekly",
    ]);
  }

  const critical = problems.filter(p => !p.includes("will rely on hardcoded fallback"));
  if (critical.length > 0) {
    console.log(`\n[${fmtTs()}] ❌ ${critical.length} critical problem(s) remain:`);
    critical.forEach(p => console.log(`  - ${p}`));
    process.exit(1);
  }

  if (problems.length > 0) {
    console.log(`\n[${fmtTs()}] ⚠️ ${problems.length} warning(s):`);
    problems.forEach(p => console.log(`  - ${p}`));
  }

  console.log(`[${fmtTs()}] ✅ All analytics auth checks passed.`);
  process.exit(0);
}

main().catch(err => {
  console.error("Analytics auth monitor crashed:", err.message);
  process.exit(2);
});
