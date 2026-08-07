#!/usr/bin/env node
/**
 * Postinstall fix for react-dom/server.edge on Cloudflare Workers.
 * This patches react-dom@18.3.1 after npm install runs.
 *
 * Problem: Next.js on Cloudflare requires react-dom/server.edge but
 * react-dom@18 doesn't export it. The patch-package patch for this
 * sometimes fails to apply the package.json exports map addition,
 * so this script ensures both the file and exports map are present.
 */
import fs from 'fs'
import path from 'path'

const pkgDir = path.resolve(process.cwd(), 'node_modules/react-dom')
const pkgJsonPath = path.join(pkgDir, 'package.json')
const serverEdgePath = path.join(pkgDir, 'server.edge.js')

function main() {
  // Only run if react-dom is installed (not during npm install of unrelated deps)
  if (!fs.existsSync(pkgJsonPath)) {
    console.log('[patch-react-dom] react-dom not installed, skipping.')
    process.exit(0)
  }

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))

  // 1. Ensure server.edge.js shim exists
  if (!fs.existsSync(serverEdgePath)) {
    fs.writeFileSync(serverEdgePath, "module.exports = require('./server.browser');\n")
    console.log('[patch-react-dom] Created server.edge.js')
  }

  // 2. Ensure exports map includes ./server.edge
  if (!pkg.exports || pkg.exports['./server.edge']) {
    console.log('[patch-react-dom] ./server.edge export already present, nothing to do.')
    process.exit(0)
  }

  const ordered = {}
  for (const [key, val] of Object.entries(pkg.exports)) {
    ordered[key] = val
    if (key === './server') {
      ordered['./server.edge'] = './server.edge.js'
    }
  }

  // Ensure it's actually in there (edge case if './server' wasn't in exports)
  if (!ordered['./server.edge']) {
    ordered['./server.edge'] = './server.edge.js'
  }

  pkg.exports = ordered
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log('[patch-react-dom] Added ./server.edge to exports map.')
}

main()
