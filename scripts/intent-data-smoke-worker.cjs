/**
 * Intent Data Platform Worker smoke test
 * Run with: AIDP_URL=https://assistedly-aidp.forwardjump-com198.workers.dev node scripts/intent-data-smoke-worker.cjs
 */

const BASE = process.env.AIDP_URL || "https://assistedly-aidp.forwardjump-com198.workers.dev";

async function smoke(name, path, opts = {}, expectStatus = 200) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, opts);
    if (res.status !== expectStatus) {
      const body = await res.text();
      throw new Error(`Expected HTTP ${expectStatus}, got ${res.status}: ${body.slice(0, 200)}`);
    }
    if (res.status === 204) {
      console.log(`  ✅ ${name}`);
      return null;
    }
    const json = await res.json();
    if (expectStatus === 200 && !json.ok) {
      throw new Error(`API returned ok=false: ${JSON.stringify(json)}`);
    }
    console.log(`  ✅ ${name}`);
    return json;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    process.exitCode = 1;
    throw err;
  }
}

async function main() {
  console.log(`Smoking AIDP Worker at ${BASE}\n`);

  // 1. Public health check
  await smoke("Health check (public)", "/health");

  // 2. Verify auth gate rejects unauthenticated requests
  await smoke("Auth gate blocks /seed without CF-Access header", "/api/intent/seed", { method: "POST" }, 401);
  await smoke("Auth gate blocks /accounts without CF-Access header", "/api/intent/accounts", {}, 401);
  await smoke("Auth gate blocks /audiences without CF-Access header", "/api/intent/audiences", {}, 401);

  console.log("\n🎉 Worker smoke tests passed.");
  console.log("\n⚠️  Protected routes require Cloudflare Access (CF-Access-Authenticated-User-Email header).");
  console.log("   Allowlist domains: assistedly.ai, forwardjump.com");
  console.log("   Configure Access at: https://dash.cloudflare.com → Zero Trust → Access → Applications");
}

main().catch((err) => {
  console.error("\nSmoke test failed:", err.message);
  process.exit(1);
});
