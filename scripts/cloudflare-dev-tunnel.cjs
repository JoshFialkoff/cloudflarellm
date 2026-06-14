#!/usr/bin/env node
/**
 * Stable dev URL: https://agent1.assistedly.ai (or agent2 … agent5 via DEV_PUBLIC_URL)
 *
 * Tunnel ingress: agent1 → localhost:3001, agent2 → localhost:3002, …
 * Starts local bridges (3001–3005 → Next dev), then runs cloudflared.
 *
 * Before starting (one-time per dev session on the production host):
 *   ssh -i ~/.ssh/7-5-25kuroit joshfialkoff@104.168.38.162 'sudo systemctl stop cloudflared'
 * When finished, restart production connector:
 *   ssh -i ~/.ssh/7-5-25kuroit joshfialkoff@104.168.38.162 'sudo systemctl start cloudflared'
 *
 * Usage:
 *   1) npm run dev
 *   2) Put ASSISTEDLY_TUNNEL_TOKEN in .env.local (or export it)
 *   3) npm run tunnel:dev (auto-clears stale bridges on 3001–3005; or npm run tunnel:kill-bridges first)
 */
const { spawn } = require("child_process");
const fs = require("fs");
const { resolve } = require("path");
const { killTunnelBridges, resolveBridgePorts } = require("./kill-tunnel-bridges.cjs");

function loadEnvLocal() {
  const envPath = resolve(__dirname, "../.env.local");
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

loadEnvLocal();

const publicUrl = process.env.DEV_PUBLIC_URL || "https://agent1.assistedly.ai";
const token = process.env.ASSISTEDLY_TUNNEL_TOKEN || process.env.CLOUDFLARE_TUNNEL_TOKEN;
const bridgeScript = resolve(__dirname, "agent1-port-bridge.cjs");
const bridgePorts = resolveBridgePorts();
const upstreamPort = process.env.TUNNEL_UPSTREAM_PORT || process.env.PORT || "3010";

if (!token) {
  console.error(
    "Missing ASSISTEDLY_TUNNEL_TOKEN. Generate with:\n  cloudflared tunnel token 2f4007a2-b0ad-41ec-a757-053d0cf94fe7\n",
  );
  process.exit(1);
}

console.error(`[tunnel] Primary preview URL: ${publicUrl}`);
console.error(
  `[tunnel] Bridges ${bridgePorts.join(", ")} → Next dev :${upstreamPort} (agent1–agent5)`,
);
console.error(
  "[tunnel] Stop origin cloudflared on 104.168.38.162 if tunnel returns 502/1033.\n",
);

const { stopped: killedBridges } = killTunnelBridges({ ports: bridgePorts });
if (killedBridges > 0) {
  console.error(`[tunnel] Cleared ${killedBridges} stale bridge listener(s) before start.`);
}

const bridges = bridgePorts.map((bridgePort) =>
  spawn(process.execPath, [bridgeScript], {
    stdio: "inherit",
    env: {
      ...process.env,
      AGENT1_BRIDGE_PORT: bridgePort,
      TUNNEL_UPSTREAM_PORT: upstreamPort,
    },
  }),
);

const tunnel = spawn("cloudflared", ["tunnel", "run", "--token", token], { stdio: "inherit" });

process.stdout.write(`${publicUrl}\n`);
for (let i = 1; i <= 5; i += 1) {
  if (bridgePorts.includes(String(3000 + i))) {
    process.stdout.write(`https://agent${i}.assistedly.ai/\n`);
  }
}

function shutdown(code) {
  for (const bridge of bridges) bridge.kill("SIGTERM");
  tunnel.kill("SIGTERM");
  process.exit(code ?? 0);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

for (const bridge of bridges) {
  bridge.on("exit", (code) => {
    if (code) shutdown(code);
  });
}

tunnel.on("exit", (code, signal) => {
  if (signal) shutdown(143);
  shutdown(code ?? 0);
});

tunnel.on("error", (err) => {
  console.error(err.message);
  shutdown(1);
});
