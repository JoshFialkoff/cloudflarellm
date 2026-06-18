const fs = require("fs");
const path = require("path");

const PORT_FILE = path.join(__dirname, "..", ".dev-server-port");

function writeDevServerPort(port) {
  fs.writeFileSync(PORT_FILE, `${port}\n`, "utf8");
}

function readDevServerPort() {
  try {
    const port = Number.parseInt(fs.readFileSync(PORT_FILE, "utf8").trim(), 10);
    return Number.isFinite(port) ? port : null;
  } catch {
    return null;
  }
}

/** Bridge/tunnel upstream: env override, then file written by npm run dev, then 3010. */
function resolveUpstreamPort() {
  const fromEnv = process.env.TUNNEL_UPSTREAM_PORT || process.env.PORT;
  if (fromEnv) {
    const port = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(port)) return port;
  }
  return readDevServerPort() || 3010;
}

module.exports = {
  PORT_FILE,
  writeDevServerPort,
  readDevServerPort,
  resolveUpstreamPort,
};
