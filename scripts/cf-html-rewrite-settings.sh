#!/usr/bin/env bash
# Print Cloudflare zone settings that commonly rewrite HTML or defer scripts
# (Rocket Loader, minify, Mirage, email obfuscation, etc.).
#
# Requires the same env vars as deploy-and-purge.sh:
#   CLOUDFLARE_ZONE_ID
#   CLOUDFLARE_API_TOKEN   — needs permission to read zone settings (e.g. Zone → Read).
#
# Wrangler does not expose these; this uses the Cloudflare HTTP API.
#
# Usage:
#   export CLOUDFLARE_ZONE_ID=...
#   export CLOUDFLARE_API_TOKEN=...
#   ./scripts/cf-html-rewrite-settings.sh

set -euo pipefail

: "${CLOUDFLARE_ZONE_ID:?Set CLOUDFLARE_ZONE_ID}"
: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"

json="$(curl -fsS "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/settings" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json")"

node <<'NODE' <<<"$json"
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8");
const data = JSON.parse(raw);
if (!data.success) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}
/** @type {{ id: string, value: unknown, modified_on?: string }[]} */
const list = data.result || [];
const re =
  /rocket|email|obfus|mirage|polish|minify|server_side|sse|scrape|automatic_platform|early_hint|http2|http3|zero.?rt|smart|tiered/i;
const must = new Set(["rocket_loader", "email_obfuscation", "server_side_exclude"]);
const hits = list.filter((s) => re.test(s.id) || must.has(s.id));
if (hits.length === 0) {
  console.log("No matching setting ids found (API shape may have changed). First 40 ids:");
  console.log(list.slice(0, 40).map((s) => s.id).join("\n"));
  process.exit(0);
}
for (const s of hits.sort((a, b) => a.id.localeCompare(b.id))) {
  console.log(`${s.id}: ${JSON.stringify(s.value)}`);
}
NODE
