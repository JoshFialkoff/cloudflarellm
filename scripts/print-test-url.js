#!/usr/bin/env node
const base = Number.parseInt(process.env.PORT || "3010", 10) || 3010;
const tunnelUrl =
  process.env.CLOUDFLARE_TUNNEL_URL ||
  process.env.CF_TUNNEL_URL ||
  process.env.TUNNEL_URL ||
  "";

process.stdout.write(`${String(tunnelUrl).trim() || `http://localhost:${base}/`}\n`);