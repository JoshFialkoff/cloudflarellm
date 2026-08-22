#!/usr/bin/env node
/**
 * audit-secret-exposure.cjs
 * Layer 3A: Detect exposed secrets in shell commands or text output.
 *
 * Usage:
 *   echo "some text" | node scripts/audit-secret-exposure.cjs
 *   node scripts/audit-secret-exposure.cjs file.txt
 *   node scripts/audit-secret-exposure.cjs --dir ./logs
 *
 * Exit codes:
 *   0 = clean, no exposed secrets detected
 *   1 = potential exposed secrets found
 *
 * Design principle: Conservative. We’d rather flag suspicious patterns
 * than let a bot leak a key into the shell history or git.
 */

const fs = require("fs");
const path = require("path");

// Patterns that indicate a secret was typed into a shell command visible in chat
const DANGEROUS_PATTERNS = [
  // Any API key-like token after an equals sign inside curl/httpie strings
  // Matches: api_key=abc123, api-key=abc123, token=abc123, etc.
  {
    re: /(?:api[_-]?key|token|secret|password|auth)[\s=";=:]+\s*['"]?[a-zA-Z0-9_\-]{16,}['"]?/i,
    desc: "API key/token/password appears assigned to a keyword (not via env injection)",
    severity: "HIGH",
  },
  // Bearer token in curl headers with literal value
  {
    re: /[\-]H\s*['"]?Authorization:\s*Bearer\s+[a-zA-Z0-9_\-.]{10,}/i,
    desc: "Bearer token passed literally in curl -H",
    severity: "HIGH",
  },
  // x-api-key header with literal value
  {
    re: /[\-]H\s*['"]?x-api-key:\s*[a-zA-Z0-9_\-.]{10,}/i,
    desc: "x-api-key passed literally in curl -H",
    severity: "HIGH",
  },
  // Plane-specific key pattern (already exposed today)
  {
    re: /plane_api_[a-f0-9]{32,}/i,
    desc: "Plane API key literal detected",
    severity: "CRITICAL",
  },
  // Cloudflare API token pattern
  {
    re: /[a-f0-9]{40}/i,
    desc: "Hex string that looks like a token/hash (review manually)",
    severity: "WARN",
  },
];

// SAFE patterns — these reduce false positives
const SAFE_PATTERNS = [
  // Command substitution retrieving from keychain (safe)
  /\$\(security find-generic-password.*-w\)/g,
  // Infisical run wrapping (safe)
  /infisical run[\s\-]/gi,
  // Env var reference (safe-ish, though env might contain plaintext)
  /\$[A-Z_]+/g,
  // REACTED marker
  /REDACTED/gi,
  // UUIDs in URLs / DB IDs (false positive risk)
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
];

function looksSuspicious(line) {
  const findings = [];
  for (const rule of DANGEROUS_PATTERNS) {
    const match = line.match(rule.re);
    if (match) {
      // Check if this specific match is covered by a safe pattern
      const matchedText = match[0];
      const isSafe = SAFE_PATTERNS.some(
        (safeRe) => safeRe.test(matchedText) || safeRe.test(line)
      );
      if (!isSafe) {
        findings.push({
          severity: rule.severity,
          desc: rule.desc,
          snippet: matchedText.slice(0, 60),
        });
      }
    }
  }
  return findings;
}

function scanText(text, sourceLabel) {
  const lines = text.split(/\r?\n/);
  let findingsAll = [];
  for (let i = 0; i < lines.length; i++) {
    const findings = looksSuspicious(lines[i]);
    for (const f of findings) {
      findingsAll.push({ ...f, line: i + 1, source: sourceLabel });
    }
  }
  return findingsAll;
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return scanText(text, filePath);
}

function scanDir(dirPath, extensions = new Set([".sh", ".mjs", ".cjs", ".js", ".txt", ".log", ".md"])) {
  let findingsAll = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (["node_modules", ".git", ".open-next", ".next", "coverage", "dist"].includes(entry.name))
        continue;
      findingsAll = findingsAll.concat(scanDir(full, extensions));
    } else {
      const ext = path.extname(entry.name);
      if (extensions.has(ext)) {
        findingsAll = findingsAll.concat(scanFile(full));
      }
    }
  }
  return findingsAll;
}

function printReport(findings) {
  if (findings.length === 0) {
    console.log("✅ No exposed secrets detected.");
    return 0;
  }
  console.error(`❌ ${findings.length} potential secret exposure(s) detected:`);
  for (const f of findings) {
    console.error(
      `  [${f.severity}] ${f.source}:${f.line}\n    ${f.desc}\n    Snippet: ${f.snippet}\n`
    );
  }
  console.error(
    "\nRemediate by using env injection or Keychain substitution, e.g.:\n" +
    "  $(security find-generic-password -s '<service>' -w)\n" +
    "  infisical run --env=dev -- <command>\n"
  );
  return 1;
}

// ─── CLI ───
const args = process.argv.slice(2);
let findings = [];

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage:
  node scripts/audit-secret-exposure.cjs [file]
  echo "text" | node scripts/audit-secret-exposure.cjs
  node scripts/audit-secret-exposure.cjs --dir <directory>

Exit 1 if potential secrets are found. Conservative scanning.`);
  process.exit(0);
}

if (args.includes("--dir")) {
  const dirIdx = args.indexOf("--dir");
  const dirPath = args[dirIdx + 1];
  if (!dirPath || !fs.existsSync(dirPath)) {
    console.error("Usage: --dir <path>");
    process.exit(2);
  }
  findings = scanDir(dirPath);
} else if (args.length > 0) {
  const filePath = args[0];
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(2);
  }
  findings = scanFile(filePath);
} else {
  // stdin mode
  let stdin = "";
  process.stdin.on("data", (chunk) => (stdin += chunk));
  process.stdin.on("end", () => {
    findings = scanText(stdin, "<stdin>");
    process.exit(printReport(findings));
  });
  return; // wait for stdin
}

process.exit(printReport(findings));
