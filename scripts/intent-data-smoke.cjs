/**
 * Intent Data Platform smoke test
 * Run with: PORT=3010 node scripts/intent-data-smoke.cjs
 */

const PORT = process.env.PORT || "3010";
const BASE = `http://127.0.0.1:${PORT}`;

async function smoke(name, path, opts = {}) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    if (!json.ok) {
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
  console.log(`Smoking AIDP at ${BASE}\n`);

  // 1. Health
  await smoke("Health check", "/api/intent/health");

  // 2. Seed
  await smoke("Seed demo data", "/api/intent/seed", { method: "POST" });

  // 3. Models
  await smoke("List models", "/api/intent/models");

  // 4. Accounts
  const accounts = await smoke("List accounts", "/api/intent/accounts");

  // 5. Contacts
  await smoke("List contacts", "/api/intent/contacts");

  // 6. Intent score
  const domain = accounts.data?.[0]?.domain || "brightspringhealth.com";
  await smoke(`Intent score (${domain})`, `/api/intent/intent-score?domain=${encodeURIComponent(domain)}`);

  // 7. Identity graph
  await smoke("Identity graph stats", "/api/intent/graph?stats=true");

  // 8. Audiences
  const audiences = await smoke("List audiences", "/api/intent/audiences");

  // 9. Audience export (JSON)
  const audienceId = audiences.data?.[0]?.id;
  if (!audienceId) {
    console.error("  ❌ No audience found to export");
    process.exitCode = 1;
    return;
  }
  await smoke(`Export audience JSON (${audienceId})`, `/api/intent/audiences/${audienceId}/export?format=json`);

  // 10. Audience export (CSV)
  const csvRes = await fetch(`${BASE}/api/intent/audiences/${audienceId}/export?format=csv`);
  if (!csvRes.ok) {
    console.error(`  ❌ Export audience CSV: HTTP ${csvRes.status}`);
    process.exitCode = 1;
  } else {
    const csvText = await csvRes.text();
    if (csvText.includes("type,id,name")) {
      console.log(`  ✅ Export audience CSV (${audienceId})`);
    } else {
      console.error(`  ❌ Export audience CSV: unexpected body`);
      process.exitCode = 1;
    }
  }

  // 11. Audience sync
  await smoke(`Sync audience to Twenty (${audienceId})`, `/api/intent/audiences/${audienceId}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination: "twenty" }),
  });

  // 12. Audience campaigns
  await smoke(`Audience campaigns (${audienceId})`, `/api/intent/audiences/${audienceId}/campaigns`);

  console.log("\n🎉 All smoke tests passed.");
}

main().catch((err) => {
  console.error("\nSmoke test failed:", err.message);
  process.exit(1);
});
