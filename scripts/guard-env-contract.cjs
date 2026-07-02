#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { ENV_CONTRACT_FILES, renderEnvFile } = require("./lib/env-contract.cjs");

const repoRoot = process.cwd();
let failed = false;

for (const fileSpec of ENV_CONTRACT_FILES) {
  const targetPath = path.join(repoRoot, fileSpec.path);
  const expected = renderEnvFile(fileSpec);
  const actual = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : "";
  if (actual !== expected) {
    process.stderr.write(
      `[guard:env-contract] ${fileSpec.path} is out of sync. Run: node scripts/sync-env-examples.cjs\n`,
    );
    failed = true;
  }
}

const forbiddenTrackedPaths = [".env.save"];
for (const forbiddenPath of forbiddenTrackedPaths) {
  if (fs.existsSync(path.join(repoRoot, forbiddenPath))) {
    process.stderr.write(
      `[guard:env-contract] ${forbiddenPath} should not be tracked. Remove it and keep only generated example files.\n`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
process.stdout.write("[guard:env-contract] OK\n");
