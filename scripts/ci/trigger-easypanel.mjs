#!/usr/bin/env node
/**
 * GET Easypanel deploy hook (same contract as CI deploy job).
 * Env: EASYPANEL_DEPLOY_HOOK_URL
 */
const url = process.env.EASYPANEL_DEPLOY_HOOK_URL
if (!url) {
  console.error('Missing EASYPANEL_DEPLOY_HOOK_URL')
  process.exit(1)
}
const res = await fetch(url, { method: 'GET', redirect: 'follow' })
const text = await res.text().catch(() => '')
if (!res.ok) {
  console.error('Easypanel hook failed', res.status, text.slice(0, 500))
  process.exit(1)
}
console.log('Easypanel deploy hook: ok', res.status)
