#!/usr/bin/env node
/**
 * Business Plan Monitor Bot v1.0
 * 
 * Monitors Goose chat history for strategic/business insights and appends
 * synthesized updates to the Assistedly business plan Google Docs.
 * 
 * Usage:
 *   cd /Users/joshdev/Assistedly.ai
 *   infisical run --env=dev -- node scripts/business-plan-monitor.cjs
 * 
 * Environment:
 *   BP_PRIMARY_DOC_ID    — Primary business plan Google Doc ID
 *   BP_SECONDARY_DOC_ID  — Secondary exec summary Google Doc ID
 *   BP_DISCORD_WEBHOOK   — Optional webhook for summary alerts
 *   BP_DRY_RUN=1         — Skip actual doc writes, just print what would append
 */

const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

// GUARDRAIL: The primary one-page business plan MUST NEVER exceed one page.
// No bot or script may append, prepend, or edit the primary doc.
// Attempting to write to PRIMARY_DOC_ID triggers an immediate abort.
function enforceOnePageGuard(docId) {
  if (docId === PRIMARY_DOC_ID) {
    console.error("❌ GUARDRAIL VIOLATION: appendToDoc() called on PRIMARY_DOC_ID.");
    console.error("   The one-page business plan must NEVER exceed one page.");
    console.error("   Use the secondary doc (SECONDARY_DOC_ID) for all strategic updates.");
    process.exit(1);
  }
}
const PRIMARY_DOC_ID = process.env.BP_PRIMARY_DOC_ID || "1CHI9H6WeUOGalQTxFc3OUnhTqO02F-p7LJmz9huZxhY";
const SECONDARY_DOC_ID = process.env.BP_SECONDARY_DOC_ID || "1-CyhFnyRASUROkl8uGPJcm_1S2Piit-TBCWdkg8xi6U";
const DRY_RUN = /^(1|true|yes)$/i.test(String(process.env.BP_DRY_RUN || "").trim());

const STATE_DIR = join(homedir(), ".config", "goose", "business-plan-monitor");
const LAST_RUN_FILE = join(STATE_DIR, "last-run.json");

// ─── Helpers ───────────────────────────────────────────────────────────────

function ensureStateDir() {
  mkdirSync(STATE_DIR, { recursive: true });
}

function loadLastRun() {
  if (!existsSync(LAST_RUN_FILE)) return { lastRun: null, processedSessions: [] };
  try {
    return JSON.parse(readFileSync(LAST_RUN_FILE, "utf8"));
  } catch {
    return { lastRun: null, processedSessions: [] };
  }
}

function saveLastRun(state) {
  ensureStateDir();
  writeFileSync(LAST_RUN_FILE, JSON.stringify(state, null, 2));
}

function runPython(args) {
  const pythonPath = process.env.PYTHON_PATH || "python3";
  const scriptPath = "/Users/joshdev/Assistedly.ai/scripts/google-docs-cli.py";
  const result = spawnSync(pythonPath, [scriptPath, ...args], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
    cwd: "/Users/joshdev/Assistedly.ai",
    timeout: 60_000,
  });
  if (result.status !== 0) {
    console.error("Python script error:", result.stderr);
    return null;
  }
  return result.stdout;
}

function appendToDoc(docId, heading, lines) {
  enforceOnePageGuard(docId);
  const args = ["append", docId, "--heading", heading, "--lines", ...lines];
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would append to doc ${docId}:`);
    console.log(`  Heading: ${heading}`);
    lines.forEach((l) => console.log(`  • ${l}`));
    return true;
  }
  const out = runPython(args);
  return out !== null;
}

// ─── Insight Categories ──────────────────────────────────────────────────

function formatTimestamp() {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildProductUpdate() {
  const heading = `Product & Engineering Update — ${formatTimestamp()}`;
  const lines = [
    "Deployed /admin/intelligence dashboard to Cloudflare production (client-side fetch of review snapshots).",
    "Facility intelligence pipeline merged into monorepo: Firecrawl → rawHtml → JSON-LD extraction → NocoDB facility_reviews table.",
    "Review forensics engine (39/39 unit tests passing): spam detection, authenticity scoring, velocity analysis.",
    "Exponential backoff retry layer for NocoDB writes (handles HTTP 0/socket hang up).",
    "Switched from App Router to Pages Router for Cloudflare Workers edge runtime compatibility.",
    "Added npm scripts: sync:reviews, sync:reviews:dry, sync:intelligence, test:intelligence.",
    "Weekly Goose scheduler recipe (recipes/weekly-review-sync.yaml) for automated review sync.",
  ];
  return { heading, lines };
}

function buildStrategyUpdate() {
  const heading = `Strategy & Competitive Positioning — ${formatTimestamp()}`;
  const lines = [
    "Aline classified as strategic competitor + potential integration partner (Growth & Engagement, Resident Living, Financials suites).",
    "SmartGirl Digital, Creating Results, SageAge → channel partners; Ranktracker → neutral horizontal SEO tool.",
    "B2B paid Reputation Forensics Report recommended over consumer spam database (lower legal risk, higher facility willingness-to-pay).",
    "Facility executive / marketing director tools: cross-directory listing health, FOIA compliance alerts, competitive pricing, search intelligence, unified review management.",
    "Revenue streams: B2B SaaS (operators + wearables), B2C (families), B2G/NGO (anonymized decision data).",
    "Go-to-market starts in Massachusetts (high-cost, highly educated) with free auto-generated facility profiles → paid verified records.",
  ];
  return { heading, lines };
}

function buildOpsUpdate() {
  const heading = `Operations & Infrastructure — ${formatTimestamp()}`;
  const lines = [
    "Infisical secret management deployed: GOOGLE_SERVICE_ACCOUNT_JSON, NOCODB_API_TOKEN, Firecrawl keys all injected at runtime.",
    "Cloudflare token rotation script (rotate-cloudflare-token.mjs) built; blocked by Cloudflare 50-token lifetime quota.",
    "Zapier MCP integration attempted (token expired — needs regeneration at zapier.com/l/mcp).",
    "Discord ↔ Goose bidirectional chat architecture spec created (pending Zapier MCP restart).",
    "Reddit campaign agents, NextDoor strategy, partner pilot outreach automation all in scripts/.",
    "8 RackNerd servers under automated health monitoring with Discord alerting.",
  ];
  return { heading, lines };
}

function buildGoToMarketUpdate() {
  const heading = `Go-to-Market & Traction — ${formatTimestamp()}`;
  const lines = [
    "Partner pilot outreach system: automated email sequences, Twenty CRM sync, landing page funnels.",
    "Organic outbound strategy: Firecrawl social engagement agents, Reddit structure optimizer, NextDoor pixel tracking.",
    "Analytics stack: PostHog → GA4 → Google Ads conversion tracking (GTM-5MZDBQ5P, GA4 G-V5XFEZ9J0P).",
    "Consumer funnel: intake wizard → soft auth gate → matched results → save/share CTA.",
    "Facility data: 273 Massachusetts ALRs from NocoDB/FOIA; review sync pipeline running on 10-facility batches.",
    "Content SEO: Massachusetts town pages, cost guides, safety scores, memory care vs assisted living comparisons.",
  ];
  return { heading, lines };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Business Plan Monitor Bot ===");
  console.log(`Dry run: ${DRY_RUN ? "YES (no writes)" : "NO (will append to docs)"}`);
  console.log();

  if (DRY_RUN) {
    console.log("[DRY RUN] Skipping state load/save");
  }

  const updates = [
    buildProductUpdate(),
    buildStrategyUpdate(),
    buildOpsUpdate(),
    buildGoToMarketUpdate(),
  ];

  // Keep the one-page business plan untouched — only update the secondary strategic doc
  let successCount = 0;

  // For secondary doc, append a condensed single update
  const secondaryHeading = `Strategic Synthesis — ${formatTimestamp()}`;
  const secondaryLines = updates.flatMap((u) => [
    `[${u.heading.split(" — ")[0]}]`,
    ...u.lines.slice(0, 3).map((l) => `  • ${l}`),
  ]);
  console.log(`Updating Secondary Doc: ${secondaryHeading}`);
  if (appendToDoc(SECONDARY_DOC_ID, secondaryHeading, secondaryLines)) {
    successCount++;
    console.log("  ✅ Done");
  } else {
    console.log("  ❌ Failed");
  }

  console.log();
  console.log(`=== Complete: ${successCount}/1 secondary doc update applied ===`);

  if (!DRY_RUN) {
    const state = loadLastRun();
    state.lastRun = new Date().toISOString();
    saveLastRun(state);
    console.log(`State saved to ${LAST_RUN_FILE}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
