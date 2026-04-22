#!/usr/bin/env node
/**
 * Merges DATAFORSEO_* from repo .env and/or .env.dataforseo.local into ~/.cursor/mcp.json
 * under mcpServers.dfs.env (creates dfs entry if missing).
 *
 * Merge rule: start with .env; overlay .env.dataforseo.local only for keys whose value
 * is non-empty (so blank lines in .env.dataforseo.local do not wipe .env).
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(REPO_ROOT, ".env.dataforseo.local");
const DOT_ENV = path.join(REPO_ROOT, ".env");
const MCP_PATH = path.join(os.homedir(), ".cursor", "mcp.json");

function parseEnvFile(text) {
  const raw = text.replace(/^\uFEFF/, "");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    let t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.toLowerCase().startsWith("export ")) t = t.slice(7).trim();
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    val = val.trim();
    out[key] = val;
  }
  return out;
}

function normalizeEnvKeys(parsed) {
  const n = {};
  for (const [k, v] of Object.entries(parsed)) {
    n[k.trim().toUpperCase()] = typeof v === "string" ? v.trim() : v;
  }
  return n;
}

/** Base from .env, then overlay keys from override only when override value is non-empty. */
function mergeEnvLayer(baseRaw, overrideRaw) {
  const base = normalizeEnvKeys(parseEnvFile(baseRaw));
  const over = normalizeEnvKeys(parseEnvFile(overrideRaw));
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v != null && String(v).trim() !== "") out[k] = v;
  }
  return out;
}

function loadCredentialEnv() {
  const hasLocal = fs.existsSync(ENV_FILE);
  const hasDot = fs.existsSync(DOT_ENV);
  if (!hasLocal && !hasDot) {
    console.error(
      `Missing both:\n  ${DOT_ENV}\n  ${ENV_FILE}\n` +
        `Add DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD to one of them, or copy .env.dataforseo.local.example.`
    );
    process.exit(1);
  }
  const dotContent = hasDot ? fs.readFileSync(DOT_ENV, "utf8") : "";
  const localContent = hasLocal ? fs.readFileSync(ENV_FILE, "utf8") : "";
  return mergeEnvLayer(dotContent, localContent);
}

function main() {
  const parsed = loadCredentialEnv();
  const user =
    parsed.DATAFORSEO_USERNAME ||
    parsed.DATAFORSEO_LOGIN ||
    parsed.DATAFORSEO_API_LOGIN;
  const pass =
    parsed.DATAFORSEO_PASSWORD || parsed.DATAFORSEO_API_PASSWORD;
  if (!user || !pass) {
    const keys = Object.keys(parsed).filter(Boolean);
    console.error(
      "Need non-empty credentials in .env and/or .env.dataforseo.local.\n" +
        "Use either:\n" +
        "  DATAFORSEO_USERNAME=...\n" +
        "  DATAFORSEO_PASSWORD=...\n" +
        "or aliases: DATAFORSEO_LOGIN / DATAFORSEO_API_LOGIN, DATAFORSEO_API_PASSWORD.\n" +
        "(Blank values in .env.dataforseo.local no longer override .env.)\n"
    );
    console.error(
      keys.length
        ? `Keys found in file (values not shown): ${keys.sort().join(", ")}`
        : "No KEY=value lines parsed (check for typos, quotes, or only comments)."
    );
    console.error(
      `USERNAME resolved: ${user ? "yes (length " + user.length + ")" : "no"} | PASSWORD resolved: ${pass ? "yes (length " + pass.length + ")" : "no"}`
    );
    process.exit(1);
  }

  if (!fs.existsSync(MCP_PATH)) {
    console.error(`Missing ${MCP_PATH} — create Cursor MCP config first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(MCP_PATH, "utf8");
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in mcp.json:", e.message);
    process.exit(1);
  }

  cfg.mcpServers = cfg.mcpServers || {};
  if (!cfg.mcpServers.dfs) {
    cfg.mcpServers.dfs = {
      command: "npx",
      args: ["-y", "dataforseo-mcp-server"],
      env: {},
    };
  }
  cfg.mcpServers.dfs.env = {
    ...cfg.mcpServers.dfs.env,
    DATAFORSEO_USERNAME: user,
    DATAFORSEO_PASSWORD: pass,
  };

  fs.writeFileSync(MCP_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  console.log(`Updated mcpServers.dfs.env in ${MCP_PATH}`);
  console.log("Restart MCP in Cursor (or reload the window) for changes to apply.");
}

main();
