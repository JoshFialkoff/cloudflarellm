#!/usr/bin/env node
/**
 * guard-minimal-templates.mjs
 *
 * Principle: Every user-facing page should use the same root layout tree.
 * Dual routers (Pages Router + App Router) cause layout drift: sticky headers,
 * body flex containers, and scroll behavior differ between _app.js and app/layout.js.
 *
 * This rule does NOT limit creativity. Route-specific layout variations (landing
 * pages, dashboards, tool pages) are fine — but they must all inherit from the
 * same root layout, not duplicate it or switch router systems.
 */
import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.join(__dirname, '../pages');
const APP_DIR = path.join(__dirname, '../app');

function fail(msg) {
  console.error('❌ ' + msg);
  process.exitCode = 1;
}
function warn(msg) {
  console.warn('⚠️ ' + msg);
}
function pass(msg) {
  console.log('✅ ' + msg);
}

function listRouteFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    if (entry.startsWith('(') && entry.endsWith(')')) continue; // route groups
    if (entry.startsWith('_')) continue; // private files
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listRouteFiles(full, path.join(prefix, entry)));
    } else if (/\.(js|jsx|tsx|ts)$/.test(entry)) {
      files.push(path.join(prefix, entry));
    }
  }
  return files;
}

function countTopLevelPages(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => /page\.(js|jsx|tsx|ts)$/i.test(f)).length;
}

function run() {
  const appRoutes = listRouteFiles(APP_DIR);
  const pageRoutes = listRouteFiles(PAGES_DIR);

  // Check: no duplicate routes across routers
  const appPaths = new Set(appRoutes.map(f => f.replace(/page\.(js|jsx|tsx|ts)$/i, '').replace(/\\/g, '/').replace(/\/$/, '')));
  const pagePaths = new Set(pageRoutes.map(f => f.replace(/\.(js|jsx|tsx|ts)$/i, '').replace(/\\/g, '/').replace(/\/$/, '')));

  const conflicts = [];
  for (const p of appPaths) {
    if (pagePaths.has(p)) conflicts.push(p);
  }
  if (conflicts.length) {
    fail(`Duplicate routes across routers — must consolidate: ${conflicts.join(', ')}`);
  }

  // Check: homepage must be in App Router (single source of truth)
  const hasAppHome = existsSync(path.join(APP_DIR, 'page.js')) || existsSync(path.join(APP_DIR, 'page.jsx'));
  const hasPagesHome = existsSync(path.join(PAGES_DIR, 'index.js')) || existsSync(path.join(PAGES_DIR, 'index.jsx'));

  if (hasPagesHome && hasAppHome) {
    fail('Both app/page.js and pages/index.js exist — homepage must have one canonical location');
  }

  if (!hasAppHome && !hasPagesHome) {
    fail('No homepage found in either app/page.js or pages/index.js');
  }

  // Check: facility chart pages should all share the same router
  const chartPages = ['find-safest', 'top-rated', 'affordable'];
  const appChartCount = chartPages.filter(p => existsSync(path.join(APP_DIR, p, 'page.js'))).length;
  const pagesChartCount = chartPages.filter(p => existsSync(path.join(PAGES_DIR, `${p}.js`))).length;

  if (appChartCount > 0 && pagesChartCount > 0) {
    fail(`Facility chart pages split across routers (${appChartCount} in app/, ${pagesChartCount} in pages/) — consolidate to one router`);
  }

  // Check: root layout count — warn strongly on dual-router
  const hasAppLayout = existsSync(path.join(APP_DIR, 'layout.js'));
  const hasPagesApp = existsSync(path.join(PAGES_DIR, '_app.js'));
  const hasPagesDoc = existsSync(path.join(PAGES_DIR, '_document.js'));

  if (hasAppLayout && hasPagesApp) {
    warn('Both App Router (app/layout.js) and Pages Router (pages/_app.js) active — migrate toward one router');
  }

  // Check: no top-level duplicate routes
  const topLevelConflicts = [];
  for (const p of ['about','faq','methodology','how-we-make-money','how-we-work','data-sources','privacy','editorial-policy','care-access-initiative','founder-story']) {
    const inApp = existsSync(path.join(APP_DIR, '(site)', p, 'page.js')) || existsSync(path.join(APP_DIR, p, 'page.js'));
    const inPages = existsSync(path.join(PAGES_DIR, `${p}.js`));
    if (inApp && inPages) topLevelConflicts.push(p);
  }
  if (topLevelConflicts.length) {
    fail(`Duplicate top-level routes in both routers: ${topLevelConflicts.join(', ')}`);
  }

  if (process.exitCode) {
    fail('guard-minimal-templates FAILED');
    return;
  }

  pass(`guard-minimal-templates passed — ${appRoutes.length} app routes, ${pageRoutes.length} pages routes, 0 conflicts, ${topLevelConflicts.length} duplicates`);
}

run();
