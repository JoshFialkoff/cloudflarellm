#!/usr/bin/env node
/**
 * confirm-and-trigger-pilot.js
 *
 * Review captured positive responses and manually confirm trigger.
 * Syncs to Twenty CRM and runs the full orchestrator on approval.
 *
 * Usage:
 *   node scripts/confirm-and-trigger-pilot.js
 *
 * Reads: docs/partner-pilot/responses/outreach-response-log.jsonl
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const { recommendNextAction } = require('../lib/partner-pilot/recommendNextAction.js');

const RESPONSE_LOG = path.resolve(__dirname, '../docs/partner-pilot/responses/outreach-response-log.jsonl');

function readResponses() {
  if (!fs.existsSync(RESPONSE_LOG)) return [];
  return fs.readFileSync(RESPONSE_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function askYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question + ' (y/n) ', ans => {
      rl.close();
      resolve(ans.trim().toLowerCase().startsWith('y'));
    });
  });
}

async function main() {
  const responses = readResponses();
  const positives = responses.filter(r => r.classification?.sentiment === 'positive');

  if (positives.length === 0) {
    console.log('No positive responses found in the log.');
    console.log('Responses log:', RESPONSE_LOG);
    process.exit(0);
  }

  console.log(`Found ${positives.length} positive response(s):\n`);
  for (const entry of positives) {
    const combinedReply = entry.replies?.join('\n') || '(No reply captured)';
    const next = recommendNextAction(combinedReply);

    console.log(`─`.repeat(60));
    console.log(`🏢 Company:  ${entry.name} (${entry.target})`);
    console.log(`🕐 Time:     ${entry.ts}`);
    console.log(`📊 Sentiment: ${entry.classification.sentiment} (${entry.classification.confidence})`);
    console.log(`💬 Replies:`);
    entry.replies.forEach((r, i) => console.log(`  ${i + 1}. ${r.substring(0, 200)}${r.length > 200 ? '...' : ''}`));
    console.log(`✅ Next Action: ${next.action}`);
    console.log(`   Rationale:  ${next.rationale}`);
    console.log(`📸 Screenshot: ${entry.screenshot || 'N/A'}`);

    const shouldTrigger = await askYesNo(`\nTrigger pilot pipeline for ${entry.name}?`);
    if (shouldTrigger) {
      // Build orchestrator command with reply and outreach text
      const replyArg     = combinedReply.replace(/"/g, '\\"');
      const outreachArg  = (entry.outreachText || '').replace(/"/g, '\\"');
      const cmd = [
        'node', path.resolve(__dirname, 'partner-pilot-orchestrator.js'),
        `--partner=${entry.target}`,
        `--source=${entry.chatType || 'chatbot'}`,
        `--confidence=${entry.classification.confidence}`,
        `--reply="${replyArg.substring(0, 1200)}"`,
        outreachArg ? `--outreach-text="${outreachArg.substring(0, 1200)}"` : '',
        '--activate',
      ].filter(Boolean).join(' ');

      console.log(`\n▶ Syncing to Twenty CRM + running orchestrator for ${entry.name}...\n`);
      try {
        execSync(cmd, { stdio: 'inherit' });
      } catch (err) {
        console.error(`Trigger failed: ${err.message}`);
      }
    } else {
      console.log(`Skipped ${entry.name}.\n`);
    }
  }
}

main();
