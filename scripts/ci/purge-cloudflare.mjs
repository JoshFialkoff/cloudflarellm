#!/usr/bin/env node
/**
 * Full-zone cache purge (same contract as CI deploy job).
 * Env: CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN
 *
 * Local Mac: set both in .env.local or .env.deploy.local (gitignored); this script loads them.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadLocalEnvFiles } = require("../lib/load-dotenv.cjs");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const loadedEnvFiles = loadLocalEnvFiles(repoRoot);

const zone = process.env.CLOUDFLARE_ZONE_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const purgeRequired = process.env.CLOUDFLARE_PURGE_REQUIRED !== "0";

function exitWithPurgeFailure(message) {
  if (purgeRequired) {
    console.error(message);
    process.exit(1);
  }

  console.warn(`::warning::${message}`);
}

if (!zone || !token) {
  const checked = [
    ".env.deploy.local",
    ".env.local",
    "cf.env",
    ".env",
  ].join(", ");
  const loaded =
    loadedEnvFiles.length > 0
      ? `Loaded: ${loadedEnvFiles.map((f) => path.basename(f)).join(", ")}`
      : "No local env files found";
  exitWithPurgeFailure(
    [
      "Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN.",
      `Add both to .env.local on your Mac (checked: ${checked}).`,
      loaded,
      "Shell exports still work: export CLOUDFLARE_ZONE_ID=... CLOUDFLARE_API_TOKEN=...",
    ].join("\n"),
  );
  process.exit(0);
}
const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ purge_everything: true }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok || body.success !== true) {
  exitWithPurgeFailure(`Cloudflare purge failed ${res.status} ${JSON.stringify(body)}`);
  process.exit(0);
}
console.log("Cloudflare purge_everything: success");
