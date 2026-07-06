#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { resolveContractFile } = require("./lib/env-contract.cjs");

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const keys = [];
  const invalidLines = [];
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      invalidLines.push(index + 1);
      continue;
    }
    keys.push(line.slice(0, eqIndex).trim());
  }
  return { keys, invalidLines };
}

const args = process.argv.slice(2);
const profileIndex = args.findIndex((arg) => arg.startsWith("--profile="));
const profile = profileIndex >= 0 ? args.splice(profileIndex, 1)[0].slice("--profile=".length) : "app";
const files = args;

if (!files.length) {
  process.stderr.write("Usage: node scripts/check-env-contract.cjs --profile=app <env-file> [env-file...]\n");
  process.exit(1);
}

const repoRoot = process.cwd();
const contract = resolveContractFile(repoRoot, profile);
if (!contract) {
  process.stderr.write(`Unknown env contract profile: ${profile}\n`);
  process.exit(1);
}

const contractKeys = new Set(
  contract.sections.flatMap((currentSection) => currentSection.entries.map((currentEntry) => currentEntry.name)),
);

let failed = false;

for (const inputPath of files) {
  const resolvedPath = path.resolve(repoRoot, inputPath);
  if (!fs.existsSync(resolvedPath)) {
    process.stderr.write(`[env:check] Missing file: ${inputPath}\n`);
    failed = true;
    continue;
  }

  const { keys, invalidLines } = parseEnvFile(resolvedPath);
  const fileKeys = new Set(keys);
  const missing = [...contractKeys].filter((key) => !fileKeys.has(key));
  const extras = [...fileKeys].filter((key) => !contractKeys.has(key)).sort();

  if (invalidLines.length) {
    process.stderr.write(`[env:check] ${inputPath} has invalid lines: ${invalidLines.join(", ")}\n`);
    failed = true;
  }

  if (missing.length) {
    process.stderr.write(
      `[env:check] ${inputPath} is missing ${missing.length} contract keys:\n${missing
        .map((key) => `  - ${key}`)
        .join("\n")}\n`,
    );
    failed = true;
  }

  if (extras.length) {
    process.stdout.write(
      `[env:check] ${inputPath} has ${extras.length} extra keys not in the ${profile} contract:\n${extras
        .map((key) => `  - ${key}`)
        .join("\n")}\n`,
    );
  }

  if (!invalidLines.length && !missing.length) {
    process.stdout.write(`[env:check] ${inputPath} matches the ${profile} contract keys.\n`);
  }
}

if (failed) process.exit(1);
