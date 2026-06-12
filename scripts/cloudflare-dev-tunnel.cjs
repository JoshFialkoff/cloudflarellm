#!/usr/bin/env node
/**
 * Stable dev URL: https://agent1.assistedly.ai
 *
 * Uses the assistedly.ai Cloudflare tunnel (agent1 ingress → localhost:3001).
 * Starts a local 3001→3010 bridge, then runs cloudflared with ASSISTEDLY_TUNNEL_TOKEN.
 *
 * Before starting (one-time per dev session on the production host):
 *   ssh … 'sudo systemctl stop cloudflared'
 * When finished, restart production connector:
 *   ssh … 'sudo systemctl start cloudflared'
 *
 * Usage:
 *   1) npm run dev
 *   2) export ASSISTEDLY_TUNNEL_TOKEN='…'   # from: cloudflared tunnel token 2f4007a2-b0ad-41ec-a757-053d0cf94fe7
 *   3) npm run tunnel:dev
 */
const { spawn } = require("child_process");
const { resolve } = require("path");

const publicUrl = process.env.DEV_PUBLIC_URL || "https://agent1.assistedly.ai";
const token = process.env.ASSISTEDLY_TUNNEL_TOKEN || process.env.CLOUDFLARE_TUNNEL_TOKEN;
const bridgeScript = resolve(__dirname, "agent1-port-bridge.cjs");

if (!token) {
  console.error(
    "Missing ASSISTEDLY_TUNNEL_TOKEN. Generate with:\n  cloudflared tunnel token 2f4007a2-b0ad-41ec-a757-053d0cf94fe7\n",
  );
  process.exit(1);
}

console.error(`[tunnel] Public dev URL: ${publicUrl}`);
console.error("[tunnel] Starting agent1 port bridge (3001 → Next dev)…");
console.error("[tunnel] Stop origin cloudflared on 104.168.38.162 if agent1 still 502.\n");

const bridge = spawn(process.execPath, [bridgeScript], { stdio: "inherit" });
const tunnel = spawn("cloudflared", ["tunnel", "run", "--token", token], { stdio: "inherit" });

process.stdout.write(`${publicUrl}\n`);

function shutdown(code) {
  bridge.kill("SIGTERM");
  tunnel.kill("SIGTERM");
  process.exit(code ?? 0);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

bridge.on("exit", (code) => {
  if (code) shutdown(code);
});

tunnel.on("exit", (code, signal) => {
  if (signal) shutdown(143);
  shutdown(code ?? 0);
});

tunnel.on("error", (err) => {
  console.error(err.message);
  shutdown(1);
});
