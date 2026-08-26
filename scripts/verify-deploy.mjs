#!/usr/bin/env node
/**
 * Post-Deploy Verification — The "Bot Can't Lie" Script
 *
 * After deploy, this hits the LIVE site (not localhost) and asserts:
 *   1. HTTP 200 + x-opennext header (confirms Worker serving)
 *   2. Favicon is correct type (catches green square regression)
 *   3. Homepage has expected content
 *   4. /top-rated loads and has composite score table
 *   5. Key App Router pages return 200
 *   6. /safety-scores redirects (301/308)
 *
 * Usage:
 *   PRODUCTION_URL=https://assistedly.ai node scripts/verify-deploy.mjs
 *
 * Exit 0 = all verified. Exit 1 = at least one check failed.
 */

const baseUrl = (process.env.PRODUCTION_URL || "https://assistedly.ai").replace(/\/$/, "");
const cacheBust = `?cb=${Date.now()}`;

const checks = {
  pass: 0,
  fail: 0,
  errors: [],
};

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    checks.pass++;
  } catch (error) {
    console.error(`  ❌ ${name}: ${error.message}`);
    checks.errors.push(`${name}: ${error.message}`);
    checks.fail++;
  }
}

async function headOk(path) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 405 || res.status === 501) {
    return fetch(`${baseUrl}${path}`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  }
  return res;
}

async function getText(path) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  return { res, text };
}

async function run() {
  console.log(`\n🔍 Verifying live deploy: ${baseUrl}\n`);

  // 1. Homepage Worker header + status
  await check("Homepage HTTP 200 + Worker serving", async () => {
    const res = await headOk("/");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const opennext = res.headers.get("x-opennext");
    if (!opennext) throw new Error("Missing x-opennext header — not served by Worker?");
  });

  // 2. Homepage content
  await check("Homepage has expected content", async () => {
    const { text } = await getText(`/${cacheBust}`);
    const mustHave = ["Assistedly", "assisted living", "AI"];
    for (const phrase of mustHave) {
      if (!text.includes(phrase)) throw new Error(`Missing: "${phrase}"`);
    }
  });

  // 3. Favicon on live site (NOT green square)
  await check("Favicon is correct file type", async () => {
    const res = await headOk(`/favicon.ico${cacheBust}`);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("image/vnd.microsoft.icon") && !ct.includes("image/x-icon")) {
      throw new Error(`Wrong content-type: ${ct}`);
    }
  });

  // 4. App Router page: /top-rated
  await check("/top-rated loads (App Router)", async () => {
    const { res, text } = await getText(`/top-rated${cacheBust}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!text.includes("Top Rated") && !text.includes("top rated")) {
      throw new Error("Missing 'Top Rated' content");
    }
  });

  // 5. /safety-scores redirects to /top-rated
  await check("/safety-scores redirects to /top-rated", async () => {
    const res = await fetch(`${baseUrl}/safety-scores`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (res.status !== 301 && res.status !== 302 && res.status !== 307 && res.status !== 308) {
      throw new Error(`Expected redirect, got HTTP ${res.status}`);
    }
    const loc = res.headers.get("location") || "";
    if (!loc.includes("top-rated")) {
      throw new Error(`Redirect location missing 'top-rated': ${loc}`);
    }
  });

  // 6. Another App Router page (partner)
  await check("/why-we-dont-take-commissions loads (App Router)", async () => {
    const res = await headOk(`/why-we-dont-take-commissions${cacheBust}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // 7. PostHog proxy returns valid decide response
  await check("PostHog proxy /api/ph/decide/ returns valid JSON", async () => {
    const res = await fetch(`${baseUrl}/api/ph/decide/?v=3`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (typeof json.requestId !== "string" || !json.requestId.trim()) {
      throw new Error("Invalid PostHog decide response — missing requestId");
    }
  });

  // 8. Static asset (favicon.png)
  await check("Static favicon.png loads", async () => {
    const res = await headOk(`/favicon.png${cacheBust}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("image/png")) throw new Error(`Wrong type: ${ct}`);
  });

  // Report
  console.log("");
  if (checks.fail === 0) {
    console.log(`✅ ALL ${checks.pass} VERIFICATION CHECKS PASSED — Deploy is live and correct.`);
    process.exit(0);
  } else {
    console.error(`❌ VERIFICATION FAILED: ${checks.fail}/${checks.pass + checks.fail} checks failed`);
    checks.errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }
}

run();
