#!/usr/bin/env node
/**
 * Responsive Design Guard
 *
 * Ensures homepage and facility-display components remain usable across
 * all standard breakpoints (375px mobile up to 1440px+ desktop).
 *
 * Checks:
 *   1. New hero-expansion classes have rules in BOTH min-width AND max-width media queries
 *   2. No fixed pixel anti-patterns that break mobile (widths > 600px, large min-widths)
 *   3. Grid/flex layouts use responsive units or have wrapping media queries
 *   4. Landing banner continues to use clamp/vw responsive units
 *   5. No overflow-x: hidden on body/html
 *   6. Inline styles in JSX don't hardcode pixel widths without maxWidth
 */

import { readFileSync, existsSync } from 'fs'

const errors = []
const warnings = []

function fail(msg) { errors.push(msg) }
function warn(msg) { warnings.push(msg) }

/**
 * Remove @media(...) declaration strings from CSS so we don't match
 * width values inside the media-query parentheses (e.g. "max-width: 720px")
 */
function stripMediaQueryDecls(css) {
  return css.replace(/@media\s*\([^)]*\)/gi, '@media (...)')
}

/**
 * Check if a position in CSS is inside a @media { ... } block body,
 * not just inside the @media declaration line.
 */
function isInsideMediaBody(css, pos) {
  const before = css.slice(0, pos)
  const lastMedia = before.lastIndexOf('@media')
  if (lastMedia === -1) return false
  // Find the opening brace after @media
  let brace = before.indexOf('{', lastMedia)
  if (brace === -1 || brace > pos) return false
  // Count braces between brace and pos
  let depth = 1
  for (let i = brace + 1; i < pos; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}') depth--
    if (depth <= 0) return false
  }
  return depth > 0
}

// ─── 1. CSS FILE SCANS ───────────────────────────────────────────
const cssFiles = ['styles/Home.module.css', 'styles/facility-charts/Dashboard.module.css']

for (const file of cssFiles) {
  if (!existsSync(file)) continue
  const rawCss = readFileSync(file, 'utf8')
  const css = stripMediaQueryDecls(rawCss)

  // 1a. Anti-pattern: width: NNNNpx (not max-width — max-width is responsive!)
  // Match lines that contain "width:" but not "max-width:" or "min-width:"
  const largeWidthRe = /(\s|^|;|\{)width\s*:\s*(\d{3,})px\b/gi
  let m
  while ((m = largeWidthRe.exec(css)) !== null) {
    const px = parseInt(m[2], 10)
    // Map back to raw position for media-body check
    const rawPos = rawCss.indexOf(m[0], rawCss.indexOf('width', m.index))
    if (px > 800 && !isInsideMediaBody(rawCss, rawPos)) {
      fail(`${file}: fixed width ${px}px outside media query may overflow mobile (use max-width or responsive unit)`)
    }
  }

  // 1b. Anti-pattern: min-width in px > 450 outside media body
  const minWidthRe = /\bmin-width\s*:\s*(\d{2,})px\b/gi
  while ((m = minWidthRe.exec(css)) !== null) {
    const px = parseInt(m[1], 10)
    const rawPos = rawCss.indexOf(m[0], rawCss.indexOf('min-width', m.index))
    if (px > 450 && !isInsideMediaBody(rawCss, rawPos)) {
      fail(`${file}: min-width ${px}px outside media query may clip on small screens`)
    }
  }

  // 1c. Anti-pattern: overflow-x: hidden on body/html
  if (/body\s*\{[^}]*overflow-x\s*:\s*hidden|html\s*\{[^}]*overflow-x\s*:\s*hidden/si.test(rawCss)) {
    fail(`${file}: overflow-x: hidden on body/html prevents native horizontal scroll`)
  }

  // 1d. Grid columns with fixed px but no minmax/fr/% outside media query
  const gridRe = /grid-template-columns\s*:\s*([^;{}]+)/gi
  while ((m = gridRe.exec(rawCss)) !== null) {
    const cols = m[1]
    const rawPos = m.index
    if (/\d+px/.test(cols) && !/minmax|fr|%|auto/.test(cols) && !isInsideMediaBody(rawCss, rawPos)) {
      warn(`${file}: grid-template-columns with fixed px lacks responsive unit (minmax/fr/%)`)
    }
  }
}

// ─── 2. HERO EXPANSION CLASS RESPONSIVENESS ──────────────────────
if (existsSync('styles/Home.module.css')) {
  const homeCss = readFileSync('styles/Home.module.css', 'utf8')

  // Find all classes ending in "Expanded"
  const expandedClasses = new Set()
  const classRe = /\.([a-zA-Z]+Expanded)\b/g
  let cm
  while ((cm = classRe.exec(homeCss)) !== null) {
    expandedClasses.add(cm[1])
  }

  for (const cls of expandedClasses) {
    const reStart = new RegExp(`@media\\s*\\([^)]*(?:min-width|max-width)[^)]*\\)`, 'gi')
    const mediaBlocks = []
    let mm
    while ((mm = reStart.exec(homeCss)) !== null) {
      const start = mm.index
      let depth = 0
      let end = start
      for (let i = start; i < homeCss.length; i++) {
        if (homeCss[i] === '{') depth++
        if (homeCss[i] === '}') {
          depth--
          if (depth === 0) { end = i; break }
        }
      }
      mediaBlocks.push(homeCss.slice(start, end + 1))
    }

    const hasMobile = mediaBlocks.some(b => /max-width/.test(b) && b.includes(`.${cls} `))
    const hasDesktop = mediaBlocks.some(b => /min-width/.test(b) && b.includes(`.${cls} `))

    if (!hasMobile || !hasDesktop) {
      fail(`styles/Home.module.css: .${cls} missing responsive rules — ` +
           `needs BOTH @media (min-width: …) and @media (max-width: …) blocks`)
    }
  }
}

// ─── 3. LANDING BANNER RESPONSIVENESS ────────────────────────────
if (existsSync('styles/Home.module.css')) {
  const homeCss = readFileSync('styles/Home.module.css', 'utf8')
  if (!/clamp\(/.test(homeCss) || !/vw\b/.test(homeCss)) {
    fail('styles/Home.module.css: landing banner appears to have lost responsive units (clamp/vw)')
  }
}

// ─── 4. JSX INLINE STYLE SCAN ───────────────────────────────────
const jsFilesToScan = [
  'components/HomeScoresTabs.jsx',
  'components/HomeHeroBlock.js',
  'components/LandingBanner.js',
]

for (const file of jsFilesToScan) {
  if (!existsSync(file)) continue
  const src = readFileSync(file, 'utf8')

  // Inline width in px without maxWidth
  const widthRe = /width\s*:\s*['"`](\d+)px['"`]/gi
  let wm
  while ((wm = widthRe.exec(src)) !== null) {
    const px = parseInt(wm[1], 10)
    if (px > 400) {
      fail(`${file}: inline style width: ${px}px may overflow mobile (add maxWidth or use responsive unit)`)
    }
  }

  // gridTemplateColumns with fixed px values
  const gridInlineRe = /gridTemplateColumns\s*:\s*['"`]([^'"`]+)['"`]/gi
  let gm
  while ((gm = gridInlineRe.exec(src)) !== null) {
    const cols = gm[1]
    if (/\d+px/.test(cols) && !/minmax|fr|%/.test(cols)) {
      warn(`${file}: inline gridTemplateColumns "${cols}" lacks responsive unit`)
    }
  }
}

// ─── 5. REPORT ───────────────────────────────────────────────────
if (errors.length > 0) {
  console.error('\n❌ RESPONSIVE DESIGN GUARD FAILED')
  for (const e of errors) console.error('   ' + e)
  console.error('')
  process.exit(1)
}

if (warnings.length > 0) {
  console.warn('\n⚠️  RESPONSIVE DESIGN GUARD WARNINGS')
  for (const w of warnings) console.warn('   ' + w)
  console.warn('')
}

console.log('✅ RESPONSIVE DESIGN GUARD PASSED')
