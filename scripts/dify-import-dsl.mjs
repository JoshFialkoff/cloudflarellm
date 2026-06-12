#!/usr/bin/env node
/**
 * Import a Dify DSL YAML into dify.forwardjump.com (or DIFY_CONSOLE_BASE_URL).
 * Requires a Dify Studio console token — not the app API key.
 *
 * Usage:
 *   DIFY_CONSOLE_TOKEN=... npm run dify:import -- dify/fast-top-3-ma-assisted-living-finder.dsl.yml
 */
import fs from 'node:fs'
import path from 'node:path'

const fileArg = process.argv[2]
if (!fileArg) {
  console.error('Usage: node scripts/dify-import-dsl.mjs <path-to.dsl.yml>')
  process.exit(1)
}

const token = String(process.env.DIFY_CONSOLE_TOKEN || '').trim()
if (!token) {
  console.error(
    'Missing DIFY_CONSOLE_TOKEN. Copy the Bearer token from Dify Studio (browser devtools → Network → console/api).'
  )
  process.exit(1)
}

const base = String(process.env.DIFY_CONSOLE_BASE_URL || 'https://dify.forwardjump.com').replace(
  /\/$/,
  ''
)
const dslPath = path.resolve(process.cwd(), fileArg)
const yaml_content = fs.readFileSync(dslPath, 'utf8')

const res = await fetch(`${base}/console/api/apps/import`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mode: 'yaml-content',
    yaml_content,
  }),
})

const text = await res.text()
let json
try {
  json = JSON.parse(text)
} catch {
  console.error(`Import failed (${res.status}): non-JSON response`)
  console.error(text.slice(0, 800))
  process.exit(1)
}

if (!res.ok) {
  console.error(`Import failed (${res.status}):`, json)
  process.exit(1)
}

const status = json?.status
const importId = json?.import_id || json?.id
console.log(JSON.stringify({ ok: true, status, importId, appId: json?.app_id, file: dslPath }, null, 2))

if (status === 'pending' && importId) {
  const confirm = await fetch(`${base}/console/api/apps/import/${importId}/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  const confirmText = await confirm.text()
  console.log('confirm:', confirm.status, confirmText.slice(0, 500))
}
