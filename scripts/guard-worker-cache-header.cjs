#!/usr/bin/env node
/**
 * CI/CD guard: Prevents s-maxage=31536000 from being baked into the OpenNext
 * worker bundle. This value hard-caches HTML at the Cloudflare edge for 1yr,
 * making deploys invisible until manual cache purge.
 *
 * Must run AFTER `npm run build` but BEFORE `npx opennextjs-cloudflare deploy`.
 */
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const WORKER_PATH = path.join(PROJECT_ROOT, ".open-next", "worker.js");
const SERVER_FN_PATH = path.join(
  PROJECT_ROOT,
  ".open-next",
  "server-functions",
  "default",
  "handler.mjs"
);

const BAD_MAXAGE = /s-maxage=31536000/;
let failed = false;

function check(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  ${path.relative(PROJECT_ROOT, filePath)} not found (run npm run build first)`);
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  if (BAD_MAXAGE.test(content)) {
    console.error(
      `❌ FAIL: ${path.relative(PROJECT_ROOT, filePath)} still contains s-maxage=31536000\n` +
        `   → OpenNext is hard-coding 1-year edge cache for HTML pages.\n` +
        `   → Patch node_modules/@opennextjs/aws/dist/core/routing/util.js\n` +
        `      line ~224: change 31536000 → 0, then rebuild.\n` +
        `   → See AGENTS.md "Cloudflare Edge Cache Trap"`
    );
    failed = true;
  }
}

check(WORKER_PATH);
check(SERVER_FN_PATH);

if (failed) {
  process.exit(1);
}
console.log("✅ Worker cache-header guard passed (no s-maxage=31536000)");
