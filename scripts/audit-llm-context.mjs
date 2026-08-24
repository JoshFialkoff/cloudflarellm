import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const VIOLATIONS = [
  { type: "IP Address",         regex: /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/g },
  { type: "RackNerd Hostname",  regex: /racknerd-[a-f0-9]+/gi },
  { type: "Discord Webhook",    regex: /discord\.com\/api\/webhooks\/\d+\/[^\s"]+/gi },
  { type: "SSH Key Path",       regex: /~\/\.ssh\/[^\s"]+/g },
  { type: "Partner/BD Strategy", regex: /partner.?pilot|outreach.*automation|crisp.*intercom.*olark.*zoho/gi },
  { type: "BD Workflow",        regex: /schedule kickoff call|partnership one.pager|pilot agreement|transparent economics/gi },
  { type: "Internal Path",      regex: /\/opt\/[^\s"]+|127\.0\.0\.1:\d{4,5}/g },
  { type: "JWT / Token",        regex: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g },
];

const SCAN_PATHS = [
  ".goose/rules.md",
  ".goose/guardrails.md",
];

function scanFile(filepath) {
  const abs = resolve(filepath);
  if (!existsSync(abs)) return [];
  const content = readFileSync(abs, "utf8");
  const lines = content.split("\n");
  const findings = [];
  for (const { type, regex } of VIOLATIONS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const lineNo = content.substring(0, match.index).split("\n").length;
      findings.push({ file: filepath, line: lineNo, type, snippet: lines[lineNo - 1]?.trim().slice(0, 100) || "" });
    }
  }
  return findings;
}

let all = [];
for (const p of SCAN_PATHS) all.push(...scanFile(p));

if (all.length > 0) {
  console.error("\n❌ PROPRIETARY DATA LEAK DETECTED:\n");
  for (const f of all) {
    console.error(`  ${f.file}:${f.line} [${f.type}]`);
    console.error(`     → ${f.snippet}\n`);
  }
  process.exit(1);
}

console.log("✅ LLM context audit passed.");
process.exit(0);
