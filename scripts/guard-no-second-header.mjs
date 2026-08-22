#!/usr/bin/env node
/**
 * No-Second-Header Guard
 *
 * Every page must use the global SiteHeader (via pages/_app.js or app/layout.js).
 * Self-rendered logos, brand bars, or duplicate navigation headers are forbidden.
 *
 * Scans all JS/TS files for:
 * 1. `import AssistedlyLogo` or `<AssistedlyLogo>` outside of standard shared components
 * 2. Dead brand-bar patterns (siteBrandBar, siteBrandInner)
 *
 * Standard components (allowed):
 * - components/SiteHeader.js
 * - components/SiteFooter.js
 * - components/SiteHeaderAppRouter.js
 * - components/LowerCostCompanion.js (floating widget)
 * - components/AssistedlyLogo.js (the component itself)
 *
 * Override: Marketing pages with explicit allowlist entry below.
 */

import fs from 'fs';
import path from 'path';

const EXPLICIT_ALLOWLIST = [
  // Add marketing/custom landing pages here that suppress the global header
];

const STANDARD_COMPONENTS = new Set([
  'SiteHeader.js',
  'SiteFooter.js',
  'SiteHeaderAppRouter.js',
  'LowerCostCompanion.js',
  'AssistedlyLogo.js',
]);

const SOURCE_DIRS = ['components', 'pages', 'app'];
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

function* walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip common non-source dirs
      if (['node_modules', '.next', '.open-next', 'dist', 'build'].includes(entry.name)) continue;
      yield* walkFiles(fullPath);
    } else if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      yield fullPath;
    }
  }
}

function isStandardComponent(filePath) {
  const base = path.basename(filePath);
  return STANDARD_COMPONENTS.has(base);
}

function isAllowlisted(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return EXPLICIT_ALLOWLIST.some(allowed => relative.includes(allowed));
}

const violations = [];

for (const srcDir of SOURCE_DIRS) {
  if (!fs.existsSync(srcDir)) continue;

  for (const filePath of walkFiles(srcDir)) {
    if (isStandardComponent(filePath)) continue;
    if (isAllowlisted(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const relative = path.relative(process.cwd(), filePath);

    // Check for AssistedlyLogo import or JSX usage
    if (/import\s+.*AssistedlyLogo/.test(content) || /<AssistedlyLogo/.test(content)) {
      violations.push(`${relative}: Found AssistedlyLogo import/usage outside standard components`);
    }

    // Check for dead brand-bar patterns
    if (/siteBrandBar|siteBrandInner/.test(content)) {
      violations.push(`${relative}: Found dead brand-bar pattern (siteBrandBar/siteBrandInner)`);
    }
  }
}

if (violations.length > 0) {
  console.error('❌ NO SECOND HEADER / LOGO GUARD FAILED');
  console.error('The following files appear to render their own logo or brand bar:');
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log('✅ NO SECOND HEADER / LOGO GUARD PASSED');
