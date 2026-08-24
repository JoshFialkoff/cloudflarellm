#!/usr/bin/env node
/**
 * Monitor: Cloudflare Worker Production Health
 * Checks HTTPS response code and x-opennext header.
 */

const { fmtTs } = require("./lib/monitor-utils.cjs");

const TARGETS = [
  { url: "https://assistedly.ai/", name: "homepage" },
  { url: "https://assistedly.ai/search", name: "search" },
  { url: "https://assistedly.ai/find-safest", name: "find-safest" },
];

async function check() {
  let allOk = true;
  for (const t of TARGETS) {
    try {
      const res = await fetch(t.url, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      const opennext = res.headers.get("x-opennext") || "";
      if (res.status >= 200 && res.status < 300 && opennext.includes("1")) {
        console.log(`[${fmtTs()}] ✅ ${t.name}: HTTP ${res.status}, x-opennext:${opennext}`);
      } else if (res.status >= 200 && res.status < 300) {
        console.log(`[${fmtTs()}] ⚠️ ${t.name}: HTTP ${res.status}, missing x-opennext:1`);
        allOk = false;
      } else {
        console.log(`[${fmtTs()}] ❌ ${t.name}: HTTP ${res.status}`);
        allOk = false;
      }
    } catch (err) {
      console.log(`[${fmtTs()}] ❌ ${t.name}: ${err.message}`);
      allOk = false;
    }
  }
  return allOk;
}

check().then(ok => process.exit(ok ? 0 : 1));
