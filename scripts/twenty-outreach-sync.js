#!/usr/bin/env node
/**
 * twenty-outreach-sync.js
 *
 * Push a positive partner outreach response into Twenty CRM.
 *
 * Usage:
 *   node scripts/twenty-outreach-sync.js \
 *     --company="GoGoGrandparent" \
 *     --slug=gogograndparent \
 *     --reply="We are interested in exploring partnership opportunities..." \
 *     --source=chatbot \
 *     --confidence=high \
 *     --screenshot=./outreach-reply-gogograndparent-12345.png
 */

const { logPositiveResponse } = require("../lib/intent-data/integrations/twenty.js");

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.replace(/^--/, "").split("=")[0];
      const inline = arg.includes("=") ? arg.split("=").slice(1).join("=") : undefined;
      const next = args[i + 1];
      flags[key] = inline !== undefined ? inline : (next && !next.startsWith("--") ? args[++i] : true);
    }
  }
  return flags;
}

async function main() {
  const f = parseArgs();
  const required = ["company", "slug", "reply"];
  for (const r of required) {
    if (!f[r]) {
      console.error(`Missing --${r}`);
      process.exit(1);
    }
  }

  const result = await logPositiveResponse({
    companyName: f.company,
    targetSlug: f.slug,
    replyText: f.reply,
    source: f.source || "chatbot",
    confidence: f.confidence || "medium",
    screenshotPath: f.screenshot || null,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

main();
