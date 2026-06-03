#!/usr/bin/env node
/**
 * Ensures compose.yaml keeps Traefik labels required for public routing (assistedly.ai → web:3003).
 * Prevents regressions to websecure-only or missing routers (edge 502 while app is healthy on :3003).
 */
const fs = require("fs");
const path = require("path");

const composePath = path.join(__dirname, "..", "compose.yaml");

function main() {
  let text;
  try {
    text = fs.readFileSync(composePath, "utf8");
  } catch {
    console.error("guard-compose-traefik: missing compose.yaml");
    process.exit(1);
  }

  const checks = [
    [/traefik\.enable\s*=\s*true/, "traefik.enable=true"],
    [/traefik\.docker\.network\s*=\s*easypanel/, "traefik.docker.network=easypanel"],
    [/entrypoints\s*=\s*https\b/, "entrypoints=https (must match Traefik; websecure alone often breaks this stack)"],
    [/loadbalancer\.server\.port\s*=\s*3003/, "loadbalancer.server.port=3003"],
  ];

  const missing = [];
  for (const [re, label] of checks) {
    if (!re.test(text)) {
      missing.push(label);
    }
  }

  if (!text.includes("Host(`assistedly.ai`)")) {
    missing.push("Host(`assistedly.ai`) in router rule");
  }
  if (!text.includes("Host(`agent2.assistedly.ai`)")) {
    missing.push("Host(`agent2.assistedly.ai`) in router rule");
  }
  if (!text.includes("Host(`agent3.assistedly.ai`)")) {
    missing.push("Host(`agent3.assistedly.ai`) in router rule");
  }

  if (!text.includes("Host(`agent3.assistedly.ai`)")) {
    missing.push("Host(`agent3.assistedly.ai`) in router rule");
  }

  if (!text.includes("!PathPrefix(`/guide`)")) {
    missing.push("!PathPrefix(`/guide`) so WordPress guide routes are not swallowed by Next.js");
  }

  if (!/networks:\s*\n(?:.*\n)*\s+- assistedly\s*\n(?:.*\n)*\s+- easypanel\b/m.test(text)) {
    missing.push("services.web networks must include assistedly and easypanel");
  }

  if (/entrypoints\s*=\s*websecure\b/.test(text) && !/entrypoints\s*=\s*https\b/.test(text)) {
    missing.push("avoid entrypoints=websecure-only unless Traefik defines websecure");
  }

  if (missing.length) {
    console.error("guard-compose-traefik: compose.yaml missing or incorrect Traefik wiring:");
    for (const m of missing) {
      console.error(`  - ${m}`);
    }
    process.exit(1);
  }

  console.log("Compose Traefik guard passed.");
}

main();
