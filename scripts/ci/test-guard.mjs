#!/usr/bin/env node
/**
 * CI Test Suite for guard-critical-features.mjs
 *
 * Creates an isolated temp project directory, seeds it with deliberate regressions,
 * runs the guard, asserts failures are caught, then cleans up.
 *
 * SAFE: Never modifies real repo files.
 *
 * Usage: node scripts/ci/test-guard.mjs
 * Exit: 0 = all caught, 1 = guard missed a regression (CRITICAL BUG IN GUARD)
 */

import { spawnSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const CWD = process.cwd();
const TMP = join(CWD, '.tmp-test-guard-' + Date.now());
const GUARD_PATH = join(CWD, 'scripts', 'guard-critical-features.mjs');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function section(title) {
  process.stdout.write(`\n━━━ ${title} ━━━\n`);
}

function assert(condition, msg) {
  testsRun++;
  if (condition) {
    testsPassed++;
    process.stdout.write(`  ✅ ${msg}\n`);
  } else {
    testsFailed++;
    process.stdout.write(`  ❌ ${msg}\n`);
  }
}

function runGuard(cwd) {
  const child = spawnSync(process.execPath, [GUARD_PATH], {
    cwd,
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return { code: child.status, stdout: child.stdout, stderr: child.stderr };
}

// ─── Helper: create safe project tree ──────────────────────────────

function mkdir(base, ...segments) {
  const p = join(base, ...segments);
  mkdirSync(p, { recursive: true });
  return p;
}

function setupGoodProject(base) {
  const pages = mkdir(base, 'pages');
  const api = mkdir(base, 'pages', 'api');
  const app = mkdir(base, 'app');
  const components = mkdir(base, 'components');
  const hooks = mkdir(base, 'hooks');
  const lib = mkdir(base, 'lib');
  const seo = mkdir(base, 'components', 'Seo');
  const security = mkdir(base, 'lib', 'security');
  const scriptsDir = mkdir(base, 'scripts');
  const postinstall = mkdir(base, 'scripts', 'postinstall');

  // ── 20+ Pages Router pages to meet minimum ──
  const pageNames = [
    ['index', `
import { HOMEPAGE_PRIVACY_EXPERIMENT_FLAG } from "../lib/posthogClient";
import { useFeatureFlagVariantKey } from "posthog-js/react";
const homePageDefault = { heroTitle: "Test" };
export default function Home() {
  const privacyVariant = useFeatureFlagVariantKey(HOMEPAGE_PRIVACY_EXPERIMENT_FLAG);
  const isPrivacyMessaging = privacyVariant === "privacy" || privacyVariant === true;
  const h = isPrivacyMessaging ? "Privacy" : homePageDefault.heroTitle;
  return <div>{h}</div>;
}`],
    ['intake', `import { readIntakeState, INTAKE_STEPS } from "../lib/intakeState"; export default function Page() { return <div>Intake</div>; }`],
    ['matched', `import { rankFacilities } from "../lib/matchingScore"; import { MASSACHUSETTS_FACILITIES } from "../lib/massachusettsFacilities"; export default function Page() { return <div>Matched</div>; }`],
    ['results', `import AuthCapture from "../components/AuthCapture"; import WizardFacilityMatchList from "../components/WizardFacilityMatchList"; export default function Page() { return <div><AuthCapture /><WizardFacilityMatchList /></div>; }`],
    ['search', `export default function Page() { return <div>Search</div>; }`],
    ['compare', `import AuthCapture from "../components/AuthCapture"; import CompareTable from "../components/CompareTable"; export default function Page() { return <div><AuthCapture /><CompareTable /></div>; }`],
    ['get-matched', `export default function Page() { return <div>Get Matched</div>; }`],
    ['faq', `export default function Page() { return <div>FAQ</div>; }`],
    ['privacy', `export default function Page() { return <div>Privacy</div>; }`],
    ['editorial-policy', `export default function Page() { return <div>Editorial</div>; }`],
    ['data-sources', `export default function Page() { return <div>Data Sources</div>; }`],
    ['how-we-make-money', `export default function Page() { return <div>Money</div>; }`],
    ['care-access-initiative', `export default function Page() { return <div>Initiative</div>; }`],
    ['how-we-work', `export default function Page() { return <div>How We Work</div>; }`],
    ['methodology', `export default function Page() { return <div>Methodology</div>; }`],
    ['find-safest', `export default function Page() { return <div>Find Safest</div>; }`],
    ['trends', `export default function Page() { return <div>Trends</div>; }`],
    ['family-dashboard-shared', `export default function Page() { return <div>Dashboard</div>; }`],
    ['sources', `export default function Page() { return <div>Sources</div>; }`],
    ['partner-introductions', `export default function Page() { return <div>Partners</div>; }`],
    ['companies', `export default function Page() { return <div>Companies</div>; }`],
  ];
  pageNames.forEach(([name, content]) => {
    writeFileSync(join(pages, name + '.js'), content);
  });

  // Nested pages
  const ask = mkdir(base, 'pages', 'ask');
  writeFileSync(join(ask, 'index.js'), 'export default function Page() { return <div>Ask</div>; }');
  const tools = mkdir(base, 'pages', 'tools');
  writeFileSync(join(tools, 'cost-calculator.js'), 'export default function Page() { return <div>Calc</div>; }');
  writeFileSync(join(tools, 'memory-care-readiness.js'), 'export default function Page() { return <div>Memory Care</div>; }');
  const facility = mkdir(base, 'pages', 'facility');
  writeFileSync(join(facility, '[slug].js'), 'export default function Page() { return <div>Facility</div>; }');
  const admin = mkdir(base, 'pages', 'admin');
  writeFileSync(join(admin, 'index.js'), 'export default function Page() { return <div>Admin</div>; }');

  // ── 10+ API routes to meet minimum ──
  const apiRoutes = [
    'facilities.js',
    'ask-chat.js',
    'comparisons.js',
    'answers-facilities.ts',
    'chat.js',
    'cost-calculator.js',
    'health.js',
    'deploy-fingerprint.js',
    'family-dashboard-auth.js',
    'conversions.js',
    'memory-care-readiness.js',
  ];
  apiRoutes.forEach(f => {
    writeFileSync(join(api, f), 'export default function handler(req, res) { res.json({ ok: true }); }');
  });

  // ── Components ──
  writeFileSync(join(components, 'AssistedlyWizard.js'), 'export default function W() { return <div>W</div>; }');
  writeFileSync(join(components, 'AuthCapture.js'), 'export default function AC() { return <div>AC</div>; }');
  writeFileSync(join(components, 'WizardFacilityMatchList.js'), 'export default function F() { return <div>F</div>; }');
  writeFileSync(join(components, 'ResultsSnapshotSection.js'), 'export default function S() { return <div>S</div>; }');
  writeFileSync(join(components, 'ResultsPageAnalytics.js'), 'export default function A() { return <div>A</div>; }');
  writeFileSync(join(components, 'CompareTable.js'), 'export default function T() { return <div>T</div>; }');
  writeFileSync(join(components, 'TrustCenterPage.js'), 'export default function TP() { return <div>TP</div>; }');
  writeFileSync(join(components, 'FacilityDeepDive.js'), 'export default function DD() { return <div>DD</div>; }');
  writeFileSync(join(components, 'FacilityViewGate.js'), 'export default function VG() { return <div>VG</div>; }');
  writeFileSync(join(components, 'IntakeMatchBadge.js'), 'export default function MB() { return <div>MB</div>; }');
  writeFileSync(join(components, 'SiteFooter.js'), 'export default function SF() { return <div>SF</div>; }');
  writeFileSync(join(components, 'SiteHeader.js'), 'export default function SH() { return <div>SH</div>; }');

  // SEO components
  writeFileSync(join(seo, 'JsonLd.jsx'), 'export default function J() { return null; }');
  writeFileSync(join(seo, 'DefaultPageHead.jsx'), 'export default function D() { return null; }');
  writeFileSync(join(seo, 'ConsentManager.jsx'), 'export default function C() { return null; }');

  // ── App router ──
  writeFileSync(join(app, 'layout.js'), 'export default function L() { return null; }');
  const answers = mkdir(base, 'app', 'answers');
  writeFileSync(join(answers, 'page.tsx'), 'export default function AnswersPage() { return <div>Answers</div>; }');
  writeFileSync(join(answers, 'AnswersAuthGate.tsx'), 'export default function AnswersAuthGate() { return null; }');
  writeFileSync(join(app, 'sitemap.js'), 'export default function sitemap() { return []; }');
  writeFileSync(join(app, 'robots.js'), 'export default function robots() { return {}; }');
  const massachusetts = mkdir(base, 'app', 'massachusetts');
  writeFileSync(join(massachusetts, 'page.js'), 'export default function MA() { return null; }');

  // ── Hooks ──
  writeFileSync(join(hooks, 'useIntake.js'), 'export function useIntake() { return {}; }');

  // ── Lib ──
  writeFileSync(join(lib, 'intakeState.js'), `export const INTAKE_STEPS=[]; export function readIntakeState(){}`);
  writeFileSync(join(lib, 'matchingScore.js'), 'export function rankFacilities(){}');
  writeFileSync(join(lib, 'serverAuth.js'), 'export function getSession(){}');
  writeFileSync(join(lib, 'posthogClient.js'), 'import posthog from "posthog-js"; export const HOMEPAGE_PRIVACY_EXPERIMENT_FLAG="homepage-privacy-messaging-2026-08"; export default posthog;');
  writeFileSync(join(lib, 'massachusettsFacilities.js'), 'export const MASSACHUSETTS_FACILITIES=[];');
  writeFileSync(join(lib, 'facilityProfiles.js'), 'export function buildFacilityProfile(){}');
  writeFileSync(join(lib, 'intakeAnalytics.js'), 'export function trackIntakeStart(){}');
  writeFileSync(join(lib, 'landingAnalytics.js'), 'export function captureLandingEvent(){}');
  writeFileSync(join(lib, 'landingPersonalization.js'), 'export function resolveLandingPersonalization(){}');

  const seoLib = mkdir(base, 'lib', 'seo');
  writeFileSync(join(seoLib, 'schemaData.js'), 'export function getOrganizationSchema(){}');

  // ── Security ──
  writeFileSync(join(security, 'sanitizer.js'), 'export function sanitize(){}');
  writeFileSync(join(security, 'auditLog.js'), 'export function auditPrompt(){}');
  writeFileSync(join(security, 'zdr.js'), 'export function mergeZdr(){}');

  // ── Configs ──
  writeFileSync(join(base, 'next.config.js'), 'module.exports={async headers(){return[{source:"/_next/static/:path*",headers:[{key:"Cache-Control",value:"public, max-age=31536000, immutable"}]}];}};');
  writeFileSync(join(base, 'wrangler-slot4.toml'), 'name = "assistedly-slot4"\naccount_id = "ad9d77d8f16147c01ff26b56d41cb5a9"');
  writeFileSync(join(base, 'wrangler-staging.toml'), 'name = "assistedly-staging-1"\naccount_id = "ad9d77d8f16147c01ff26b56d41cb5a9"');

  // ── Safeguard files ──
  writeFileSync(join(base, 'AGENTS.md'), '# Safe');
  writeFileSync(join(base, 'FEATURE_MANIFEST.md'), '# Safe');
  writeFileSync(join(postinstall, 'patch-react-dom-server-edge.mjs'), '// safe');

  // ── Copy guard script into test dir ──
  // The guard checks for its own existence; it must be findable from CWD
  copyFileSync(GUARD_PATH, join(scriptsDir, 'guard-critical-features.mjs'));

  // ── Git init ──
  spawnSync('git', ['init', '-b', 'main', '--quiet'], { cwd: base, stdio: 'ignore' });
  spawnSync('git', ['add', '-A'], { cwd: base, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: base, stdio: 'ignore' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: base, stdio: 'ignore' });
  spawnSync('git', ['commit', '-m', 'initial', '--quiet'], { cwd: base, stdio: 'ignore' });
}

function seedRegression(base, regressor) {
  regressor(base);
}

function setupBadProject(base, regressor) {
  setupGoodProject(base);
  seedRegression(base, regressor);
}

// ─── Test 1: Happy Path ─────────────────────────────────────────────

section('TEST 1: Happy Path (no regressions)');
{
  const base = join(TMP, 'happy');
  mkdirSync(base, { recursive: true });
  setupGoodProject(base);
  const { code, stdout } = runGuard(base);
  assert(code === 0, `Guard exits 0 on clean project (got ${code})`);
  assert(stdout.includes('ALL CRITICAL PATTERNS VERIFIED'), 'Guard reports all clear');
}

// ─── Test 2: Missing Intake Flow ──────────────────────────────────

section('TEST 2: Missing intake flow patterns');
{
  const base = join(TMP, 'no-intake');
  mkdirSync(base, { recursive: true });
  setupBadProject(base, (b) => {
    rmSync(join(b, 'pages', 'intake.js'));
    rmSync(join(b, 'hooks', 'useIntake.js'));
    writeFileSync(join(b, 'lib', 'intakeState.js'), '// hollowed out');
  });
  const { code, stdout } = runGuard(base);
  assert(code !== 0, `Guard FAILS when intake flow removed (got exit ${code})`);
  assert(stdout.includes('NO intake flow patterns found'), 'Guard detects missing intake');
}

// ─── Test 3: Hard Auth Gate ──────────────────────────────────────

section('TEST 3: Hard auth gate blocks results before login');
{
  const base = join(TMP, 'hard-gate');
  mkdirSync(base, { recursive: true });
  setupBadProject(base, (b) => {
    writeFileSync(join(b, 'pages', 'results.js'), `
import { useRouter } from "next/router";
export default function ResultsPage() {
  const router = useRouter();
  const session = null;
  if (!session) { router.push("/login"); return null; }
  return <div>Results</div>;
}
`);
  });
  const { code, stdout } = runGuard(base);
  assert(code !== 0, `Guard FAILS on hard auth gate (got exit ${code})`);
  assert(stdout.includes('HARD AUTH GATE'), 'Guard detects hard auth gate');
}

// ─── Test 4: Unauthorized Noindex ────────────────────────────────

section('TEST 4: Unauthorized noindex on public page');
{
  const base = join(TMP, 'noindex');
  mkdirSync(base, { recursive: true });
  setupBadProject(base, (b) => {
    writeFileSync(join(b, 'pages', 'search.js'), `
import Head from "next/head";
export default function SearchPage() {
  return <><Head><meta name="robots" content="noindex" /></Head><div>Search</div></>;
}
`);
  });
  const { code, stdout } = runGuard(base);
  assert(code !== 0, `Guard FAILS on unauthorized noindex (got exit ${code})`);
  assert(stdout.includes('noindex'), 'Guard warns about noindex');
}

// ─── Test 5: Ad Landing Page Noindex Allowed ─────────────────────

section('TEST 5: Ad landing pages MAY have noindex (whitelist)');
{
  const base = join(TMP, 'landing-noindex');
  mkdirSync(base, { recursive: true });
  setupBadProject(base, (b) => {
    writeFileSync(join(b, 'pages', 'landing-paid-search.js'), `
import Head from "next/head";
import { captureLandingEvent } from "../lib/landingAnalytics";
export default function LandingPage() {
  captureLandingEvent("page_view");
  return <><Head><meta name="robots" content="noindex" /></Head><div>Landing</div></>;
}
`);
  });
  const { code, stdout } = runGuard(base);
  assert(code === 0, `Guard PASSES for ad landing page with noindex (got exit ${code})`);
  assert(!stdout.includes('landing-paid-search'), 'Guard does not flag whitelisted landing page');
}

// ─── Test 6: Missing Wrangler Config ────────────────────────────

section('TEST 6: Missing wrangler production config');
{
  const base = join(TMP, 'no-wrangler');
  mkdirSync(base, { recursive: true });
  setupBadProject(base, (b) => {
    rmSync(join(b, 'wrangler-slot4.toml'));
  });
  const { code, stdout } = runGuard(base);
  assert(code !== 0, `Guard FAILS when wrangler-slot4.toml missing (got exit ${code})`);
  assert(stdout.includes('wrangler-slot4.toml'), 'Guard flags missing wrangler config');
}

// ─── Test 7: Missing Homepage Control Copy ───────────────────────

section('TEST 7: Homepage hard-replaced (control copy gone)');
{
  const base = join(TMP, 'homepage-replaced');
  mkdirSync(base, { recursive: true });
  setupBadProject(base, (b) => {
    writeFileSync(join(b, 'pages', 'index.js'), `
export default function Home() {
  return <div>NEW HOMEPAGE</div>;
}
`);
  });
  const { code, stdout } = runGuard(base);
  assert(code !== 0, `Guard FAILS when homepage hard-replaced (got exit ${code})`);
  assert(stdout.includes('control copy MISSING'), 'Guard detects homepage replacement');
}

// ─── Test 8: Bulk Deletion (route count below minimum) ───────────

section('TEST 8: Bulk page deletion drops route count below minimum');
{
  const base = join(TMP, 'bulk-delete');
  mkdirSync(base, { recursive: true });
  setupBadProject(base, (b) => {
    rmSync(join(b, 'pages', 'results.js'));
    rmSync(join(b, 'pages', 'compare.js'));
    rmSync(join(b, 'pages', 'search.js'));
    rmSync(join(b, 'pages', 'ask'), { recursive: true, force: true });
    rmSync(join(b, 'pages', 'tools'), { recursive: true, force: true });
    rmSync(join(b, 'pages', 'get-matched.js'));
    rmSync(join(b, 'pages', 'trends.js'));
    rmSync(join(b, 'pages', 'find-safest.js'));
    rmSync(join(b, 'pages', 'partner-introductions.js'));
    rmSync(join(b, 'pages', 'faq.js'));
  });
  const { code, stdout } = runGuard(base);
  assert(code !== 0, `Guard FAILS on bulk deletion (got exit ${code})`);
  assert(stdout.includes('min:') || stdout.includes('MISSING'), 'Guard catches bulk page deletion');
}

// ─── Summary ──────────────────────────────────────────────────────

section('CI TEST SUMMARY');
process.stdout.write(`\nTests run:    ${testsRun}\n`);
process.stdout.write(`Tests passed: ${testsPassed}\n`);
process.stdout.write(`Tests failed: ${testsFailed}\n`);

// Cleanup
rmSync(TMP, { recursive: true, force: true });

if (testsFailed > 0) {
  process.stdout.write(`\n❌ ${testsFailed} test(s) FAILED — the guard has bugs that need fixing\n`);
  process.exit(1);
} else {
  process.stdout.write(`\n✅ All ${testsRun} tests passed — guard is working correctly\n`);
  process.exit(0);
}
