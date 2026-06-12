#!/usr/bin/env node
/**
 * Ensures compose.dify-host.yaml keeps the Dify co-located production contract.
 * Topology: web-only Compose on dify_default; dify-nginx proxies assistedly.ai → assistedly-web:3003.
 */
const fs = require("fs");
const path = require("path");

const composePath = path.join(__dirname, "..", "compose.dify-host.yaml");

function main() {
  let text;
  try {
    text = fs.readFileSync(composePath, "utf8");
  } catch {
    console.error("guard-compose-dify-host: missing compose.dify-host.yaml");
    process.exit(1);
  }

  const checks = [
    [/^\s*web:/m, "web service defined"],
    [/image:\s*assistedly-web:local/, "web image assistedly-web:local"],
    [/PORT:\s*["']3003["']/, "web PORT=3003"],
    [/HOSTNAME:\s*["']0\.0\.0\.0["']/, "web HOSTNAME=0.0.0.0"],
    [/127\.0\.0\.1:3003:3003/, "web published on 127.0.0.1:3003"],
    [/dify_default:/, "web joins dify_default network"],
    [/aliases:\n[\s\S]*?- assistedly-web/, "network alias assistedly-web"],
    [/dify_default:\n[\s\S]*?external:\s*true/, "external dify_default network declared"],
  ];

  const missing = [];
  for (const [re, label] of checks) {
    if (!re.test(text)) missing.push(label);
  }

  if (/traefik:/.test(text)) {
    missing.push("do not run Traefik on the Dify co-located host (port 80/443 conflict)");
  }

  if (/traefik\.enable/.test(text)) {
    missing.push("do not use Traefik labels in compose.dify-host.yaml");
  }

  if (missing.length) {
    console.error("guard-compose-dify-host: compose.dify-host.yaml missing or incorrect wiring:");
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }

  console.log("Compose Dify-host guard passed.");
}

main();
