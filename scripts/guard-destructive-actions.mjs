#!/usr/bin/env node
/**
 * Destructive Action Pre-Execution Gate
 *
 * Run as a pre-flight check before any shell command or API call that
 * could alter infrastructure, delete data, or revert state.
 *
 * This script is designed to be called BY THE BOT before executing
 * a command matching a destructive pattern.
 *
 * Usage (from agent context):
 *   node scripts/guard-destructive-actions.mjs --cmd="npx wrangler rollback --config wrangler-slot4.toml"
 *
 * Exit 0 = cleared to proceed (after user confirmation).
 * Exit 1 = blocked (matches destructive pattern and not pre-approved).
 */

import { existsSync, readFileSync } from 'fs';

const DESTRUCTIVE_PATTERNS = [
  // Rollbacks / reverts
  /wrangler\s+rollback/i,
  /git\s+revert/i,
  /git\s+reset\s+--hard/i,
  /git\s+checkout\s+-f/i,
  // Deletions (bulk / irreversible)
  /wrangler\s+delete/i,
  /wrangler\s+remove/i,
  /rm\s+-rf/i,
  /rm\s+-f/i,
  /docker\s+system\s+prune/i,
  /docker\s+volume\s+rm/i,
  /docker\s+network\s+rm/i,
  // Force history rewrite
  /git\s+push\s+.*-f/i,
  /git\s+push\s+.*--force/i,
  // Database destructive
  /DROP\s+(TABLE|DATABASE|SCHEMA|INDEX)/i,
  /DELETE\s+FROM\s+/i,
  /TRUNCATE\s+TABLE/i,
  // Infra destructive
  /npx\s+wrangler.*delete/i,
  /wrangler.*kv.*delete/i,
  /wrangler.*d1.*delete/i,
  /wrangler.*r2.*delete/i,
  // DNS / domain destructive
  /wrangler.*zone.*delete/i,
];

// Commands that look destructive at a quick glance but are actually safe
const SAFE_PATTERN_OVERRIDES = [
  /rm\s+-rf\s+node_modules/i,  // clearing local deps is fine
  /rm\s+-rf\s+\.next/i,
  /rm\s+-rf\s+\.open-next/i,
  /git\s+push\s+.*--force-with-lease/i, // safer force-push variant
];

const args = process.argv.slice(2);
let command = '';

for (const a of args) {
  if (a.startsWith('--cmd=')) {
    command = a.slice(6);
  }
}

// If no --cmd provided, read from stdin (for piping)
if (!command && !process.stdin.isTTY) {
  let stdinData = '';
  process.stdin.on('data', d => { stdinData += d; });
  process.stdin.on('end', () => {
    command = stdinData.trim();
    main();
  });
} else {
  main();
}

function main() {
  if (!command) {
    console.error('Usage: node scripts/guard-destructive-actions.mjs --cmd="<command>"');
    process.exit(1);
  }

  // Check safe overrides first
  for (const safe of SAFE_PATTERN_OVERRIDES) {
    if (safe.test(command)) {
      console.log('✅ DESTRUCTIVE-ACTION-GUARD: Command matches safe override pattern. Proceed.');
      process.exit(0);
    }
  }

  let matchedPattern = null;
  for (const p of DESTRUCTIVE_PATTERNS) {
    if (p.test(command)) {
      matchedPattern = p;
      break;
    }
  }

  if (!matchedPattern) {
    console.log('✅ DESTRUCTIVE-ACTION-GUARD: No destructive patterns matched. Proceed.');
    process.exit(0);
  }

  // Matched a destructive pattern — this MUST be resolved via user confirmation
  // A bot should NEVER pass this gate automatically.
  console.error('');
  console.error('❌ DESTRUCTIVE ACTION BLOCKED');
  console.error(`   Command: ${command}`);
  console.error(`   Matched pattern: ${matchedPattern}`);
  console.error('');
  console.error('   This action is classified as DESTRUCTIVE or IRREVERSIBLE.');
  console.error('   Bots/agents may NOT proceed without explicit human confirmation.');
  console.error('');
  console.error('   To proceed, the user must type: !!CONFIRMED');
  console.error('   Generic responses like "ok", "go ahead", or "just do it" are NOT sufficient.');
  console.error('');

  process.exit(1);
}
