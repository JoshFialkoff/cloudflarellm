#!/usr/bin/env node
/**
 * Monitor: NocoDB Read + Write Health
 * Exits 0 if tables are listable, 1 if not.
 */

const { fmtTs } = require("./lib/monitor-utils.cjs");

async function check() {
  const token = process.env.NOCODB_API_TOKEN || "";
  const baseUrl = process.env.NOCODB_URL || "http://23.95.189.106:8080";
  const baseId = process.env.NOCODB_BASE_ID || "pfeipqmy5ybhs71";

  if (!token) {
    console.log(`[${fmtTs()}] ❌ Missing NOCODB_API_TOKEN`);
    return false;
  }

  try {
    const listRes = await fetch(`${baseUrl}/api/v1/db/meta/projects/${baseId}/tables`, {
      headers: { "xc-auth": token },
      signal: AbortSignal.timeout(10000),
    });
    if (!listRes.ok) {
      console.log(`[${fmtTs()}] ❌ NocoDB list tables failed: HTTP ${listRes.status}`);
      return false;
    }
    const tables = await listRes.json();
    const tableNames = (tables.list || []).map(t => t.title);
    const expected = ["facility_listings", "facility_reviews_deep", "facility_forensics"];
    const missing = expected.filter(e => !tableNames.includes(e));

    if (missing.length > 0) {
      console.log(`[${fmtTs()}] ❌ NocoDB missing tables: ${missing.join(", ")}`);
      return false;
    }

    console.log(`[${fmtTs()}] ✅ NocoDB reachable. Tables: ${tableNames.length} found.`);
    return true;
  } catch (err) {
    console.log(`[${fmtTs()}] ❌ NocoDB unreachable: ${err.message}`);
    return false;
  }
}

check().then(ok => process.exit(ok ? 0 : 1));
