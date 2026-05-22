#!/usr/bin/env node

function ensureTrailingSlash(url) {
  return /\/$/.test(url) ? url : `${url}/`
}

const base = Number.parseInt(process.env.PORT || '3010', 10) || 3010
const testingSiteUrl = String(process.env.TEST_SITE_URL || '').trim()

process.stdout.write(`Local test URL: http://localhost:${base}/\n`)

if (testingSiteUrl) {
  process.stdout.write(`Testing site URL: ${ensureTrailingSlash(testingSiteUrl)}\n`)
}
