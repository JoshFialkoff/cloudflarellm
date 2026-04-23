#!/usr/bin/env node
/**
 * Full-zone cache purge (same contract as CI deploy job).
 * Env: CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN
 */
const zone = process.env.CLOUDFLARE_ZONE_ID
const token = process.env.CLOUDFLARE_API_TOKEN
if (!zone || !token) {
  console.error('Missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN')
  process.exit(1)
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
  console.error('Cloudflare purge failed', res.status, body)
  process.exit(1)
}
console.log('Cloudflare purge_everything: success')
