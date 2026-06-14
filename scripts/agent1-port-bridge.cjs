#!/usr/bin/env node
/**
 * Cloudflare tunnel ingress for agent1.assistedly.ai targets localhost:3001.
 * This bridge forwards 3001 → Next dev (default 3010) so agent1 serves local changes.
 */
const http = require("http");

const upstreamPort = process.env.PORT || process.env.TUNNEL_UPSTREAM_PORT || "3010";
const listenPort = process.env.AGENT1_BRIDGE_PORT || "3001";
const listenHost = process.env.AGENT1_BRIDGE_HOST || "127.0.0.1";

const server = http.createServer((req, res) => {
  const headers = { ...req.headers };
  const incomingHost = headers.host;
  if (incomingHost && !headers["x-forwarded-host"]) {
    headers["x-forwarded-host"] = incomingHost;
  }
  if (!headers["x-forwarded-proto"]) {
    headers["x-forwarded-proto"] = "https";
  }
  headers.host = `127.0.0.1:${upstreamPort}`;
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: upstreamPort,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  req.pipe(upstream);
  upstream.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("Local Next.js dev server is not reachable on port " + upstreamPort);
    }
  });
});

server.listen(Number(listenPort), listenHost, () => {
  console.error(`[agent1-bridge] http://${listenHost}:${listenPort} → http://127.0.0.1:${upstreamPort}`);
});
