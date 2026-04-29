#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const bannedPhrase = "AI-assisted matching for Massachusetts families";
const targetFile = path.join(process.cwd(), "lib", "landingPersonalization.js");

let content = "";
try {
  content = fs.readFileSync(targetFile, "utf8");
} catch (error) {
  console.error(`[guard:homepage-copy] Failed reading ${targetFile}`);
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}

if (content.includes(bannedPhrase)) {
  console.error(
    `[guard:homepage-copy] Found banned phrase in lib/landingPersonalization.js: "${bannedPhrase}"`,
  );
  process.exit(1);
}

console.log("[guard:homepage-copy] OK");
