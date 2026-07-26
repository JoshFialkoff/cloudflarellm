#!/usr/bin/env node
/**
 * Patch react-dom to add the ./server.edge export that Next.js 16+ expects.
 * React 18 only exports ./server with worker/browser conditions, but Next.js
 * runtime code imports "react-dom/server.edge" directly on the edge.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '../node_modules/react-dom/package.json');
if (!fs.existsSync(pkgPath)) {
  console.log('patch-react-dom-edge.js: react-dom not installed, skipping');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (pkg.exports && pkg.exports['./server.edge']) {
  console.log('patch-react-dom-edge.js: ./server.edge already exists');
  process.exit(0);
}

// Resolve what the edge bundle should point to.
// React 18 worker condition points at server.browser.js — use that for edge too.
const target = './server.browser.js';

pkg.exports = {
  ...(pkg.exports || {}),
  './server.edge': target,
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('patch-react-dom-edge.js: added ./server.edge ->', target);
