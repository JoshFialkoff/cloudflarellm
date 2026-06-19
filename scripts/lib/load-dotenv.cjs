const fs = require("fs");
const path = require("path");

/**
 * Load KEY=VALUE lines from a dotenv file into process.env.
 * Does not override keys already set in the environment.
 */
function loadDotEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  return true;
}

/** Standard local env file order for CI/ops scripts (later files do not override earlier shell env). */
function loadLocalEnvFiles(cwd = process.cwd()) {
  const candidates = [
    path.join(cwd, ".env.deploy.local"),
    path.join(cwd, ".env.local"),
    path.join(cwd, "cf.env"),
    path.join(cwd, ".env"),
  ];
  const loaded = [];
  for (const filePath of candidates) {
    if (loadDotEnvFile(filePath)) loaded.push(filePath);
  }
  return loaded;
}

module.exports = { loadDotEnvFile, loadLocalEnvFiles };
