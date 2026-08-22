#!/usr/bin/env node
/**
 * Landing Banner / Header Icon Guard
 *
 * Ensures the landing banner's center logo always uses a HEART icon
 * (the brand mark), while the site header top-left uses a HOME icon.
 *
 * The brand heart is intentionally used in the banner center overlay.
 * The home icon in the header provides intuitive navigation.
 */

import { readFileSync, existsSync } from 'fs'

const errors = []

function fail(msg) { errors.push(msg) }

const bannerFile = 'components/LandingBanner.js'
const headerFile = 'components/SiteHeader.js'
const stylesFile = 'styles/Home.module.css'

// ─── 1. Banner must use HEART ────────────────────────────────────
if (!existsSync(bannerFile)) {
  fail(`${bannerFile} missing — cannot verify landing banner icon`)
} else {
  const banner = readFileSync(bannerFile, 'utf8')

  // Must use HEART_PATH constant (not HOME_PATH)
  if (banner.includes('HOME_PATH')) {
    fail(`${bannerFile}: landing banner must use HEART_PATH, not HOME_PATH`)
  }

  // Must reference HEART_PATH for the center-logo SVG path
  const centerLogoMatches = banner.match(/landingBannerCenterLogo[\s\S]*?d=\{([^}]+)\}/g) || []
  if (centerLogoMatches.length > 0) {
    for (const match of centerLogoMatches) {
      if (!match.includes('HEART_PATH')) {
        fail(`${bannerFile}: center logo SVG must use HEART_PATH for the icon path`)
      }
    }
  }

  // Must use landingBannerHeart class (not landingBannerHome)
  if (banner.includes('landingBannerHome')) {
    fail(`${bannerFile}: landing banner must use class landingBannerHeart, not landingBannerHome`)
  }

  if (!banner.includes('landingBannerHeart')) {
    fail(`${bannerFile}: missing landingBannerHeart class reference`)
  }
}

// ─── 2. Header must use HOME ─────────────────────────────────────
if (!existsSync(headerFile)) {
  fail(`${headerFile} missing — cannot verify header icon`)
} else {
  const header = readFileSync(headerFile, 'utf8')

  if (!header.includes('HOME_PATH')) {
    fail(`${headerFile}: site header must use HOME_PATH for the brand mark`)
  }

  if (!header.includes('siteHeaderHomeLink')) {
    fail(`${headerFile}: site header must render a home icon link (siteHeaderHomeLink)`)
  }
}

// ─── 3. Styles must define landingBannerHeart ───────────────────
if (!existsSync(stylesFile)) {
  fail(`${stylesFile} missing — cannot verify landing banner styles`)
} else {
  const styles = readFileSync(stylesFile, 'utf8')

  if (styles.includes('.landingBannerHome')) {
    fail(`${stylesFile}: must not define .landingBannerHome; use .landingBannerHeart for the banner center mark`)
  }

  if (!styles.includes('.landingBannerHeart')) {
    fail(`${stylesFile}: missing .landingBannerHeart style rule`)
  }
}

if (errors.length > 0) {
  console.error('\n❌ LANDING BANNER / HEADER ICON GUARD FAILED')
  for (const e of errors) console.error('   ' + e)
  console.error('')
  process.exit(1)
}

console.log('✅ LANDING BANNER / HEADER ICON GUARD PASSED')
