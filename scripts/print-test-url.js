#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function ensureTrailingSlash(url) {
  return /\/$/.test(url) ? url : `${url}/`;
}

function normalizeUrlCandidate(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return ensureTrailingSlash(trimmed);
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(trimmed)) {
    return ensureTrailingSlash(`https://${trimmed}`);
  }
  return "";
}

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function resolveTestingSiteUrl(env) {
  const candidates = [
    env.TEST_SITE_URL,
    env.URL,
    env.SITE_URL,
    env.NEXT_PUBLIC_SITE_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    env.DEPLOY_PRIME_URL,
    env.CF_PAGES_URL,
    env.VERCEL_BRANCH_URL,
    env.VERCEL_URL,
    env.RAILWAY_PUBLIC_DOMAIN,
    env.RENDER_EXTERNAL_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUrlCandidate(candidate);
    if (normalized) return normalized;
  }

  return "";
}

loadEnvLocal();

const base = Number.parseInt(process.env.PORT || "3010", 10) || 3010;
const testingSiteUrl = resolveTestingSiteUrl(process.env);
const tunnelPreview = normalizeUrlCandidate(
  process.env.DEV_PUBLIC_URL || "https://agent1.assistedly.ai",
);

process.stdout.write(`Local test URL: http://localhost:${base}/\n`);
process.stdout.write(`Cloudflare tunnel preview: ${tunnelPreview}\n`);

if (testingSiteUrl) {
  process.stdout.write(`Testing site URL: ${testingSiteUrl}\n`);
}
