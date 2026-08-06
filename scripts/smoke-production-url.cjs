#!/usr/bin/env node
/**
 * HEAD/GET public URL; fails on 5xx (e.g. Cloudflare 502 when Traefik upstream is wrong).
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

  process.stdout.write(`Production smoke OK (${res.status}) ${url}\n`);
}

run().catch((e) => {
  process.stderr.write(`Production smoke failed: ${e.message}\n`);
  process.exit(1);
});
