#!/usr/bin/env node
/**
 * Upload the current git commit as an archive, build it in a temp worktree on the
 * production host, and restart the live compose project from that temp directory.
 *
 * Usage:
 *   node scripts/ci/trigger-deploy.mjs --host 104.168.38.162
 *   DEPLOY_HOST=104.168.38.162 node scripts/ci/trigger-deploy.mjs
 *   DEPLOY_HOST=75.127.14.185 DEPLOY_COMPOSE_FILE=compose.dify-host.yaml node scripts/ci/trigger-deploy.mjs
 *
 * Env:
 * - DEPLOY_HOST / DEPLOY_SSH_HOST — SSH host
 * - DEPLOY_KEY — optional SSH private key content (falls back to ~/.ssh/id_ed25519)
 * - DEPLOY_USER — optional SSH user (default: opencode)
 * - DEPLOY_REPO_DIR — optional remote config dir (default: /opt/assistedly)
 * - DEPLOY_COMPOSE_PROJECT — optional compose project name (default: assistedlyai)
 * - DEPLOY_COMPOSE_FILE — optional compose file (default: compose.yaml; use compose.dify-host.yaml on 75.127.14.185)
 */
import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

function normalizeHost(value) {
  if (!value) return "";
  let candidate = value.trim();
  if (!candidate) return "";
  try {
    if (/^[a-z]+:\/\//i.test(candidate)) {
      candidate = new URL(candidate).hostname;
    }
  } catch {
    // Keep original candidate for non-URL input.
  }
  candidate = candidate.replace(/\/.*$/, "");
  candidate = candidate.replace(/^[^@]+@/, "");
  candidate = candidate.replace(/:\d+$/, "");
  return candidate;
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 600_000,
    ...options,
  }).trimEnd();
}

const hostInput =
  process.argv.find((arg) => arg.startsWith("--host="))?.slice("--host=".length) ||
  process.env.DEPLOY_HOST ||
  process.env.DEPLOY_SSH_HOST;
const host = normalizeHost(hostInput);

if (!host) {
  console.error("Usage: trigger-deploy.mjs --host=<hostname> (or DEPLOY_HOST env)");
  process.exit(1);
}

const user = process.env.DEPLOY_USER || "opencode";
const repoDir = process.env.DEPLOY_REPO_DIR || "/opt/assistedly";
const composeProject = process.env.DEPLOY_COMPOSE_PROJECT || "assistedlyai";
const composeFile = process.env.DEPLOY_COMPOSE_FILE || "compose.yaml";
const composeFileFlag = `-f ${shellEscape(composeFile)}`;
const deploySha = run("git", ["rev-parse", "--short", "HEAD"]);
const remoteDeployDirName = `assistedly-deploy-${deploySha}`;
const containerName = `${composeProject}-web-1`;

let keyFile;
let keyArgs = [];
const deployKey = process.env.DEPLOY_KEY
  ? process.env.DEPLOY_KEY.replace(/\r/g, "").replace(/\\n/g, "\n").trim()
  : "";
if (deployKey) {
  keyFile = "/tmp/deploy-key";
  writeFileSync(keyFile, `${deployKey}\n`, { mode: 0o600 });
  keyArgs = ["-i", keyFile];
} else {
  const defaultKey = resolve(homedir(), ".ssh", "id_ed25519");
  if (existsSync(defaultKey)) {
    keyArgs = ["-i", defaultKey];
  }
}

const sshArgs = [
  ...keyArgs,
  "-o",
  "StrictHostKeyChecking=accept-new",
  "-o",
  "ConnectTimeout=15",
  "-o",
  "BatchMode=yes",
  `${user}@${host}`,
];

function runSSH(command) {
  console.log(`[ssh] ${user}@${host}: ${command}`);
  try {
    return run("ssh", [...sshArgs, "--", command]);
  } catch (error) {
    const message = error.stderr?.trimEnd() || error.message;
    throw new Error(`SSH command failed:\n  $ ${command}\n  ${message}`);
  }
}

function runLocalShell(command) {
  try {
    return run("bash", ["-lc", command]);
  } catch (error) {
    const message = error.stderr?.trimEnd() || error.message;
    throw new Error(`Local command failed:\n  $ ${command}\n  ${message}`);
  }
}

function sshCommandString(command) {
  return ["ssh", ...sshArgs, "--", command].map(shellEscape).join(" ");
}

function buildSanitizeEnvFileCommand() {
  return [
    'ENV_FILE="$REMOTE_DIR/.env.production"',
    'if [ -f "$ENV_FILE" ]; then TMP_FILE="${ENV_FILE}.sanitized"',
    `INVALID_COUNT=$(awk 'BEGIN{c=0} /^[[:space:]]*($|#)/ {next} /^[A-Za-z_][A-Za-z0-9_]*=.*/ {next} {c++} END{print c}' "$ENV_FILE")`,
    `awk '/^[[:space:]]*($|#)/ {print; next} /^[A-Za-z_][A-Za-z0-9_]*=.*/ {print; next} {next}' "$ENV_FILE" > "$TMP_FILE"`,
    'mv "$TMP_FILE" "$ENV_FILE"',
    'if [ "$INVALID_COUNT" -gt 0 ]; then echo "[deploy] sanitized $INVALID_COUNT invalid .env.production line(s)"; fi',
    "fi",
  ].join("; ");
}

try {
  const legacyProject = runSSH(
    "docker ps -a --filter name=assistedly-web-1 --format '{{.Names}}|{{.Label \"com.docker.compose.project\"}}' || true",
  );
  if (legacyProject.includes("assistedly-web-1|assistedly")) {
    runSSH(`cd ${repoDir} && docker compose ${composeFileFlag} -p assistedly down || true`);
  }

  const currentInfo = runSSH(
    [
      "CURRENT_IMAGE=$(docker inspect ",
      containerName,
      " --format '{{.Image}}' 2>/dev/null || true); ",
      "CURRENT_DIR=$(docker inspect ",
      containerName,
      " --format '{{ index .Config.Labels \"com.docker.compose.project.working_dir\" }}' 2>/dev/null || true); ",
      "printf '%s|%s\\n' \"$CURRENT_IMAGE\" \"$CURRENT_DIR\"",
    ].join(""),
  );
  const [previousImage = "", previousDir = ""] = currentInfo.split("|");

  console.log(
    previousDir
      ? `Previous live working dir: ${previousDir}`
      : `No active ${containerName} working dir detected.`,
  );
  if (previousImage) {
    console.log(`Previous live image: ${previousImage}`);
  }

  const remotePrepare = [
    "set -euo pipefail",
    `REMOTE_DIR="$HOME/${remoteDeployDirName}"`,
    'rm -rf "$REMOTE_DIR"',
    'mkdir -p "$REMOTE_DIR"',
    'tar -xf - -C "$REMOTE_DIR"',
    `cp ${shellEscape(`${repoDir}/.env.production`)} "$REMOTE_DIR/.env.production"`,
    buildSanitizeEnvFileCommand(),
  ].join("; ");

  runLocalShell(
    `cd ${shellEscape(process.cwd())} && git archive --format=tar HEAD | ${sshCommandString(remotePrepare)}`,
  );

  const remoteDeploy = [
    "set -euo pipefail",
    `REMOTE_DIR="$HOME/${remoteDeployDirName}"`,
    `PREVIOUS_DIR=${shellEscape(previousDir)}`,
    'cd "$REMOTE_DIR"',
    `docker compose ${composeFileFlag} -p ${shellEscape(composeProject)} config -q`,
    `docker build -t assistedly-web:local .`,
    `docker compose ${composeFileFlag} -p ${shellEscape(composeProject)} up -d --force-recreate`,
    `docker compose ${composeFileFlag} -p ${shellEscape(composeProject)} ps`,
    `docker inspect ${shellEscape(containerName)} --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}|{{.Image}}'`,
  ].join("; ");

  const deployOutput = runSSH(remoteDeploy);
  console.log(deployOutput);

  const remoteCleanup = `
set -euo pipefail
REMOTE_DIR="$HOME/${remoteDeployDirName}"
PREVIOUS_DIR=${shellEscape(previousDir)}
for dir in "$HOME"/assistedly-deploy-*; do
  [ -d "$dir" ] || continue
  if [ "$dir" = "$REMOTE_DIR" ]; then continue; fi
  if [ -n "$PREVIOUS_DIR" ] && [ "$dir" = "$PREVIOUS_DIR" ]; then continue; fi
  rm -rf "$dir"
done
printf "\\nRemaining deploy dirs:\\n"
ls -d "$HOME"/assistedly-deploy-* 2>/dev/null || echo none
`.trim();

  console.log(runSSH(remoteCleanup));
  console.log(`\nDeploy to ${host} succeeded.`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
} finally {
  if (keyFile) unlinkSync(keyFile);
}
