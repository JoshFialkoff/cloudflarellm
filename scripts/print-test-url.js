#!/usr/bin/env node

function ensureTrailingSlash(url) {
  return /\/$/.test(url) ? url : `${url}/`
}

function normalizeUrlCandidate(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return ensureTrailingSlash(trimmed)
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(trimmed)) {
    return ensureTrailingSlash(`https://${trimmed}`)
  }
  return ''
}

function resolveTestingSiteUrl(env) {
  const candidates = [
    env.TEST_SITE_URL,
    env.URL,
    env.SITE_URL,
    env.NEXT_PUBLIC_SITE_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    env.DEPLOY_PRIME_URL,
    env.CF_PAGES_URL,
    env.VERCEL_BRANCH_URL,
    env.VERCEL_URL,
    env.RAILWAY_PUBLIC_DOMAIN,
    env.RENDER_EXTERNAL_URL,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeUrlCandidate(candidate)
    if (normalized) return normalized
  }

  return ''
}

const base = Number.parseInt(process.env.PORT || '3010', 10) || 3010
const testingSiteUrl = resolveTestingSiteUrl(process.env)

process.stdout.write(`Local test URL: http://localhost:${base}/\n`)

if (testingSiteUrl) {
  process.stdout.write(`Testing site URL: ${testingSiteUrl}\n`)
}
