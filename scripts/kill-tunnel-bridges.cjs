#!/usr/bin/env node
/**
 * Stop stale local Cloudflare tunnel port bridges (3001–3005 by default).
 * Used before `npm run tunnel:dev` and available as `npm run tunnel:kill-bridges`.
 */
const { execSync } = require("child_process");

function resolveBridgePorts() {
  const raw = process.env.DEV_TUNNEL_BRIDGE_PORTS || "1,2,3,4,5";
  const ports = raw
    .split(",")
    .map((part) => Number(String(part).trim()))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9)
    .map((n) => String(3000 + n));
  return [...new Set(ports.length > 0 ? ports : ["3001", "3002", "3003", "3004", "3005"])];
}

function pidsOnPort(port) {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return [...new Set(
      out
        .split("\n")
        .map((line) => Number.parseInt(String(line).trim(), 10))
        .filter((pid) => Number.isFinite(pid) && pid > 0),
    )];
  } catch {
    return [];
  }
}

function killTunnelBridges({ ports, signal = "SIGTERM", dryRun = false } = {}) {
  const bridgePorts = ports || resolveBridgePorts();
  let stopped = 0;

  for (const port of bridgePorts) {
    for (const pid of pidsOnPort(port)) {
      if (pid === process.pid) continue;
      if (dryRun) {
        console.error(`[tunnel:kill] would stop pid ${pid} on 127.0.0.1:${port}`);
        stopped += 1;
        continue;
      }
      try {
        process.kill(pid, signal);
        console.error(`[tunnel:kill] stopped pid ${pid} on 127.0.0.1:${port}`);
        stopped += 1;
      } catch (error) {
        if (error && error.code !== "ESRCH") {
          console.error(`[tunnel:kill] pid ${pid} on :${port}: ${error.message}`);
        }
      }
    }
  }

  return { ports: bridgePorts, stopped };
}

if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  const { ports, stopped } = killTunnelBridges({ dryRun });
  if (stopped === 0) {
    console.error(`[tunnel:kill] no listeners on bridge ports ${ports.join(", ")}`);
  }
}

module.exports = { resolveBridgePorts, killTunnelBridges, pidsOnPort };
