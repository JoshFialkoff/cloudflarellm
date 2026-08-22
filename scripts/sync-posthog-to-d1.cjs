/**
 * sync-posthog-to-d1.cjs
 *
 * Weekly aggregation pipeline: PostHog events → Cloudflare D1
 *
 * Security:
 *   - POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID are injected via Infisical.
 *     NEVER hardcode secrets in this file.
 *   - All person-identifiable data is discarded at source.
 *     Only anonymous, aggregate facility-level metrics are stored in D1.
 *   - Session IDs are hashed; no email, name, or IP is captured.
 *
 * Usage:
 *   INFISICAL_DOMAIN=https://secrets.assistedly.ai infisical run --env=dev -- node scripts/sync-posthog-to-d1.cjs
 *
 * Or via npm script:
 *   npm run sync:analytics
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Config (env-injected only) ───────────────────────────────────────────
const POSTHOG_HOST = process.env.POSTHOG_HOST || "us.posthog.com";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const D1_DB_NAME = "assistedly-analytics";
const WRANGLER_CONFIG = "wrangler-slot4.toml";

// ── Validation ────────────────────────────────────────────────────────────
if (!POSTHOG_API_KEY) {
  console.error("❌ POSTHOG_PERSONAL_API_KEY is required. Use Infisical to inject it.");
  process.exit(1);
}
if (!POSTHOG_PROJECT_ID) {
  console.error("❌ POSTHOG_PROJECT_ID is required. Use Infisical to inject it.");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function queryPostHogHogQL(sql) {
  const payload = JSON.stringify({
    query: {
      kind: "HogQLQuery",
      query: sql,
    },
    async: false,
  });
  const opts = {
    hostname: POSTHOG_HOST,
    path: `/api/projects/${POSTHOG_PROJECT_ID}/query/`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${POSTHOG_API_KEY}`,
    },
  };
  const { body } = await httpRequest(opts, payload);
  return JSON.parse(body);
}

function hashSessionId(str) {
  // Deterministic hash for anonymous session ID
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

// ── Main pipeline ─────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  console.log(`📊 Aggregating PostHog events: ${sevenDaysAgo} → ${today}`);

  // 1) Fetch facility_search events from last 7 days
  const searchSql = `
    SELECT
      toDate(timestamp) as date,
      properties.city as city,
      properties.radius as radius,
      properties.tax_status as tax_status,
      properties.max_fee as max_fee,
      properties.result_count as result_count,
      properties.has_coords as has_coords,
      properties.chart_source as chart_source,
      person_id,
      count() as event_count
    FROM events
    WHERE event = 'facility_search'
      AND timestamp >= '${sevenDaysAgo}'
      AND timestamp < '${today}'
    GROUP BY date, city, radius, tax_status, max_fee, result_count, has_coords, chart_source, person_id
    ORDER BY date
  `;

  console.log("🔍 Querying facility_search events from PostHog…");
  let searchResults;
  try {
    searchResults = await queryPostHogHogQL(searchSql);
  } catch (e) {
    console.error("❌ PostHog query failed:", e.message);
    process.exit(1);
  }

  if (!searchResults?.results || !Array.isArray(searchResults.results)) {
    console.error("❌ Unexpected PostHog response structure:", JSON.stringify(searchResults).slice(0, 300));
    process.exit(1);
  }

  const rows = searchResults.results;
  console.log(`📥 Retrieved ${rows.length} search session rows from PostHog`);

  if (rows.length === 0) {
    console.log("ℹ️ No facility_search events in the last 7 days. Nothing to sync.");
    process.exit(0);
  }

  // 2) Build insert statements for D1
  const sqlStatements = [];

  // search_sessions inserts
  const seenSessions = new Set();
  for (const row of rows) {
    const sessionHash = hashSessionId(`${row.date}-${row.person_id || 'anon'}-${row.city}-${row.radius}`);
    if (seenSessions.has(sessionHash)) continue;
    seenSessions.add(sessionHash);

    sqlStatements.push(
      `INSERT OR REPLACE INTO search_sessions (
        date, session_id, city, radius_mi, tax_status, max_fee, result_count, has_coords, chart_source
      ) VALUES (
        '${row.date}', '${sessionHash}', ` +
      `${row.city ? "'" + String(row.city).replace(/'/g, "''") + "'" : "NULL"}, ` +
      `${row.radius ?? "NULL"}, ` +
      `${row.tax_status ? "'" + String(row.tax_status).replace(/'/g, "''") + "'" : "NULL"}, ` +
      `${row.max_fee ?? "NULL"}, ` +
      `${row.result_count ?? "NULL"}, ` +
      `${row.has_coords === true || row.has_coords === 'true' || row.has_coords === 1 ? 1 : 0}, ` +
      `${row.chart_source ? "'" + String(row.chart_source).replace(/'/g, "''") + "'" : "NULL"}
      );`
    );
  }

  console.log(`📝 Built ${sqlStatements.length} INSERT statements`);

  // 3) Write SQL batch to temp file and execute via wrangler
  const tmpFile = path.join(__dirname, `../.tmp-d1-analytics-${Date.now()}.sql`);
  fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
  fs.writeFileSync(tmpFile, sqlStatements.join("\n"));

  console.log(`💾 SQL batch written to ${tmpFile}`);
  console.log(`🚀 Executing D1 write via wrangler…`);

  try {
    const cmd = `npx wrangler d1 execute "${D1_DB_NAME}" --remote --file="${tmpFile}" --config "${WRANGLER_CONFIG}"`;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const env = accountId ? { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId } : process.env;
    execSync(cmd, { stdio: "inherit", env });
    console.log("✅ D1 sync completed successfully");
  } catch (e) {
    console.error("❌ D1 execute failed:", e.message);
    process.exit(1);
  } finally {
    // Cleanup temp file
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }

  console.log("🎉 Analytics sync complete.");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
