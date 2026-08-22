#!/usr/bin/env node
/**
 * run-daily.cjs
 * Daily bookkeeping orchestrator for Assistedly, Inc.
 */

const { ERPNextClient } = require('./lib/erpnext-client.cjs');
const { RampClient } = require('./lib/ramp-client.cjs');
const { log, buildExceptionReport } = require('./lib/logger.cjs');

const DRY_RUN = process.env.DRY_RUN === '1';
const EXCEPTIONS = [];

function noteException(action, message, meta) {
  const e = { action, message, meta, ts: new Date().toISOString() };
  EXCEPTIONS.push(e);
  log({ action: 'exception', message, meta });
}

async function postDiscordIfConfigured(content) {
  const url = process.env.POST_DISCORD_URL;
  if (!url) return;
  try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: content.slice(0, 1900) }) }); } catch {}
}

/* ── Mapping helpers ─────────────────────────────────────────── */
function mapTransactionToAccount(merchantName, amount, description = '') {
  const text = `${merchantName || ''} ${description || ''}`.toLowerCase();
  if (/aws|amazon web services|google cloud|gcp|azure|vercel|netlify|heroku|digitalocean|linode/.test(text))
    return { account: 'Administrative Expenses - ASSIST', costCenter: '' };
  if (/meta|facebook|instagram|google ads|linkedin|twitter|reddit|tiktok|ad spend|campaign/.test(text))
    return { account: 'Marketing Expenses - ASSIST', costCenter: '' };
  if (/airbnb|uber|lyft|delta|united|american airlines|hotel/.test(text))
    return { account: 'Travel Expenses - ASSIST', costCenter: '' };
  if (/slack|zoom|notion|linear|github|gitlab|atlassian|jira/.test(text))
    return { account: 'Administrative Expenses - ASSIST', costCenter: '' };
  if (/cloudflare|fastly|akamai|cdn|datadog|new relic|sentry/.test(text))
    return { account: 'Administrative Expenses - ASSIST', costCenter: '' };
  return { account: 'Miscellaneous Expenses - ASSIST', costCenter: '' };
}

function buildJournalEntryFromRamp(transactions, postingDate) {
  const lines = [];
  for (const tx of transactions) {
    const { account, costCenter } = mapTransactionToAccount(tx.merchant_name, tx.amount, tx.description);
    const amount = (tx.amount || 0) / 100;
    lines.push({
      account,
      debit_in_account_currency: amount,
      credit_in_account_currency: 0,
      cost_center: costCenter,
      user_remark: `Ramp: ${tx.merchant_name} — ${tx.description || ''} (ref: ${tx.id})`.slice(0, 140),
    });
  }
  const total = lines.reduce((s, l) => s + l.debit_in_account_currency, 0);
  lines.push({
    account: 'Accounts Payable - ASSIST',
    debit_in_account_currency: 0,
    credit_in_account_currency: total,
    cost_center: '',
  });
  return { postingDate, lines, remarks: `Daily Ramp sync — ${transactions.length} transactions, total ${total.toFixed(2)}` };
}

async function syncRampToERPNext(erpnext, ramp) {
  log({ action: 'sync', message: 'Starting Ramp → ERPNext sync' });
  try {
    const txs = await ramp.getReadyToSyncTransactions({ limit: 200 });
    if (txs.length === 0) { log({ action: 'sync', message: 'No Ramp transactions ready to sync.' }); return { processed: 0, totalAmount: 0 }; }
    log({ action: 'sync', message: `Found ${txs.length} Ramp transactions ready to sync` });
    const today = new Date().toISOString().slice(0, 10);
    const jv = buildJournalEntryFromRamp(txs, today);
    if (DRY_RUN) { log({ action: 'sync', message: `DRY RUN — would create Journal Entry with ${jv.lines.length} lines`, meta: { lines: jv.lines } }); return { processed: txs.length, totalAmount: jv.lines.slice(0, -1).reduce((s, l) => s + l.debit_in_account_currency, 0) }; }
    const created = await erpnext.createJournalEntry({ postingDate: jv.postingDate, lines: jv.lines, remarks: jv.remarks, docstatus: 0 });
    log({ action: 'sync', message: `Created draft Journal Entry ${created.name}`, meta: { name: created.name, transactionCount: txs.length } });
    try { await ramp.markSynced(txs.map((t) => t.id)); log({ action: 'sync', message: `Marked ${txs.length} Ramp transactions as SYNCED` }); } catch (markErr) { noteException('sync', `Failed to mark Ramp transactions as synced: ${markErr.message}`, { jvName: created.name }); }
    return { processed: txs.length, totalAmount: jv.lines.slice(0, -1).reduce((s, l) => s + l.debit_in_account_currency, 0), jvName: created.name };
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('DEVELOPER_7100') || msg.includes('scopes are not allowed')) {
      noteException('sync', 'Ramp API scope mismatch: transactions:read not enabled for this app. Please enable it in Ramp dashboard → Company → Developer → Apps.', { raw: msg });
    } else {
      noteException('sync', `Ramp sync failed: ${msg}`);
    }
    return { processed: 0, totalAmount: 0 };
  }
}

async function reconcileClearingAccounts(erpnext) {
  log({ action: 'reconcile', message: 'Checking clearing account balances' });
  try {
    const gl = await erpnext.listGLEntries([ ['company', '=', erpnext.company], ['posting_date', '>=', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)], ['account', 'like', '%Payable%'] ]);
    const byAccount = {};
    for (const row of gl) { if (!byAccount[row.account]) byAccount[row.account] = { debit: 0, credit: 0, count: 0 }; byAccount[row.account].debit += row.debit || 0; byAccount[row.account].credit += row.credit || 0; byAccount[row.account].count++; }
    for (const [acct, bal] of Object.entries(byAccount)) { const net = bal.debit - bal.credit; log({ action: 'reconcile', message: `Clearing ${acct}: net ${net.toFixed(2)} (${bal.count} GL entries)`, meta: { account: acct, net } }); if (Math.abs(net) > 0.01) { noteException('reconcile', `Clearing account ${acct} has non-zero balance ${net.toFixed(2)}`, { account: acct, net }); } }
  } catch (err) { noteException('reconcile', `Clearing account check failed: ${err.message}`); }
}

async function verifyTrialBalance(erpnext) {
  log({ action: 'verify', message: 'Running Trial Balance verification' });
  try { const tb = await erpnext.getTrialBalance(); const check = erpnext.verifyTrialBalance(tb); if (check.isBalanced) { log({ action: 'verify', message: 'Trial balance is balanced ✅', meta: check }); } else { noteException('verify', 'Trial balance is UNBALANCED ❌', check); } return check; } catch (err) { noteException('verify', `Trial Balance failed: ${err.message}`); return null; }
}

async function draftExceptionReport() {
  const report = buildExceptionReport(EXCEPTIONS);
  log({ action: 'info', message: `Daily run complete. ${EXCEPTIONS.length} exceptions.`, meta: { exceptionCount: EXCEPTIONS.length } });
  if (EXCEPTIONS.length > 0) { await postDiscordIfConfigured(report); }
}

async function main() {
  const baseUrl = process.env.ERPNEXT_URL || 'http://75.127.14.185:8080';
  const apiKey = process.env.ERPNEXT_API_KEY || '';
  const apiSecret = process.env.ERPNEXT_API_SECRET || '';
  const company = process.env.ERPNEXT_COMPANY || 'Assistedly Inc';
  if (!apiKey || !apiSecret) { console.error('Missing ERPNEXT_API_KEY / ERPNEXT_API_SECRET. Load from Infisical first.'); process.exit(1); }
  const erpnext = new ERPNextClient({ baseUrl, apiKey, apiSecret, company });
  try { await erpnext.getLoggedUser(); } catch (err) { console.error(`ERPNext connection failed: ${err.message}`); log({ action: 'exception', message: `ERPNext connection failed: ${err.message}` }); process.exit(1); }
  let ramp = null;
  if (process.env.RAMP_CLIENT_ID && process.env.RAMP_CLIENT_SECRET) {
    ramp = new RampClient({ clientId: process.env.RAMP_CLIENT_ID, clientSecret: process.env.RAMP_CLIENT_SECRET, baseUrl: process.env.RAMP_BASE_URL || 'https://api.ramp.com' });
  }
  const summary = { rampProcessed: 0, rampTotalAmount: 0, balanced: false, exceptions: 0 };
  if (ramp) { const res = await syncRampToERPNext(erpnext, ramp); summary.rampProcessed = res.processed; summary.rampTotalAmount = res.totalAmount; } else { log({ action: 'sync', message: 'Ramp credentials not configured — skipping transaction sync.' }); }
  await reconcileClearingAccounts(erpnext);
  const tb = await verifyTrialBalance(erpnext); summary.balanced = tb?.isBalanced || false;
  await draftExceptionReport(); summary.exceptions = EXCEPTIONS.length;
  console.log('\n─── Daily Bookkeeping Summary ───');
  console.log(`Ramp transactions synced: ${summary.rampProcessed}`);
  console.log(`Total amount:              ${summary.rampTotalAmount.toFixed(2)}`);
  console.log(`Trial balance balanced:    ${summary.balanced ? '✅' : '❌'}`);
  console.log(`Exceptions:                ${summary.exceptions}`);
  console.log('────────────────────────────────\n');
  process.exit(summary.exceptions > 0 ? 1 : 0);
}
main();
