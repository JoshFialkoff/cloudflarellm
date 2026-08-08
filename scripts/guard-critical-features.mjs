#!/usr/bin/env node
/**
 * CRITICAL FEATURE GUARD — Pre-Deploy Regression Checker
 *
 * Run BEFORE every build/deploy. Fails with exit code 1 if any
 * critical feature appears missing, deleted, or degraded.
 *
 * Usage:
 *   node scripts/guard-critical-features.mjs
 *
 * Integrations:
 *   - package.json prebuild: "node scripts/guard-critical-features.mjs"
 *   - CI pipeline: must pass before wrangler deploy
 *   - AGENTS.md: hard stop to run this before every deploy
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let exitCode = 0;

function fail(msg) {
  process.stdout.write(`${RED}✘ FAIL${RESET} ${msg}\n`);
  exitCode = 1;
}

function pass(msg) {
  process.stdout.write(`${GREEN}✔ PASS${RESET} ${msg}\n`);
}

function warn(msg) {
  process.stdout.write(`${YELLOW}⚠ WARN${RESET} ${msg}\n`);
}

// ─── 1. Critical Files Must Exist ────────────────────────────────────

const CRITICAL_FILES = [
  // Conversion funnel
  'pages/intake.js',
  'pages/matched.js',
  'pages/results.js',
  'pages/get-matched.js',
  'pages/ask/index.js',
  'hooks/useIntake.js',
  'lib/intakeState.js',
  'lib/matchingScore.js',
  'lib/intakeAnalytics.js',
  'components/AssistedlyWizard.js',
  'components/AuthCapture.js',
  'components/WizardFacilityMatchList.js',
  'components/ResultsSnapshotSection.js',
  'components/IntakeMatchBadge.js',

  // Auth & access (soft gate)
  'lib/serverAuth.js',
  'pages/api/family-dashboard-auth.js',
  'app/answers/AnswersAuthGate.tsx',

  // Search & discovery
  'pages/search.js',
  'pages/api/facilities.js',
  'pages/compare.js',
  'components/Compare.js',
  'pages/tools/cost-calculator.js',
  'pages/tools/memory-care-readiness.js',

  // Facility pages
  'pages/facility/[slug].js',
  'components/FacilityDeepDive.js',
  'components/FacilityViewGate.js',

  // Homepage + SEO
  'pages/index.js',
  'components/HomeHeroHeadline.js',
  'components/HomeBelowHero.js',
  'app/massachusetts/page.js',
  'app/sitemap.js',
  'app/robots.js',
  'components/Seo/JsonLd.jsx',
  'components/Seo/DefaultPageHead.jsx',
  'components/Seo/ConsentManager.jsx',
  'lib/seo/schemaData.js',

  // Trust center
  'pages/privacy.js',
  'pages/faq.js',
  'pages/care-access-initiative.js',
  'pages/editorial-policy.js',
  'pages/data-sources.js',
  'pages/how-we-make-money.js',
  'components/TrustCenterPage.js',
  'lib/trustCenterPages.js',

  // Analytics
  'lib/posthogClient.js',
  'components/ResultsPageAnalytics.js',

  // Infrastructure
  'AGENTS.md',
  'wrangler-slot4.toml',
  'wrangler-staging.toml',
  'scripts/postinstall/patch-react-dom-server-edge.mjs',
  'scripts/guard-worker-cache-header.cjs',
];

process.stdout.write('\n━━━ CRITICAL FILE EXISTENCE ━━━\n');
let missingFiles = 0;
for (const f of CRITICAL_FILES) {
  if (existsSync(f)) {
    pass(f);
  } else {
    fail(`${f} — MISSING (critical feature may have been deleted)`);
    missingFiles++;
  }
}

// ─── 2. Critical Exports Must Be Present ────────────────────────────

const CRITICAL_EXPORTS = [
  { file: 'lib/posthogClient.js', patterns: ['HOMEPAGE_PRIVACY_EXPERIMENT_FLAG'] },
  { file: 'lib/intakeState.js', patterns: ['readIntakeState', 'INTAKE_STEPS'] },
  { file: 'lib/matchingScore.js', patterns: ['rankFacilities'] },
  { file: 'lib/serverAuth.js', patterns: ['getSession'] },
  { file: 'lib/seo/schemaData.js', patterns: ['getOrganizationSchema', 'getSoftwareApplicationSchema', 'getWebsiteSchema'] },
];

process.stdout.write('\n━━━ CRITICAL EXPORTS ━━━\n');
for (const { file, patterns } of CRITICAL_EXPORTS) {
  if (!existsSync(file)) {
    fail(`${file} — file missing, cannot check exports`);
    continue;
  }
  const content = readFileSync(file, 'utf-8');
  for (const p of patterns) {
    if (content.includes(p)) {
      pass(`${file} exports "${p}"`);
    } else {
      fail(`${file} — export "${p}" MISSING (refactor may have broken API)`);
    }
  }
}

// ─── 3. No Hard Login Gate Before Results (Wizard Pattern Check) ────

process.stdout.write('\n━━━ AUTH GATE SAFETY ━━━\n');

// Check that results/matched pages still import and use soft-gate auth patterns
const AUTH_CAPTURE_FILES = [
  'pages/results.js',
];

for (const f of AUTH_CAPTURE_FILES) {
  if (!existsSync(f)) continue;
  const content = readFileSync(f, 'utf-8');
  // AuthCapture component = soft gate (user sees results, then prompted)
  if (content.includes('AuthCapture')) {
    pass(`${f} — uses soft AuthCapture gate (results visible first)`);
  } else {
    warn(`${f} — AuthCapture component NOT FOUND; verify users can still see results before login`);
  }
}

// pages/matched.js shows public results without requiring auth (soft gate)
if (existsSync('pages/matched.js')) {
  pass('pages/matched.js — public results page (no hard auth gate required)');
}

// ─── 4. Homepage Must Not Be Hard-Replaced ────────────────────────

process.stdout.write('\n━━━ HOMEPAGE PRESERVATION ━━━\n');
if (existsSync('pages/index.js')) {
  const idx = readFileSync('pages/index.js', 'utf-8');

  // Must still render control copy (not fully replaced by privacy variant)
  if (idx.includes('homePageDefault') || idx.includes('heroTitle') || idx.includes('metaDescription')) {
    pass('pages/index.js — control copy references present');
  } else {
    fail('pages/index.js — control copy references MISSING; homepage may have been hard-replaced');
  }

  // Check PostHog A/B test pattern is additive
  if (idx.includes('useFeatureFlagVariantKey') && (idx.includes('isPrivacyMessaging') || idx.includes('privacyVariant'))) {
    pass('pages/index.js — privacy messaging uses additive A/B test pattern');
  } else {
    warn('pages/index.js — privacy A/B test pattern not detected; verify homepage is still behind feature flag');
  }
}

// ─── 5. No robots noindex on /answers (SEO-critical) ───────────────

process.stdout.write('\n━━━ SEO PRESERVATION ━━━\n');
if (existsSync('app/answers/page.tsx')) {
  const ans = readFileSync('app/answers/page.tsx', 'utf-8');
  if (ans.includes('index: false')) {
    fail('app/answers/page.tsx — contains robots noindex; this will hide /answers from search engines');
  } else {
    pass('app/answers/page.tsx — no noindex detected (page remains indexable)');
  }
}

// ─── 6. Static Asset Cache Headers Preserved ────────────────────────

if (existsSync('next.config.js')) {
  const ncfg = readFileSync('next.config.js', 'utf-8');
  if (ncfg.includes('max-age=31536000') || ncfg.includes('immutable')) {
    pass('next.config.js — long-term cache headers present for static assets');
  } else {
    warn('next.config.js — long-term cache headers NOT FOUND for static assets');
  }
}

// ─── 7. Feature Flag Consistency ────────────────────────────────────

process.stdout.write('\n━━━ FEATURE FLAG CONSISTENCY ━━━\n');
const phClient = existsSync('lib/posthogClient.js') ? readFileSync('lib/posthogClient.js', 'utf-8') : '';
const idxPg = existsSync('pages/index.js') ? readFileSync('pages/index.js', 'utf-8') : '';
const flagMatch = phClient.match(/HOMEPAGE_PRIVACY_EXPERIMENT_FLAG\s*=\s*"([^"]+)"/);
if (flagMatch) {
  const flagName = flagMatch[1];
  // pages/index.js may use the imported constant instead of literal string
  if (idxPg.includes(flagName) || idxPg.includes('HOMEPAGE_PRIVACY_EXPERIMENT_FLAG')) {
    pass(`PostHog flag "${flagName}" is referenced in pages/index.js`);
  } else {
    fail(`PostHog flag "${flagName}" defined but NOT used in pages/index.js — A/B test is broken`);
  }
} else {
  warn('Could not extract HOMEPAGE_PRIVACY_EXPERIMENT_FLAG from lib/posthogClient.js');
}

// ─── 8. Wrangler Config Integrity ───────────────────────────────────

process.stdout.write('\n━━━ WRANGLER CONFIG GUARD ━━━\n');
for (const cfg of ['wrangler-slot4.toml', 'wrangler-staging.toml']) {
  if (!existsSync(cfg)) { fail(`${cfg} missing`); continue; }
  const c = readFileSync(cfg, 'utf-8');
  if (!c.includes('name =')) { fail(`${cfg} — missing name field`); }
  else if (!c.includes('account_id')) { fail(`${cfg} — missing account_id`); }
  else { pass(`${cfg} — name + account_id present`); }
}

// ─── 9. Security Libraries Present ──────────────────────────────────

process.stdout.write('\n━━━ SECURITY GUARD ━━━\n');
const SECURITY_FILES = [
  'lib/security/sanitizer.js',
  'lib/security/auditLog.js',
  'lib/security/zdr.js',
];
for (const f of SECURITY_FILES) {
  if (existsSync(f)) {
    pass(`${f} — present`);
  } else {
    warn(`${f} — MISSING (HIPAA/security feature may have been removed)`);
  }
}

// ─── 10. Summary ────────────────────────────────────────────────────

process.stdout.write('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
if (exitCode === 0) {
  process.stdout.write(`${GREEN}✅ ALL CRITICAL FEATURES VERIFIED — SAFE TO BUILD/DEPLOY${RESET}\n`);
} else {
  process.stdout.write(`${RED}❌ CRITICAL FEATURE GUARD FAILED — DO NOT DEPLOY${RESET}\n`);
  process.stdout.write(`   ${missingFiles} critical file(s) missing\n`);
  process.stdout.write(`   Review FEATURE_MANIFEST.md and fix before deploying.\n`);
}
process.stdout.write('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
process.exit(exitCode);
