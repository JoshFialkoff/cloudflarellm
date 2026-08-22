#!/usr/bin/env node
/**
 * test-connection.cjs
 * Tests ERPNext auth, lists companies, prints COA summary.
 */
const { ERPNextClient } = require('./lib/erpnext-client.cjs');
const { log } = require('./lib/logger.cjs');

async function main() {
  const baseUrl = process.env.ERPNEXT_URL || 'http://75.127.14.185:8080';
  const apiKey = process.env.ERPNEXT_API_KEY || '';
  const apiSecret = process.env.ERPNEXT_API_SECRET || '';
  const company = process.env.ERPNEXT_COMPANY || 'Assistedly Inc';

  if (!apiKey || !apiSecret) {
    console.error('ERROR: ERPNEXT_API_KEY and ERPNEXT_API_SECRET must be set.');
    console.error('These are pulled from Infisical at secrets.assistedly.ai');
    process.exit(1);
  }

  const client = new ERPNextClient({ baseUrl, apiKey, apiSecret, company });

  try {
    console.log(`🔌 Testing connection to ERPNext at ${baseUrl} …`);
    const user = await client.getLoggedUser();
    console.log(`✅ Authenticated as ${user}`);
    log({ action: 'connection', message: `Authenticated as ${user}`, meta: { baseUrl, user } });
  } catch (err) {
    console.error(`❌ Connection failed: ${err.message}`);
    log({ action: 'exception', message: `Connection failed: ${err.message}`, meta: { baseUrl } });
    process.exit(1);
  }

  try {
    const companies = await client.listCompanies();
    const match = companies.find((c) => c.company_name === company || c.name === company);
    if (!match) {
      console.warn(`⚠️  Company "${company}" not found. Available companies:`);
      for (const c of companies) { console.warn(`   - ${c.company_name} (abbr: ${c.abbr})`); }
      log({ action: 'exception', message: `Company "${company}" not found`, meta: { available: companies.map((c) => c.company_name) } });
    } else {
      console.log(`✅ Company resolved: ${match.company_name} (${match.abbr}) — ${match.default_currency}`);
    }
  } catch (err) { console.error(`❌ Failed to list companies: ${err.message}`); }

  try {
    console.log('\n📊 Fetching Chart of Accounts …\n');
    const accounts = await client.getChartOfAccounts();
    console.log(`Found ${accounts.length} accounts.\n`);
    console.log(client.summarizeCOA(accounts));
    log({ action: 'sync', message: `Fetched ${accounts.length} COA accounts`, meta: { accountCount: accounts.length } });
  } catch (err) { console.error(`❌ Failed to fetch COA: ${err.message}`); log({ action: 'exception', message: `COA fetch failed: ${err.message}` }); }

  try {
    const tb = await client.getTrialBalance();
    const check = client.verifyTrialBalance(tb);
    const status = check.isBalanced ? '✅ BALANCED' : '❌ UNBALANCED';
    console.log(`\n📋 Trial Balance: ${status}`);
    console.log(`   Total Debits:  ${check.totalDebit.toFixed(2)}`);
    console.log(`   Total Credits: ${check.totalCredit.toFixed(2)}`);
  } catch (err) { console.error(`❌ Failed to run Trial Balance: ${err.message}`); }
}
main();
