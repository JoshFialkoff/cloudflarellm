#!/usr/bin/env node
/**
 * SSH into the production host, pull latest, rebuild and restart Docker stack.
 *
 * Usage:
 *   node scripts/ci/trigger-deploy.mjs --host ssh.assistedly.ai
 *   DEPLOY_HOST=ssh.assistedly.ai node scripts/ci/trigger-deploy.mjs
 *
 * Env: DEPLOY_HOST, DEPLOY_KEY (optional — falls back to ~/.ssh/id_ed25519)
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const host =
  process.argv.find((a) => a.startsWith("--host="))?.slice("--host=".length) ||
  process.env.DEPLOY_HOST;

if (!host) {
  console.error("Usage: trigger-deploy.mjs --host=<ip> (or DEPLOY_HOST env)");
  process.exit(1);
}

const repoDir = "/opt/assistedly";
const user = "opencode";

let keyFile;
let keyFlag = [];
const deployKey = process.env.DEPLOY_KEY;
if (deployKey) {
  keyFile = "/tmp/deploy-key";
  writeFileSync(keyFile, deployKey, { mode: 0o600 });
  keyFlag = ["-i", keyFile];
} else {
  const defaultKey = resolve(homedir(), ".ssh", "id_ed25519");
  if (existsSync(defaultKey)) {
    keyFlag = ["-i", defaultKey];
  }
}

const sshArgs = [
  ...keyFlag,
  "-o", "StrictHostKeyChecking=accept-new",
  "-o", "ConnectTimeout=15",
  "-o", "BatchMode=yes",
  `${user}@${host}`,
];

function runSSH(command) {
  const args = [...sshArgs, "--", command];
  console.log(`[ssh] ${user}@${host}: ${command}`);
  try {
    const out = execFileSync("ssh", args, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 600_000,
    });
    console.log(out.trimEnd());
  } catch (err) {
    const msg = err.stderr?.trimEnd() || err.message;
    throw new Error(
      `SSH command failed:\n  $ ${command}\n  ${msg}`,
    );
  }
}

try {
  runSSH(`cd ${repoDir} && pwd`);
  runSSH(`cd ${repoDir} && git pull`);
  runSSH(`cd ${repoDir} && docker compose build --pull`);
  runSSH(`cd ${repoDir} && docker compose up -d`);

  console.log(`\nDeploy to ${host} succeeded.`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
} finally {
  if (keyFile) unlinkSync(keyFile);
}
