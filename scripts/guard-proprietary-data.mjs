#!/usr/bin/env node
/**
 * PROPRIETARY DATA GUARD
 *
 * Protects Assistedly, Inc. and assistedly.ai proprietary data assets,
 * including the FOIA pipeline infrastructure and Firecrawl integration.
 *
 * 1. Ensures critical proprietary pipeline files exist (FOIA, Firecrawl,
 *    intelligence libraries).
 * 2. Ensures proprietary data assets (chart-facilities.json) are present.
 * 3. Scans the committed codebase for hardcoded API keys / tokens.
 * 4. Validates that sensitive output directories remain gitignored.
 *
 * Run BEFORE every build/deploy. Fails with exit code 1 if any
 * proprietary asset is missing or if secrets are exposed.
 *
 * Usage:
 *   node scripts/guard-proprietary-data.mjs
 *
 * Integrations:
 *   - package.json test:guards
 *   - scripts/monitor-guards.cjs
 *   - scripts/guard-critical-features.mjs (called as sub-guard)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let exitCode = 0;
const seen = new Set();

function fail(msg) {
  const hash = msg.slice(0, 120);
  if (seen.has(hash)) return;
  seen.add(hash);
  process.stdout.write(`${RED}✘ FAIL${RESET} ${msg}\n`);
  exitCode = 1;
}

function pass(msg) {
  process.stdout.write(`${GREEN}✔ PASS${RESET} ${msg}\n`);
}

function warn(msg) {
  process.stdout.write(`${YELLOW}⚠ WARN${RESET} ${msg}\n`);
}

function section(title) {
  process.stdout.write(`\n${CYAN}━━━ ${title} ━━━${RESET}\n`);
}

// ─── Helpers ────────────────────────────────────────────────────────

function resolve(...segments) {
  return join(REPO_ROOT, ...segments);
}

function fileExists(relPath) {
  return existsSync(resolve(relPath));
}

function readText(relPath) {
  try { return readFileSync(resolve(relPath), 'utf-8'); } catch { return null; }
}

function walk(dir, opts = {}) {
  const { include, exclude, currentDepth = 0, maxDepth = Infinity } = opts;
  if (currentDepth > maxDepth) return [];
  let files = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (exclude && exclude.some(e => full.includes(e))) continue;
        files = files.concat(walk(full, { ...opts, currentDepth: currentDepth + 1 }));
      } else {
        if (include && !include.some(ext => full.endsWith(ext))) continue;
        if (exclude && exclude.some(e => full.includes(e))) continue;
        files.push(full);
      }
    }
  } catch {}
  return files;
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#');
}

function isSafeLine(line) {
  if (isCommentLine(line)) return true;
  if (line.includes('process.env.')) return true;
  if (line.includes('REDACTED')) return true;
  if (/\b(xxx+|placeholder|example_|your_|mock_|test_|dummy_|fake_)/i.test(line)) return true;
  return false;
}

// ─── 1. FOIA PIPELINE INFRASTRUCTURE ─────────────────────────────

section('FOIA PIPELINE INFRASTRUCTURE');

const FOIA_PIPELINE_FILES = [
  'scripts/transform-foia-to-charts.cjs',
  'scripts/sync-noco-to-charts.cjs',
  'scripts/sync-facility-intelligence.cjs',
  'lib/citations.js',
  'lib/massachusettsFacilities.js',
];

for (const f of FOIA_PIPELINE_FILES) {
  if (fileExists(f)) {
    pass(`${f} — present`);
  } else {
    fail(`${f} — MISSING — FOIA pipeline integrity compromised`);
  }
}

// ─── 2. FIRECRAWL INTEGRATION ────────────────────────────────────

section('FIRECRAWL INTEGRATION');

const FIRECRAWL_FILES = [
  'scripts/firecrawl-social-engagement.cjs',
  'scripts/firecrawl-ma-enrichment.cjs',
  'scripts/enrich-facilities-with-firecrawl.py',
  'scripts/sync-reviews-to-nocodb.cjs',
  'scripts/lib/firecrawl-plugin-cli.cjs',
  'scripts/lib/intelligence-extractors.cjs',
];

for (const f of FIRECRAWL_FILES) {
  if (fileExists(f)) {
    pass(`${f} — present`);
  } else {
    fail(`${f} — MISSING — Firecrawl integration compromised`);
  }
}

// ─── 3. INTELLIGENCE LIBRARIES ───────────────────────────────────

section('INTELLIGENCE LIBRARIES');

const INTELLIGENCE_LIBS = [
  'scripts/lib/forensics-engine.cjs',
  'scripts/lib/occupancy-proxy.cjs',
  'scripts/lib/sentiment-scorer.cjs',
  'scripts/lib/velocity-calculator.cjs',
];

for (const f of INTELLIGENCE_LIBS) {
  if (fileExists(f)) {
    pass(`${f} — present`);
  } else {
    fail(`${f} — MISSING — intelligence library set compromised`);
  }
}

// ─── 4. PROPRIETARY DATA ASSETS ──────────────────────────────────

section('PROPRIETARY DATA ASSETS');

const DATA_ASSETS = [
  'public/data/chart-facilities.json',
];

for (const f of DATA_ASSETS) {
  if (fileExists(f)) {
    const text = readText(f);
    let count = 0;
    try {
      const parsed = JSON.parse(text);
      count = parsed.facilities?.length || parsed.length || 0;
    } catch {
      count = -1;
    }
    if (count > 0) {
      pass(`${f} — present (${count} records)`);
    } else if (count === 0) {
      fail(`${f} — EMPTY — proprietary dataset has no records`);
    } else {
      fail(`${f} — INVALID JSON`);
    }
  } else {
    fail(`${f} — MISSING — proprietary dataset not found`);
  }
}

// ─── 5. HARDCODED SECRET SCAN ────────────────────────────────────

section('HARDCODED SECRET SCAN');

const SECRET_NAMES = [
  'FIRECRAWL_API_KEY',
  'NOCODB_API_TOKEN',
  'NOCODB_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'POSTHOG_API_KEY',
  'OPENAI_API_KEY',
  'DIFY_API_KEY',
  'DIFY_WORKFLOW_API_KEY',
  'FACILITY_DEEP_DIVE_DIFY_API_KEY',
  'FACILITY_KB_INSIGHT_DIFY_API_KEY',
  'REDDIT_CLIENT_SECRET',
  'REDDIT_ADS_ACCESS_TOKEN',
  'AUTH_MAGIC_LINK_SECRET',
  'NEXTAUTH_SECRET',
  'RESEND_API_KEY',
  'GA4_ACCESS_TOKEN',
];

const secretPattern = new RegExp(
  '(?:^|[^\\w.])(' + SECRET_NAMES.join('|') + ')\\s*[:=]\\s*["\']([^"\']{8,})["\']',
  'i'
);

const scanPaths = [
  'scripts',
  'lib',
  'app',
  'pages',
  'components',
  'hooks',
];

const scanExts = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.py'];
const scanExclude = ['node_modules', '.next', '.open-next', 'coverage', 'dist', '__tests__'];

let secretFindings = 0;

for (const scanDir of scanPaths) {
  const fullDir = resolve(scanDir);
  if (!existsSync(fullDir)) continue;

  const files = walk(fullDir, {
    include: scanExts,
    exclude: scanExclude,
  });

  for (const filePath of files) {
    // Skip .example files and test files
    const base = filePath.split('/').pop();
    if (base.includes('.example') || base.includes('.test.') || base.includes('.spec.')) continue;

    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isSafeLine(line)) continue;

      const match = line.match(secretPattern);
      if (match) {
        const varName = match[1];
        const snippet = match[2].slice(0, 20) + (match[2].length > 20 ? '…' : '');
        fail(`Hardcoded secret in ${filePath}:${i + 1} — ${varName} = "${snippet}"`);
        secretFindings++;
      }
    }
  }
}

if (secretFindings === 0) {
  pass('No hardcoded secrets detected in scanned codebase');
}

// ─── 6. .GITIGNORE EXCLUSIONS ────────────────────────────────────

section('.GITIGNORE EXCLUSIONS');

const gitignorePath = resolve('.gitignore');
let gitignore = '';
try { gitignore = readFileSync(gitignorePath, 'utf-8'); } catch {}

const REQUIRED_GITIGNORES = [
  '.firecrawl/',
  'public/data/review-snapshots/',
  'public/data/intelligence-snapshots/',
  'public/data/comp-sets/',
  '.env',
  '.env.production',
  'cf.env',
];

for (const pattern of REQUIRED_GITIGNORES) {
  if (gitignore.includes(pattern)) {
    pass(`.gitignore excludes ${pattern}`);
  } else {
    fail(`.gitignore MISSING exclusion for ${pattern} — sensitive data may be committed`);
  }
}

// ─── 7. AGENTS.md & FEATURE_MANIFEST.md PRESENCE ─────────────────

section('SAFEGUARD DOCUMENTS');

for (const f of ['AGENTS.md', 'FEATURE_MANIFEST.md']) {
  if (fileExists(f)) {
    pass(`${f} — present`);
  } else {
    fail(`${f} — MISSING — critical safeguard documentation removed`);
  }
}

// ─── SUMMARY ─────────────────────────────────────────────────────

process.stdout.write(`\n${'━'.repeat(50)}\n`);
if (exitCode === 0) {
  process.stdout.write(`${GREEN}✅ PROPRIETARY DATA GUARD PASSED${RESET}\n`);
} else {
  process.stdout.write(`${RED}❌ PROPRIETARY DATA GUARD FAILED — DO NOT DEPLOY${RESET}\n`);
  process.stdout.write(`${RED}   Fix the failures above before deploying.${RESET}\n`);
}
process.stdout.write(`${'━'.repeat(50)}\n\n`);
process.exit(exitCode);
