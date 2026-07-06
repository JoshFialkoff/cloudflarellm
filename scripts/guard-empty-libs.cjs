#!/usr/bin/env node
/**
 * Guards against accidentally empty library files that would cause
 * silent runtime errors (undefined imports → TypeError at runtime).
 *
 * Background: lib/facilityChatFallback.js was found to be 0 bytes (2026-07-01).
 * Three functions imported from it were undefined at runtime, causing the
 * homepage wizard to show "Our AI has gone AWOL" on every chat attempt.
 *
 * This guard scans lib/ for files that are < 2 bytes (empty or nearly empty)
 * but still referenced by imports in components/ and pages/.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const LIB = path.join(ROOT, 'lib')

const MIN_BYTES = 2
const ALLOWED_EMPTY = new Set([
  // Files intentionally empty/placeholder (add to this set with a comment)
  'apolloClient.js',   // Shims in-memory Apollo; populated at runtime
])

/**
 * Collect all .js files in lib/ that are below the minimum size threshold.
 */
function findSuspiciouslyEmptyFiles() {
  const results = []
  let entries
  try {
    entries = fs.readdirSync(LIB, { withFileTypes: true })
  } catch {
    console.error('guard-empty-libs: cannot read lib/ directory')
    process.exit(1)
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.js')) continue

    const absPath = path.join(LIB, entry.name)
    const stat = fs.statSync(absPath)
    if (stat.size >= MIN_BYTES) continue
    if (ALLOWED_EMPTY.has(entry.name)) continue

    results.push({ file: entry.name, size: stat.size, absPath })
  }

  return results
}

/**
 * Check whether any other source file imports from a suspiciously empty file.
 */
function hasImporters(fileBasename) {
  // Import patterns for each directory tier
  const patterns = [
    `'./${fileBasename}'`,           // same-dir import (e.g. lib/ → lib/)
    `'../lib/${fileBasename}'`,      // components/ → lib/
    `'../../lib/${fileBasename}'`,   // pages/api/ → lib/
  ]
  const dirs = ['components', 'pages', 'lib']
  for (const dir of dirs) {
    const dirPath = path.join(ROOT, dir)
    let entries
    try {
      entries = fs.readdirSync(dirPath, { recursive: true, withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.js') && !entry.name.endsWith('.jsx') && !entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
      const content = fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8')
      for (const pattern of patterns) {
        if (content.includes(pattern)) return true
      }
    }
  }
  return false
}

function main() {
  const empty = findSuspiciouslyEmptyFiles()
  if (empty.length === 0) {
    console.log('[guard-empty-libs] ✅ All library files have content.')
    process.exit(0)
  }

  const imported = empty.filter((f) => hasImporters(f.file))
  if (imported.length === 0) {
    console.log('[guard-empty-libs] ⚠️  Empty lib files found, but none are imported:')
    for (const f of empty) {
      console.log(`  - ${f.file} (${f.size} bytes)`)
    }
    console.log('[guard-empty-libs] ✅ No imported empty files — safe.')
    process.exit(0)
  }

  console.error(`\n❌ CRITICAL: Empty lib files that ARE imported by source code:\n`)
  for (const f of imported) {
    console.error(`  ${f.file} — ${f.size} bytes — imported by at least one source file`)
  }
  console.error(`
  These exports will be \`undefined\` at runtime, causing:
    TypeError: X is not a function

  Fix: populate the file or remove the imports. If the file is intentionally empty,
  add it to the ALLOWED_EMPTY set in scripts/guard-empty-libs.cjs.\n`)
  process.exit(1)
}

main()
