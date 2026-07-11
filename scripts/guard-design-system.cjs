#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const cssPath = path.join(process.cwd(), 'styles', 'globals.css');

function fail(message) {
  process.stderr.write(`Design System Guard failed: ${message}\n`);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(cssPath)) {
    fail(`File not found: ${cssPath}`);
  }

  const cssText = fs.readFileSync(cssPath, 'utf8');

  // Verify .btn-primary default background is var(--accent)
  const primaryBtnMatch = cssText.match(/\.btn-primary\s*\{[^}]*background\s*:\s*var\(--accent\)/);
  if (!primaryBtnMatch) {
    fail('.btn-primary MUST use var(--accent) for its default background to ensure the gold color.');
  }

  // Verify mobile responsive viewport scale
  const documentPath = path.join(process.cwd(), 'pages', '_document.js');
  if (fs.existsSync(documentPath)) {
    const docText = fs.readFileSync(documentPath, 'utf8');
    if (!docText.includes('viewport-fit=cover')) {
      fail('_document.js MUST include viewport-fit=cover meta tag for mobile responsiveness.');
    }
  }

  // Verify responsive breakpoints exist
  if (!cssText.includes('@media (max-width: 1024px)') || !cssText.includes('@media (max-width: 768px)')) {
    fail('globals.css MUST preserve responsive breakpoints (1024px, 768px).');
  }

  process.stdout.write('Design System Guard passed.\n');
}

main();
