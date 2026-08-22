#!/usr/bin/env node
/**
 * Favicon Consistency Guard
 *
 * Prevents App Router / Pages Router favicon divergence.
 * Next.js App Router does NOT inherit <Head> from pages/_document.js.
 * It needs either:
 *   1. A file at app/favicon.ico (file convention), OR
 *   2. An `icons` key in the metadata export of app/layout.js
 *
 * This script verifies both routers reference the same favicon source.
 */

import { existsSync, readFileSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'

const errors = []
const warnings = []

function sha256(filePath) {
  const buf = readFileSync(filePath)
  return createHash('sha256').update(buf).digest('hex')
}

// ─── Pages Router checks ───────────────────────────────────────────
const docPath = join('pages', '_document.js')
if (!existsSync(docPath)) {
  errors.push('pages/_document.js missing — cannot verify Pages Router favicon')
} else {
  const doc = readFileSync(docPath, 'utf-8')
  if (!doc.includes('favicon')) {
    errors.push('pages/_document.js missing favicon <link>')
  }
}

// ─── App Router checks ─────────────────────────────────────────────
const appFaviconFile = join('app', 'favicon.ico')
const appLayoutPath = join('app', 'layout.js')

// Check 1: file convention exists (preferred — works even if metadata is deleted)
const hasAppFaviconFile = existsSync(appFaviconFile)

// Check 2: metadata export has icons key (belt-and-suspenders)
let hasIconsMetadata = false
if (existsSync(appLayoutPath)) {
  const layout = readFileSync(appLayoutPath, 'utf-8')
  hasIconsMetadata =
    /icons\s*:/.test(layout) || /icon\s*:/.test(layout)
}

if (!hasAppFaviconFile && !hasIconsMetadata) {
  errors.push(
    'App Router has NO favicon: add app/favicon.ico OR icons:{} to app/layout.js metadata'
  )
}

if (hasIconsMetadata && !hasAppFaviconFile) {
  errors.push(
    'app/layout.js has icons metadata, but app/favicon.ico file convention is required for App Router'
  )
}

// ─── Consistency check ─────────────────────────────────────────────
const publicIco = join('public', 'favicon.ico')
if (hasAppFaviconFile && existsSync(publicIco)) {
  if (sha256(appFaviconFile) !== sha256(publicIco)) {
    errors.push(
      'app/favicon.ico and public/favicon.ico are different. Keep them in sync.'
    )
  }
}

// ─── Report ────────────────────────────────────────────────────────
if (warnings.length) {
  console.warn('⚠️  FAVICON GUARD WARNINGS')
  warnings.forEach(w => console.warn(`  - ${w}`))
}

if (errors.length) {
  console.error('❌ FAVICON GUARD FAILED')
  errors.forEach(e => console.error(`  - ${e}`))
  process.exit(1)
}

console.log('✅ FAVICON GUARD PASSED')
