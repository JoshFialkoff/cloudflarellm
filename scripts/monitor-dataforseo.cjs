#!/usr/bin/env node
/**
 * Monitor: DataForSEO API Health
 * Exits 0 if API returns valid response, 1 if 401/403/expired.
 */

const { fmtTs } = require("./lib/monitor-utils.cjs");

async function check() {
  const login = process.env.DATAFORSEO_LOGIN || "";
  const password = process.env.DATAFORSEO_PASSWORD || "";
  if (!login || !password) {
    console.log(`[${fmtTs()}] ❌ Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD env vars`);
    return false;
  }

  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  try {
    const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/task_post", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{
        keyword: "assisted living massachusetts",
        location_code: 2840,
        language_code: "en",
      }]),
      signal: AbortSignal.timeout(15000),
    });

    const body = await res.json().catch(() => ({}));
    const statusCode = body?.status_code || res.status;

    if (statusCode === 40100) {
      console.log(`[${fmtTs()}] ❌ DataForSEO 40100 — credentials invalid / account suspended / password changed`);
      return false;
    }
    if (statusCode === 20000) {
      console.log(`[${fmtTs()}] ✅ DataForSEO API healthy`);
      return true;
    }
    console.log(`[${fmtTs()}] ⚠️ DataForSEO returned status_code=${statusCode}`);
    return false;
  } catch (err) {
    console.log(`[${fmtTs()}] ❌ DataForSEO unreachable: ${err.message}`);
    return false;
  }
}

check().then(ok => process.exit(ok ? 0 : 1));
