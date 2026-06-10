#!/usr/bin/env node
/**
 * Ensures compose.yaml keeps the production Traefik contract for assistedly.ai.
 * Current host topology: local Compose-managed Traefik + web container on the
 * external `assistedly` Docker network. The Next standalone server must bind to
 * 0.0.0.0 so Docker port publishing and Traefik can reach it.
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
    [/traefik:\n[\s\S]*?image:\s*traefik:3\.6/, "Traefik service uses traefik:3.6"],
    [/--providers\.docker=true/, "Traefik Docker provider enabled"],
    [/--providers\.docker\.exposedbydefault=false/, "Traefik Docker provider does not expose containers by default"],
    [/--entrypoints\.http\.address=:80/, "Traefik HTTP entrypoint on :80"],
    [/--entrypoints\.https\.address=:443/, "Traefik HTTPS entrypoint on :443"],
    [/--entrypoints\.http\.http\.redirections\.entrypoint\.to=https/, "HTTP entrypoint redirects to HTTPS"],
    [/--entrypoints\.http\.http\.redirections\.entrypoint\.scheme=https/, "HTTP redirect scheme is HTTPS"],
    [/traefik\.enable\s*=\s*true/, "traefik.enable=true"],
    [/traefik\.docker\.network\s*=\s*assistedly/, "traefik.docker.network=assistedly"],
    [/traefik\.http\.routers\.assistedly-web\.entrypoints\s*=\s*https\b/, "router entrypoints=https"],
    [/traefik\.http\.routers\.assistedly-web\.tls\s*=\s*true/, "HTTPS router TLS enabled"],
    [/loadbalancer\.server\.port\s*=\s*3003/, "loadbalancer.server.port=3003"],
    [/PORT:\s*["']3003["']/, "web PORT=3003"],
    [/HOSTNAME:\s*["']0\.0\.0\.0["']/, "web HOSTNAME=0.0.0.0"],
    [/web:\n[\s\S]*?networks:\n[\s\S]*?- assistedly/, "services.web joins assistedly network"],
    [/networks:\n[\s\S]*?assistedly:\n[\s\S]*?external:\s*true/, "external assistedly network declared"],
  ];

  const missing = [];
  for (const [re, label] of checks) {
    if (!re.test(text)) missing.push(label);
  }

  for (const host of [
    "Host(`assistedly.ai`)",
    "Host(`www.assistedly.ai`)",
    "Host(`agent2.assistedly.ai`)",
    "Host(`agent3.assistedly.ai`)",
  ]) {
    if (!text.includes(host)) missing.push(`${host} in router rule`);
  }

  if (!text.includes("!PathPrefix(`/guide`)")) {
    missing.push("!PathPrefix(`/guide`) so WordPress guide routes are not swallowed by Next.js");
  }

  if (/traefik\.docker\.network\s*=\s*easypanel/.test(text)) {
    missing.push("do not route this standalone Compose stack through easypanel network");
  }

  if (/entrypoints\s*=\s*websecure\b/.test(text)) {
    missing.push("avoid entrypoints=websecure unless this Traefik defines websecure");
  }

  if (missing.length) {
    console.error("guard-compose-traefik: compose.yaml missing or incorrect Traefik wiring:");
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }

  console.log("Compose Traefik guard passed.");
}

main();
