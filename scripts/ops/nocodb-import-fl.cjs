#!/usr/bin/env node
/**
 * NocoDB Bulk Import — Florida Facilities (Separate Table)
 *
 * Imports Florida facility records into a dedicated NocoDB table.
 * This script is intentionally separate from sync-noco-to-code.cjs
 * so Florida data never mingles with the Massachusetts table.
 *
 * Env:
 *   NOCODB_API_TOKEN          - Required: NocoDB API token (xc-token)
 *   NOCODB_DASHBOARD_BASE     - Default http://107.172.94.35:8080
 *   NOCODB_PROJECT_ID         - Default pfeipqmy5ybhs71
 *   NOCODB_FLORIDA_TABLE_ID   - Required: Florida table ID (e.g. mss4zkff5ybhs72)
 *   DRY_RUN                   - Set to '1' to preview without writing
 *
 * Usage:
 *   node scripts/ops/nocodb-import-fl.cjs --file .firecrawl/fl-seed/<date>/florida-import.json
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

// ── Configuration ────────────────────────────────────────────────────────────
const API_TOKEN = process.env.NOCODB_API_TOKEN || process.env.NOCODB_API_KEY;
const DASHBOARD_BASE = process.env.NOCODB_DASHBOARD_BASE || "http://23.95.189.106:8080";
const PROJECT_ID = process.env.NOCODB_PROJECT_ID || "pfeipqmy5ybhs71";
const FLORIDA_TABLE_ID = process.env.NOCODB_FLORIDA_TABLE_ID || "mx9i1ecm3jeqetu";
const DRY_RUN = process.env.DRY_RUN === "1";

// ── Args parser ──────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let file = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) file = args[i + 1];
  }
  return { file };
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
function request(method, urlPath, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, DASHBOARD_BASE);
    const isHttps = url.protocol === "https:";
    const client = isHttps ? require("https") : http;

    const headers = {
      "xc-token": API_TOKEN,
      "Content-Type": "application/json",
      ...extraHeaders
    };

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers
    };

    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Field name normalization for NocoDB ──────────────────────────────────────
function toNocoFieldName(key) {
  // NocoDB column IDs are auto-generated; we use Title-based inserts.
  // Convert camelCase / snake_case to human-friendly titles.
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\s+/, "")
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Map facility record to NocoDB row shape ─────────────────────────────────
function mapToNocoRow(record) {
  const row = {};
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith("_")) continue; // skip internal metadata
    const title = toNocoFieldName(key);
    row[title] = value;
  }
  return row;
}

// ── Check/create table ──────────────────────────────────────────────────────
async function ensureTable() {
  try {
    const res = await request("GET", `/api/v1/db/data/noco/${PROJECT_ID}/${FLORIDA_TABLE_ID}?limit=1`);
    if (res.status === 200) {
      console.log(`✅ Florida table ${FLORIDA_TABLE_ID} exists.`);
      return true;
    }
  } catch (e) {
    // Table likely doesn't exist
  }

  console.warn(`⚠️  Florida table ${FLORIDA_TABLE_ID} not found or inaccessible.`);
  console.warn(`   Please create it in NocoDB before importing.`);
  console.warn(`   Suggested columns (auto-created if using NocoDB's Quick Import):`);
  console.warn(`   Name, Slug, Address, County, Phone, Website, About, Care Types,`);
  console.warn(`   Capacity, Amenities, Parent Company, Administrator, License Number,`);
  console.warn(`   Special Programs, Pricing Note, Inspection Date, Overall Status`);
  return false;
}

// ── Import batch ────────────────────────────────────────────────────────────
async function importBatch(records) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would import ${records.length} records to table ${FLORIDA_TABLE_ID}`);
    return { inserted: 0, skipped: records.length };
  }

  let inserted = 0;
  let failed = 0;

  for (const record of records) {
    const row = mapToNocoRow(record);
    try {
      const res = await request(
        "POST",
        `/api/v1/db/data/noco/${PROJECT_ID}/${FLORIDA_TABLE_ID}`,
        row
      );
      if (res.status >= 200 && res.status < 300) {
        inserted++;
        process.stdout.write(`·`);
      } else {
        failed++;
        process.stdout.write(`✗`);
        console.error(`\nFailed to insert ${record.name}:`, res.body?.msg || res.body);
      }
    } catch (e) {
      failed++;
      console.error(`\nError inserting ${record.name}:`, e.message);
    }
  }

  console.log();
  return { inserted, failed };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { file } = parseArgs();

  if (!file) {
    console.error("Usage: node scripts/ops/nocodb-import-fl.cjs --file <path-to-florida-import.json>");
    process.exit(1);
  }

  if (!API_TOKEN) {
    console.error("NOCODB_API_TOKEN (or NOCODB_API_KEY) is required.");
    process.exit(1);
  }

  const importPath = path.resolve(file);
  if (!fs.existsSync(importPath)) {
    console.error(`Import file not found: ${importPath}`);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("📥 NocoDB Import — Florida Facilities");
  console.log("=".repeat(60));
  console.log(`Source file: ${importPath}`);
  console.log(`Target base: ${DASHBOARD_BASE}`);
  console.log(`Project:     ${PROJECT_ID}`);
  console.log(`Table:       ${FLORIDA_TABLE_ID}`);
  console.log(`Dry run:     ${DRY_RUN ? "YES" : "NO"}`);

  const payload = JSON.parse(fs.readFileSync(importPath, "utf8"));
  const records = payload.records || [];
  console.log(`Records to import: ${records.length}\n`);

  if (records.length === 0) {
    console.log("No records found. Exiting.");
    process.exit(0);
  }

  const tableReady = await ensureTable();
  if (!tableReady && !DRY_RUN) {
    console.error("\nAborting: Florida table does not exist in NocoDB.");
    process.exit(1);
  }

  const { inserted, failed } = await importBatch(records);

  console.log(`\n✅ Import complete.`);
  console.log(`   Inserted: ${inserted}`);
  if (failed) console.log(`   Failed:   ${failed}`);

  // Save import log
  const logPath = path.join(path.dirname(importPath), "nocodb-import-log.json");
  fs.writeFileSync(logPath, JSON.stringify({
    importedAt: new Date().toISOString(),
    sourceFile: importPath,
    tableId: FLORIDA_TABLE_ID,
    dryRun: DRY_RUN,
    total: records.length,
    inserted,
    failed
  }, null, 2));
  console.log(`   Log saved: ${logPath}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
