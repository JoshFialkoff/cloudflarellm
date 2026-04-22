#!/usr/bin/env node
const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";

async function ensureOk(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}`);
  }
  return response;
}

async function run() {
  const home = await ensureOk("/");
  const html = await home.text();
  if (!html.includes("Access Exclusive Data to Find Best Massachusetts Assisted Living")) {
    throw new Error("Homepage headline missing in smoke response.");
  }

  await ensureOk("/banner/banner-1.png");

  process.stdout.write("Homepage smoke test passed.\n");
}

run().catch((error) => {
  process.stderr.write(`Homepage smoke test failed: ${error.message}\n`);
  process.exit(1);
});
