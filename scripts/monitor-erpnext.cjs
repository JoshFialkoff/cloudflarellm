#!/usr/bin/env node
/**
 * Monitor: ERPNext/Bookkeeping Agent Connectivity
 * Exits 0 if API responds, 1 otherwise.
 */

const { fmtTs } = require("./lib/monitor-utils.cjs");

async function check() {
  const erpnextHost = process.env.ERPNext_HOST || "http://107.172.94.35";
  const erpnextPort = process.env.ERPNext_PORT || "8081";
  const url = `${erpnextHost}:${erpnextPort}/api/method/ping`;

  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10000) });
    const body = await res.text();
    if (res.ok && (body.includes("pong") || body.includes("message"))) {
      console.log(`[${fmtTs()}] ✅ ERPNext reachable at ${url}`);
      return true;
    }
    console.log(`[${fmtTs()}] ❌ ERPNext returned HTTP ${res.status} at ${url}`);
    return false;
  } catch (err) {
    console.log(`[${fmtTs()}] ❌ ERPNext unreachable: ${err.message}`);
    return false;
  }
}

check().then(ok => process.exit(ok ? 0 : 1));
