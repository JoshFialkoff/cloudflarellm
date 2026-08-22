#!/usr/bin/env node
/**
 * CRITICAL FEATURE GUARD — Pattern-Based Pre-Deploy Regression Checker
 *
 * Run BEFORE every build/deploy. Fails with exit code 1 if any
 * behavioral regression is detected, regardless of file names.
 *
 * This is PATTERN-BASED, not file-name-based. It detects regressions
 * by looking for behavioral patterns across ALL files.
 *
 * Usage:
 *   node scripts/guard-critical-features.mjs
 *
 * Integrations:
 *   - package.json prebuild: "node scripts/guard-critical-features.mjs"
 *   - CI pipeline: must pass before wrangler deploy
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { execSync } from 'child_process';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let exitCode = 0;
const seen = new Set();

function fail(msg) {
  const hash = msg.slice(0, 80);
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

function walk(dir, opts = {}) {
  const { include, exclude, depth = Infinity, currentDepth = 0 } = opts;
  if (currentDepth > depth) return [];
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

function readAll(files) {
  const map = new Map();
  for (const f of files) {
    try { map.set(f, readFileSync(f, 'utf-8')); } catch {}
  }
  return map;
}

function hasPattern(content, patterns) {
  if (!content) return false;
  return patterns.some(p => {
    if (typeof p === 'string') return content.includes(p);
    if (p instanceof RegExp) return p.test(content);
    return false;
  });
}

function countByDir(files, dir) {
  return files.filter(f => f.startsWith(dir)).length;
}

// ─── 1. ROUTE INVENTORY MINIMUMS (Generic Counts) ────────────────

section('ROUTE INVENTORY (GENERIC COUNTS)');

const pagesRouterFiles = walk('pages', {
  include: ['.js', '.jsx', '.tsx', '.ts'],
  exclude: ['node_modules', '.next', '.open-next', '_app.js', '_document.js', 'api/']
});
const appRouterFiles = walk('app', {
  include: ['.js', '.jsx', '.tsx', '.ts'],
  exclude: ['node_modules', '.next', '.open-next'],
  depth: 3
});
const apiFiles = walk('pages/api', {
  include: ['.js', '.ts'],
  exclude: ['node_modules', '.next', '.open-next']
});

const pageCount = pagesRouterFiles.filter(f => !f.includes('/api/')).length;
const appPageCount = appRouterFiles.filter(f => basename(f) === 'page.tsx' || basename(f) === 'page.js').length;
const totalRoutes = pageCount + appPageCount;
const apiCount = apiFiles.length;

const MIN_PAGES = 20;
const MIN_API_ROUTES = 10;

if (totalRoutes >= MIN_PAGES) {
  pass(`Total routes: ${totalRoutes} (min: ${MIN_PAGES}) ✅`);
} else {
  fail(`Total routes: ${totalRoutes} (min: ${MIN_PAGES}) — CRITICAL PAGES MAY HAVE BEEN DELETED`);
}

if (apiCount >= MIN_API_ROUTES) {
  pass(`API routes: ${apiCount} (min: ${MIN_API_ROUTES}) ✅`);
} else {
  fail(`API routes: ${apiCount} (min: ${MIN_API_ROUTES}) — CRITICAL API ENDPOINTS MAY HAVE BEEN DELETED`);
}

// ─── 2. CRITICAL PATTERN INVENTORY (Content-Based) ──────────────

section('CRITICAL PATTERN INVENTORY (BEHAVIOR-BASED)');

const allJsxFiles = walk('.', {
  include: ['.js', '.jsx', '.tsx', '.ts'],
  exclude: ['node_modules', '.next', '.open-next', 'scripts/', 'hooks/']
});

// Gather all content
const fileContents = readAll(allJsxFiles);

// --- Pattern: Lead Capture Flow ---
const hasIntakePattern = [...fileContents.values()].some(c =>
  hasPattern(c, ['readIntakeState', 'INTAKE_STEPS', 'care_needs', 'budget', 'location', 'timing', 'priorities'])
);
if (hasIntakePattern) {
  pass('Intake flow patterns detected (readIntakeState, INTAKE_STEPS)');
} else {
  fail('NO intake flow patterns found — lead-capture wizard may have been removed');
}

// --- Pattern: Facility Matching ---
const hasMatchingPattern = [...fileContents.values()].some(c =>
  hasPattern(c, ['rankFacilities', 'MASSACHUSETTS_FACILITIES', 'buildFacilityProfile', 'matchingScore'])
);
if (hasMatchingPattern) {
  pass('Facility matching patterns detected (rankFacilities, MASSACHUSETTS_FACILITIES)');
} else {
  fail('NO facility matching patterns found — core matching engine may have been removed');
}

// --- Pattern: Results Rendering ---
const hasResultsPattern = [...fileContents.values()].some(c =>
  hasPattern(c, ['WizardFacilityMatchList', 'ResultsSnapshotSection', '<FacilityDeepDive', 'snapshotFacilitiesToMatchItems'])
);
if (hasResultsPattern) {
  pass('Results rendering patterns detected (WizardFacilityMatchList, ResultsSnapshotSection)');
} else {
  fail('NO results rendering patterns found — results display may have been removed');
}

// --- Pattern: Soft Auth Gate (results before login) ---
const hasSoftGate = [...fileContents.entries()].some(([path, c]) =>
  c.includes('AuthCapture') && (path.includes('results') || path.includes('matched') || path.includes('search') || path.includes('facility/') || path.includes('compare'))
);
if (hasSoftGate) {
  pass('Soft AuthCapture gate detected on results/search/facility pages (results visible before login)');
} else {
  fail('NO soft AuthCapture gate found on results pages — users may be blocked from seeing results');
}

// --- Pattern: Search Interface ---
const hasSearchPattern = [...fileContents.values()].some(c =>
  hasPattern(c, ['facilities.js', 'api/facilities', 'search.*facility', 'facility.*search'])
);
// Also check there IS a search API and search page
const searchApiExists = allJsxFiles.some(f => f.includes('api/facilities') || f.includes('api/search'));
const searchPageExists = allJsxFiles.some(f => f.endsWith('/search.js'));
if (searchApiExists && searchPageExists) {
  pass('Search page + search API both present');
} else if (searchPageExists) {
  pass('Search page present');
} else {
  warn('Search page NOT detected — verify it still exists');
}

// --- Pattern: Chat / Ask Interface ---
const hasChatPattern = [...fileContents.values()].some(c =>
  hasPattern(c, ['/ask', 'ask-chat', 'Dify.*chat', 'chat.*message', 'chatInput', 'onSendMessage'])
) || allJsxFiles.some(f => f.endsWith('/ask/index.js'));
if (hasChatPattern) {
  pass('Chat/ask interface patterns detected');
} else {
  warn('NO chat/ask interface patterns found — verify /ask page still exists');
}

// --- Pattern: Cost Calculator ---
const hasCostCalc = [...fileContents.values()].some(c =>
  hasPattern(c, ['CalculatorSnapshot', 'cost-calculator', 'cost.*calculator', 'monthlyEstimate'])
) || allJsxFiles.some(f => f.includes('cost-calculator'));
if (hasCostCalc) {
  pass('Cost calculator patterns detected');
} else {
  warn('NO cost calculator patterns found');
}

// --- Pattern: Compare Tool ---
const hasCompare = [...fileContents.values()].some(c =>
  hasPattern(c, ['CompareTable', 'CompareModal', 'ShareComparisonModal', 'handleCompare'])
) || allJsxFiles.some(f => f.includes('/compare'));
if (hasCompare) {
  pass('Compare tool patterns detected');
} else {
  warn('NO compare tool patterns found');
}

// --- Pattern: PostHog Analytics ---
const hasPostHog = [...fileContents.values()].some(c =>
  hasPattern(c, ['posthog', 'track', 'capture', 'useFeatureFlag'])
);
if (hasPostHog) {
  pass('PostHog analytics patterns detected');
} else {
  fail('NO PostHog analytics patterns found — all tracking may have been removed');
}

// --- Pattern: A/B Test Infrastructure ---
const hasABTest = [...fileContents.values()].some(c =>
  hasPattern(c, ['useFeatureFlagVariantKey', 'HOMEPAGE_PRIVACY_EXPERIMENT_FLAG', 'isPrivacyMessaging', 'privacyVariant'])
);
if (hasABTest) {
  pass('A/B test infrastructure detected');
} else {
  warn('NO A/B test patterns found — has PostHog feature flag usage been removed?');
}

// ─── 3. HARDCODED CRITICAL FILE ANCHORS (Specific Backstops) ────

section('CRITICAL FILE ANCHORS (KNOWN ESSENTIAL FILES)');

// These are specific files that MUST exist because we know they're critical
const CRITICAL_FILE_ANCHORS = [
  'pages/intake.js',
  'pages/matched.js',
  'pages/results.js',
  'pages/get-matched.js',
  'pages/ask/index.js',
  'pages/search.js',
  'pages/compare.js',
  'pages/tools/cost-calculator.js',
  'pages/tools/memory-care-readiness.js',
  'pages/facility/[slug].js',
  'hooks/useIntake.js',
  'lib/intakeState.js',
  'lib/matchingScore.js',
  'lib/posthogClient.js',
  'components/AssistedlyWizard.js',
  'components/AuthCapture.js',
  'components/WizardFacilityMatchList.js',
  'components/ResultsSnapshotSection.js',
  'lib/serverAuth.js',
  'app/answers/AnswersAuthGate.tsx',
  'app/massachusetts/page.js',
  'app/sitemap.js',
  'app/robots.js',
  'components/Seo/JsonLd.jsx',
  'components/Seo/ConsentManager.jsx',
  'lib/seo/schemaData.js',
];

let anchorMissing = 0;
for (const f of CRITICAL_FILE_ANCHORS) {
  if (existsSync(f)) {
    pass(f);
  } else {
    fail(`${f} — MISSING (known critical file)`);
    anchorMissing++;
  }
}

if (anchorMissing > 0) {
  fail(`${anchorMissing} known critical file(s) missing — IMMEDIATE ATTENTION REQUIRED`);
}

// ─── 4. HARD AUTH GATE DETECTION ────────────────────────────────

section('AUTH GATE SAFETY (PATTERN-BASED)');

// Detect hard gates: if ( !session ) { redirect } before ANY content
const pageFiles = [...fileContents.entries()].filter(([path]) =>
  path.startsWith('pages/') && !path.includes('/api/') && !path.includes('_app') && !path.includes('_document')
    && !path.includes('admin/') && !path.includes('family-dashboard')
);

let hardGateCount = 0;
for (const [path, content] of pageFiles) {
  // Skip known admin/dashboard pages (intentionally gated)
  if (path.includes('admin') || path.includes('dashboard')) continue;
  // Look for redirect-to-login BEFORE main content (hard gate)
  const lines = content.split('\n');
  let foundContentBeforeAuth = false;
  let foundAuthCheck = false;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const line = lines[i];
    // If we see JSX content before any auth check, it's soft gate
    if (line.includes('return (') || line.includes('return <') || line.includes('return {')) {
      foundContentBeforeAuth = true;
      break;
    }
    // Detect early auth redirect/return patterns
    if (/if\s*\(\s*!\s*(session|user|authenticated)/.test(line) &&
        (line.includes('redirect') || line.includes('return') || line.includes('router.push') || line.includes('router.replace'))) {
      foundAuthCheck = true;
      // If auth check comes before any content render → HARD GATE
      if (!foundContentBeforeAuth) {
        fail(`${path} — HARD AUTH GATE detected: blocks content with ${line.trim()} before rendering`);
        hardGateCount++;
      }
      break;
    }
  }
}

if (hardGateCount === 0) {
  pass('No hard auth gates detected on public pages (users see content before login)');
}

// ─── 5. ROBOTS NOINDEX DETECTION (Generic, Wide Scan) ────────────

section('SEO PRESERVATION (NOINDEX SCAN)');

// Whitelisted pages that are INTENTIONALLY noindexed
// Pattern: admin/dashboard/error pages + ad campaign landing pages
const NOINDEX_WHITELIST_PATHS = [
  'pages/404.js',
  'pages/admin/',
  'pages/family-dashboard-shared.js',
  'pages/sources/',
];

// Pattern-based whitelist: pages that are ad/landing campaign pages
// These may be intentionally noindexed to avoid duplicate content in search results
function isAdLandingPage(content, path) {
  // Check for ad campaign indicators
  const hasCampaignTracking = hasPattern(content, [
    'utm_campaign', 'utm_source', 'utm_medium',
    'captureLandingEvent', 'landingAnalytics',
    'gclid', 'fbclid',
  ]);
  // Check for landing page naming patterns
  const isLandingNamed = /landing|campaign|ad-|ppc-|paid-|promo-/i.test(path);
  return hasCampaignTracking || isLandingNamed;
}

let noindexViolations = 0;
for (const [path, content] of fileContents) {
  if (!path.startsWith('pages/') && !path.startsWith('app/')) continue;
  const isWhitelisted = NOINDEX_WHITELIST_PATHS.some(w => path.includes(w.replace('pages/', ''))) || isAdLandingPage(content, path);
  if (isWhitelisted) continue;

  // Detect noindex patterns
  if (hasPattern(content, ['content="noindex"', 'content="noindex,nofollow"', 'index: false', "'index', false", 'index: false'])) {
    // Check if it's using the DefaultPageHead noindex prop (which is parameter-controlled, not hardcoded)
    const isParamControlled = content.includes('noindex = false') || content.includes('noindex={') || content.includes('noindex ?');
    if (!isParamControlled) {
      fail(`${path} — HARDCODED noindex detected. This page will be hidden from search engines. Remove or get !!APPROVED`);
      noindexViolations++;
    }
  }
}

if (noindexViolations === 0) {
  pass('No unauthorized noindex patterns found across all pages');
}

// --- Check /answers specifically ---
if (existsSync('app/answers/page.tsx')) {
  const ans = readFileSync('app/answers/page.tsx', 'utf-8');
  if (ans.includes('index: false') || ans.includes('noindex')) {
    fail('app/answers/page.tsx — NOINDEX FOUND on /answers (SEO-critical page)');
    noindexViolations++;
  } else {
    pass('app/answers/page.tsx — no noindex (remains indexable)');
  }
}

// ─── 6. HOMEPAGE PRESERVATION ────────────────────────────────────

section('HOMEPAGE PRESERVATION');

const homepageFile = existsSync('app/page.js') ? 'app/page.js' : (existsSync('pages/index.js') ? 'pages/index.js' : null);
if (homepageFile) {
  const idx = readFileSync(homepageFile, 'utf-8');

  // Control copy must not be hard-replaced
  const hasControlCopy = hasPattern(idx, ['homePageDefault', 'heroTitle', 'metaDescription', 'heroTitleDefault', 'defaultHeroTitle']);
  const hasHardReplacement = !hasControlCopy && !idx.includes('isPrivacyMessaging') && !idx.includes('privacyVariant');

  if (hasControlCopy) {
    pass('Homepage preserves control copy (not hard-replaced)');
  } else if (!hasHardReplacement) {
    pass('Homepage uses additive A/B test pattern');
  } else {
    fail('Homepage control copy MISSING — may have been hard-replaced');
  }

  // A/B test must use additive approach
  if (idx.includes('useFeatureFlagVariantKey') || idx.includes('isPrivacyMessaging')) {
    pass('Homepage uses additive A/B test pattern (feature flag conditional)');
  } else {
    warn('Homepage A/B test pattern not detected — verify changes are additive');
  }
}

// ─── 6b. BRAND & GEOGRAPHIC SCOPE GUARD ──────────────────────────

section('NAVIGATION TAGLINE');

// ABSOLUTE: No taglines in the site navigation / header bar.
// Any element with a tagline class inside the nav header is disallowed
// without explicit human !!APPROVED in chat.
let navTaglineViolations = 0;
for (const [path, content] of fileContents) {
  const hasNavTagline = /siteHeaderTagline|headerTagline|navTagline/i.test(content);
  if (hasNavTagline) {
    // Allow only if there is a literal /* !!APPROVED */ comment within the file
    const hasApprovalComment = /\/\*\s*!!APPROVED\s*\*\//.test(content);
    if (hasApprovalComment) {
      pass(`${path} — nav tagline has explicit !!APPROVED comment`);
    } else {
      fail(`${path} — tagline found in site navigation / header bar. No taglines are allowed in the nav without explicit human !!APPROVED`);
      navTaglineViolations++;
    }
  }
}
if (navTaglineViolations === 0) {
  pass('No taglines in site header / navigation bar');
}

// ─── 6c. BRAND & GEOGRAPHIC SCOPE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

section('BRAND & GEOGRAPHIC SCOPE');

// Detect unconditional state-specific taglines in global brand components.
// Site-wide taglines that narrow geographic scope must be behind a PostHog A/B flag
// or have explicit !!APPROVED.
const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri',
  'Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York',
  'North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington',
  'West Virginia','Wisconsin','Wyoming'
].join('|');

const geoTaglineRegex = new RegExp(`\\b(${US_STATES})\\b[^\\n]{0,120}(senior living|assisted living|nursing home)`, 'i');

let geoViolations = 0;
for (const [path, content] of fileContents) {
  // Only inspect components that look like global headers or brand bars
  const looksLikeGlobalBrand = /className=.*(?:siteHeaderTagline|siteBrandTagline|headerTagline|brandTagline|siteBrand|brandBar)/i.test(content);
  if (!looksLikeGlobalBrand) continue;

  const match = content.match(geoTaglineRegex);
  if (match) {
    const idx = content.indexOf(match[0]);
    const surrounding = content.slice(Math.max(0, idx - 300), idx + 300);
    const isBehindFlag = /useFeatureFlagVariantKey|featureFlag|isPrivacyMessaging|flagVariant/i.test(surrounding);
    if (!isBehindFlag) {
      fail(`${path} — unconditional geo-specific tagline (“${match[0]}”) in global brand component. Must be behind a PostHog A/B flag or have !!APPROVED`);
      geoViolations++;
    } else {
      pass(`${path} — geo-specific tagline is behind a feature flag`);
    }
  }
}

if (geoViolations === 0) {
  pass('No unconditional geo-narrowing taglines in global brand components');
}

// ─── 7. GIT DIFF DELETION DETECTION ──────────────────────────────

section('GIT DIFF REGRESSION CHECK');

function gitDiffCheck() {
  try {
    const diff = execSync('git diff --name-status HEAD 2>/dev/null', { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
    if (!diff.trim()) return; // no changes

    const lines = diff.trim().split('\n');
    let deletions = 0;
    const deletedPatterns = [];

    for (const line of lines) {
      if (line.startsWith('D\t')) {
        const file = line.slice(2);
        // Check if deleted file matches critical patterns
        for (const anchor of CRITICAL_FILE_ANCHORS) {
          if (file === anchor || (anchor.includes('*') && new RegExp(anchor.replace('*', '.*')).test(file))) {
            fail(`GIT DIFF: ${file} DELETED — was a known critical file. Restore or get !!APPROVED`);
            deletions++;
            deletedPatterns.push(file);
          }
        }
        // Also check general page deletion
        if ((file.startsWith('pages/') || file.startsWith('app/')) && !file.includes('/api/')) {
          if (!deletedPatterns.includes(file)) {
            warn(`GIT DIFF: ${file} DELETED — verify this page is not user-facing`);
          }
        }
      }
    }

    if (deletions === 0) {
      pass('No critical file deletions in git diff');
    }
  } catch {
    // Not a git repo or no diff, skip
  }
}

gitDiffCheck();

// ─── 8. IMPORT REMOVAL DETECTION ─────────────────────────────────

section('IMPORT GRAPH CHECK');

// Files that MUST keep certain imports
const IMPORT_DEPENDENCIES = [
  {
    file: 'pages/results.js',
    requiredImports: ['AuthCapture'],
    rule: 'results.js must keep AuthCapture (soft gate)'
  },
  {
    file: 'pages/compare.js',
    requiredImports: ['AuthCapture'],
    rule: 'compare.js must keep AuthCapture (soft gate)'
  },
  {
    file: existsSync('app/HomePageClient.jsx') ? 'app/HomePageClient.jsx' : (existsSync('app/page.js') ? 'app/page.js' : 'pages/index.js'),
    requiredImports: ['useFeatureFlagVariantKey', 'HOMEPAGE_PRIVACY_EXPERIMENT_FLAG'],
    rule: 'homepage must keep PostHog A/B test imports'
  },
  {
    file: 'lib/posthogClient.js',
    requiredImports: ['posthog'],
    rule: 'posthogClient.js must import posthog SDK'
  },
];

for (const { file, requiredImports, rule } of IMPORT_DEPENDENCIES) {
  if (!existsSync(file)) { fail(`${file} missing — ${rule}`); continue; }
  const content = readFileSync(file, 'utf-8');
  const missing = requiredImports.filter(imp => !content.includes(imp));
  if (missing.length === 0) {
    pass(`${file} — required imports present`);
  } else {
    fail(`${file} — missing imports: ${missing.join(', ')} — ${rule}`);
  }
}

// ─── 9. STATIC ASSET & CACHE HEADER PRESERVATION ──────────────

section('INFRASTRUCTURE GUARD');

if (existsSync('next.config.js')) {
  const ncfg = readFileSync('next.config.js', 'utf-8');
  if (ncfg.includes('max-age=31536000') || ncfg.includes('immutable')) {
    pass('next.config.js — long-term cache headers present for static assets');
  } else {
    warn('next.config.js — long-term cache headers NOT FOUND for static assets');
  }
}

// Wrangler config integrity
for (const cfg of ['wrangler-slot4.toml', 'wrangler-staging.toml']) {
  if (!existsSync(cfg)) { fail(`${cfg} missing`); continue; }
  const c = readFileSync(cfg, 'utf-8');
  if (!c.includes('name =') || !c.includes('account_id')) {
    fail(`${cfg} — missing name or account_id`);
  } else {
    pass(`${cfg} — name + account_id present`);
  }
}

// PostHog feature flag consistency
const phClient = existsSync('lib/posthogClient.js') ? readFileSync('lib/posthogClient.js', 'utf-8') : '';
const homepagePaths = [
  existsSync('app/page.js') ? 'app/page.js' : null,
  existsSync('app/HomePageClient.jsx') ? 'app/HomePageClient.jsx' : null,
  existsSync('pages/index.js') ? 'pages/index.js' : null,
].filter(Boolean);
const idxPg = homepagePaths.map(p => readFileSync(p, 'utf-8')).join('\n');
const flagMatch = phClient.match(/HOMEPAGE_PRIVACY_EXPERIMENT_FLAG\s*=\s*"([^"]+)"/);
if (flagMatch) {
  const flagName = flagMatch[1];
  if (idxPg.includes(flagName) || idxPg.includes('HOMEPAGE_PRIVACY_EXPERIMENT_FLAG')) {
    pass(`PostHog flag "${flagName}" used in homepage`);
  } else {
    fail(`PostHog flag "${flagName}" defined but NOT used in homepage — A/B test broken`);
  }
} else {
  warn('No HOMEPAGE_PRIVACY_EXPERIMENT_FLAG found in posthogClient.js');
}

// ─── 10. SECURITY LIBRARY PRESENCE ───────────────────────────────

section('SECURITY GUARD');

const SECURITY_FILES = ['lib/security/sanitizer.js', 'lib/security/auditLog.js', 'lib/security/zdr.js'];
for (const f of SECURITY_FILES) {
  if (existsSync(f)) {
    pass(`${f} — present`);
  } else {
    warn(`${f} — MISSING (HIPAA/security feature may have been removed)`);
  }
}

// ─── 11. SAFEGUARD FILES THEMSELVES ───────────────────────────

section('SAFEGUARD SELF-CHECK');

const SAFEGUARD_FILES = [
  'AGENTS.md',
  'FEATURE_MANIFEST.md',
  'scripts/guard-critical-features.mjs',
  'scripts/guard-no-second-header.mjs',
  'scripts/postinstall/patch-react-dom-server-edge.mjs',
];
for (const f of SAFEGUARD_FILES) {
  if (existsSync(f)) {
    pass(`${f} — safeguard file present`);
  } else {
    fail(`${f} — SAFEGUARD FILE MISSING — this guard itself may have been deleted`);
  }
}

// ─── 12. NO SECOND HEADER / LOGO GUARD ────────────────────────────

section('NO SECOND HEADER / LOGO GUARD');

try {
  execSync('node scripts/guard-no-second-header.mjs', { stdio: 'inherit' });
} catch {
  fail('guard-no-second-header.mjs failed — a page may render its own logo/header');
}

// ─── 13. SUMMARY ─────────────────────────────────────────────────

process.stdout.write(`\n${'━'.repeat(50)}\n`);
if (exitCode === 0) {
  process.stdout.write(`${GREEN}✅ ALL CRITICAL PATTERNS VERIFIED — SAFE TO BUILD/DEPLOY${RESET}\n`);
} else {
  process.stdout.write(`${RED}❌ CRITICAL FEATURE GUARD FAILED — DO NOT DEPLOY${RESET}\n`);
  process.stdout.write(`${RED}   Fix the failures above before deploying.${RESET}\n`);
}
process.stdout.write(`${'━'.repeat(50)}\n\n`);
process.exit(exitCode);
