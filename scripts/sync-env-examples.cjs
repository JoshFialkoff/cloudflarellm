#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { ENV_CONTRACT_FILES, renderEnvFile } = require("./lib/env-contract.cjs");

const repoRoot = process.cwd();

for (const fileSpec of ENV_CONTRACT_FILES) {
  const outputPath = path.join(repoRoot, fileSpec.path);
  fs.writeFileSync(outputPath, renderEnvFile(fileSpec), "utf8");
  process.stdout.write(`Synced ${fileSpec.path}\n`);
}
