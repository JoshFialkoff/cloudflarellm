#!/usr/bin/env node
/**
 * Full-zone cache purge (same contract as CI deploy job).
 * Env: CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN
 */
const zone = process.env.CLOUDFLARE_ZONE_ID
const token = process.env.CLOUDFLARE_API_TOKEN
const purgeRequired = process.env.CLOUDFLARE_PURGE_REQUIRED !== '0'

function exitWithPurgeFailure(message) {
  if (purgeRequired) {
    console.error(message)
    process.exit(1)
  }

  console.warn(`::warning::${message}`)
}

if (!zone || !token) {
  exitWithPurgeFailure('Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN')
  process.exit(0)
}
const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ purge_everything: true }),
})
const body = await res.json().catch(() => ({}))
if (!res.ok || body.success !== true) {
  exitWithPurgeFailure(`Cloudflare purge failed ${res.status} ${JSON.stringify(body)}`)
  process.exit(0)
}
console.log('Cloudflare purge_everything: success')
