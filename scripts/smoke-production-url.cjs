#!/usr/bin/env node
/**
 * HEAD/GET public URL; fails on 5xx or missing expected content.
 * PRODUCTION_SMOKE_URL — default https://assistedly.ai/
 */
const url = process.env.PRODUCTION_SMOKE_URL || "https://assistedly.ai/";

async function run() {
  let res = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });

  if (res.status === 405 || res.status === 501) {
    res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
  }

  if (res.status >= 500) {
    throw new Error(`${url} returned ${res.status}`);
  }

  // Validate body content — catches 200-with-error-page or blank pages
  const bodyRes = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  const html = await bodyRes.text();

  if (html.includes("Internal Server Error")) {
    throw new Error("Page body contains 'Internal Server Error'");
  }
  if (!html.includes("Assistedly")) {
    throw new Error("Page missing expected 'Assistedly' content — possible blank/render error");
  }

  process.stdout.write(`Production smoke OK (${res.status}) ${url}\n`);
}

run().catch((e) => {
  process.stderr.write(`Production smoke failed: ${e.message}\n`);
  process.exit(1);
});
