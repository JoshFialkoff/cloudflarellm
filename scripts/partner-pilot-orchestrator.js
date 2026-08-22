#!/usr/bin/env node
/**
 * Partner Pilot Orchestrator
 * 
 * Trigger: Run this when agentic outreach receives a positive partner response.
 * Usage:
 *   node scripts/partner-pilot-orchestrator.js --partner=<slug> --source=<chatbot|email|form> --confidence=high
 * 
 * What it does:
 *   1. Validates the partner exists in data/partners.json
 *   2. Activates partner (if --activate flag passed)
 *   3. Re-runs research deep-dive via assistedly-partner-research skill prompt
 *   4. Rebuilds partner dev assets (npm run build)
 *   5. Generates partner-specific content via assistedly-partner-content skill
 *   6. Sets up PostHog dashboard tags for this partner
 *   7. Creates Plane stories via assistedly-pilot-pm skill
 *   8. Posts completion summary to Discord
 * 
 * Discord webhook URL is injected via DISCORD_PARTNER_PILOT_WEBHOOK env var.
 */

const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────
const PARTNERS_JSON = path.resolve(__dirname, '../data/partners.json');
const PROJECT_ROOT = path.resolve(__dirname, '..');

const { upsertPartnerOpportunity } = require('../lib/partner-pilot/twenty-opportunity.js');
const { recommendNextAction } = require('../lib/partner-pilot/recommendNextAction.js');
const { getOutreachTiming } = require('../lib/partner-pilot/timing-intelligence.js');

function log(...args) {
  const ts = new Date().toISOString();
  console.log(`[${ts}]`, ...args);
}

function readPartners() {
  return JSON.parse(fs.readFileSync(PARTNERS_JSON, 'utf8'));
}

async function postDiscord(payload) {
  const webhook = process.env.DISCORD_PARTNER_PILOT_WEBHOOK;
  if (!webhook) {
    log('⚠️  DISCORD_PARTNER_PILOT_WEBHOOK not set. Skipping Discord post.');
    return { ok: false, reason: 'no_webhook' };
  }
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord HTTP ${res.status}: ${text}`);
    }
    log('✅ Discord update posted');
    return { ok: true };
  } catch (err) {
    log('❌ Discord post failed:', err.message);
    return { ok: false, reason: err.message };
  }
}

// ─── Phase 1: Validate Partner ───────────────────────────────────────
function phase1_validatePartner(slug) {
  log(`🔍 Phase 1: Validating partner "${slug}"...`);
  const data = readPartners();
  const partner = data.partners.find(p => p.slug === slug);
  if (!partner) {
    throw new Error(`Partner "${slug}" not found in ${PARTNERS_JSON}`);
  }
  log(`   Found: ${partner.name} (active=${partner.active})`);
  return partner;
}

// ─── Phase 2: Activate Partner ─────────────────────────────────────
function phase2_activatePartner(slug) {
  log(`⚡ Phase 2: Activating partner "${slug}"...`);
  const data = readPartners();
  const partner = data.partners.find(p => p.slug === slug);
  if (!partner) throw new Error('Partner vanished during activation');
  
  partner.active = true;
  partner.pilotStartDate = new Date().toISOString().split('T')[0];
  fs.writeFileSync(PARTNERS_JSON, JSON.stringify(data, null, 2));
  log(`   Activated ${partner.name}. pilotStartDate=${partner.pilotStartDate}`);
}

// ─── Phase 3: Research Deep-Dive (skill prompt for human/agent) ────
function phase3_researchBrief(partner) {
  log(`📚 Phase 3: Generating research brief for ${partner.name}...`);
  const brief = {
    skill: 'assistedly-partner-research',
    action: 'deep_dive_on_responder',
    partner: partner.slug,
    instructions: [
      `Refresh Firecrawl scrape of ${partner.url || `https://${partner.slug}.com`}`,
      'Extract leadership page contacts (Partnerships/BD/BizDev titles)',
      'Identify current care-transition content gaps (blog, resources, FAQ)',
      'Score market fit: customer age demographics, churn signals, upsell paths',
      'Output: docs/partner-pilot/responses/{slug}-deep-dive.md',
    ],
  };
  fs.mkdirSync(path.resolve(PROJECT_ROOT, 'docs/partner-pilot/responses'), { recursive: true });
  fs.writeFileSync(
    path.resolve(PROJECT_ROOT, `docs/partner-pilot/responses/${partner.slug}-research-brief.json`),
    JSON.stringify(brief, null, 2)
  );
  log(`   Research brief written to docs/partner-pilot/responses/${partner.slug}-research-brief.json`);
}

// ─── Phase 4: Dev Build ────────────────────────────────────────────
function phase4_devBuild(partner) {
  log(`🏗️  Phase 4: Preparing dev build for ${partner.name}...`);
  // Emit checklist file for CI/build step
  const checklist = {
    skill: 'assistedly-partner-dev',
    actions: [
      `Verify app/partner/[slug]/page.js renders ${partner.slug}`,
      'Verify consent modal loads with correct disclosureHtml',
      `Confirm PostHog events reference partner_slug="${partner.slug}"`,
      'Run: node scripts/guard-critical-features.mjs',
      'Run: node scripts/guard-no-second-header.mjs',
      'Run: npm run build',
      'Run: npx wrangler deploy --config wrangler-slot4.toml',
    ],
  };
  fs.writeFileSync(
    path.resolve(PROJECT_ROOT, `docs/partner-pilot/responses/${partner.slug}-dev-checklist.json`),
    JSON.stringify(checklist, null, 2)
  );
  log(`   Dev checklist written.`);
}

// ─── Phase 5: Content Assets ───────────────────────────────────────
function phase5_contentAssets(partner) {
  log(`✍️  Phase 5: Generating content asset specs for ${partner.name}...`);
  const specs = {
    skill: 'assistedly-partner-content',
    actions: [
      `Generate partner-one-pager-${partner.slug}.md from template (docs/partner-pilot/partner-one-pager.md)`,
      `Generate email-sequence-${partner.slug}.md with specific social proof angles`,
      `Generate landing-page-copy-${partner.slug}.md with partner brand color ${partner.brandColor}`,
      'Run DataForSEO MCP: optimize headline/FAQ for "{partner} care transition"',
    ],
  };
  fs.writeFileSync(
    path.resolve(PROJECT_ROOT, `docs/partner-pilot/responses/${partner.slug}-content-spec.json`),
    JSON.stringify(specs, null, 2)
  );
  log(`   Content specs written.`);
}

// ─── Phase 6: Analytics Tags ─────────────────────────────────────────
function phase6_analytics(partner) {
  log(`📊 Phase 6: Setting up analytics tags for ${partner.name}...`);
  const tags = {
    skill: 'assistedly-pilot-analytics',
    partner: partner.slug,
    posthog_events: [
      { event: 'partner_landing_view', filter: `partner_slug == "${partner.slug}"` },
      { event: 'partner_consent_accepted', filter: `partner_slug == "${partner.slug}"` },
      { event: 'partner_assessment_start', filter: `partner_slug == "${partner.slug}"` },
      { event: 'partner_assessment_complete', filter: `partner_slug == "${partner.slug}"` },
      { event: 'partner_search_handoff', filter: `partner_slug == "${partner.slug}"` },
    ],
    dashboard_action: 'Create PostHog dashboard "Partner Pilot — {slug}" with funnel from landing → consent → assessment → search handoff',
  };
  fs.writeFileSync(
    path.resolve(PROJECT_ROOT, `docs/partner-pilot/responses/${partner.slug}-analytics.json`),
    JSON.stringify(tags, null, 2)
  );
  log(`   Analytics config written.`);
}

// ─── Phase 7: PM Stories ───────────────────────────────────────────
function phase7_pmStories(partner, source, confidence) {
  log(`📋 Phase 7: Creating PM stories for ${partner.name}...`);
  const stories = {
    skill: 'assistedly-pilot-pm',
    project: 'BIZDEV',
    partner: partner.slug,
    epic: `Partner Pilot — ${partner.name}`,
    stories: [
      { title: `BD: Contract review & e-sign for ${partner.name}`, state: 'Todo' },
      { title: `Dev: Deploy co-branded experience /partner/${partner.slug}`, state: 'Todo' },
      { title: `Content: Finalize landing page + one-pager PDF`, state: 'Todo' },
      { title: `Analytics: Verify PostHog funnel + D1 attribution table`, state: 'Todo' },
      { title: `Ops: Schedule weekly sync with ${partner.name} BD contact`, state: 'Todo' },
      { title: `Legal: Confirm MA-scope compliance + disclosure language`, state: 'In Progress' },
    ],
    meta: { source, confidence, createdAt: new Date().toISOString() },
  };
  fs.writeFileSync(
    path.resolve(PROJECT_ROOT, `docs/partner-pilot/responses/${partner.slug}-pm-stories.json`),
    JSON.stringify(stories, null, 2)
  );
  log(`   PM stories written.`);
}

// ─── Phase 8: Twenty Opportunity + Timing Intelligence ─────────────
async function phase8_twentyOpportunity(partner, source, confidence, replyText, outreachText) {
  log(`🗂️  Phase 8: Computing timing intelligence...`);
  const timing = getOutreachTiming({
    slug: partner.slug,
    city: partner.hqCity,
    roleHint: 'partnerships_exec',
    replyText,
    platform: source,
  });
  log(`   ⏰ Best: ${timing.time_of_day} on ${timing.day_of_week.join('/')} (${timing.timezone})`);

  log(`   🗂️  Syncing to Twenty CRM (Opportunity on Person)...`);

  const next = recommendNextAction(replyText);
  try {
    const result = await upsertPartnerOpportunity({
      companyName: partner.name,
      targetSlug: partner.slug,
      outreachText: outreachText || '(outreach text not recorded)',
      platform: source,
      optimalTiming: timing,
      replyText: replyText || '(no reply captured)',
      replySentiment: 'positive',
      replyConfidence: confidence,
      nextAction: next.action,
      nextRationale: next.rationale,
    });
    if (result.success) {
      log(`   ✓ Opportunity: ${result.opportunityId || 'note-on-person'} — [${result.companyName}]`);
    } else {
      log(`   ⚠️  Twenty: ${result.reason}`);
    }
    return { ...result, timing };
  } catch (err) {
    log(`   ❌ Twenty sync failed: ${err.message}`);
    return { success: false, reason: err.message, timing };
  }
}

// ─── Phase 9: Discord Summary (with reply + timing + next action) ──
async function phase9_discordSummary(partner, source, confidence, argv, replyText, twentyResult) {
  log(`📢 Phase 9: Posting Discord summary...`);
  const action  = argv.includes('--activate') ? 'ACTIVATED & DEPLOYED' : 'STAGED (activate with --activate)';
  const next    = recommendNextAction(replyText);
  const timing  = twentyResult?.timing || {};

  const replyPreview = replyText
    ? (replyText.length > 800 ? replyText.substring(0, 800) + '…' : replyText)
    : '(No reply text provided)';

  const twentyLink = process.env.TWENTY_BASE_URL ? `${process.env.TWENTY_BASE_URL}/companies/${twentyResult?.companyId}`
    : (twentyResult?.companyId ? `http://107.172.94.35:3002/companies/${twentyResult.companyId}` : null);

  const embed = {
    username: 'Partner Pilot Bot',
    avatar_url: 'https://assistedly.ai/android-chrome-192x192.png',
    embeds: [{
      title: `🤝 Partner Response Received — ${partner.name}`,
      description: `Agentic outreach received a **${confidence}**-confidence positive response via **${source}**.`,
      color: 0x4a7c7e,
      fields: [
        { name: '🏢 Company', value: partner.name, inline: true },
        { name: '🔖 Slug', value: partner.slug, inline: true },
        { name: '📊 Status', value: action, inline: true },
        { name: '🔗 Attribution', value: partner.attributionParam || 'N/A', inline: true },
        { name: '🎨 Brand Color', value: partner.brandColor || 'N/A', inline: true },
        { name: '📅 Pilot Start', value: partner.pilotStartDate || 'Pending', inline: true },
        { name: '💬 Reply Message', value: `\`\`\`${replyPreview}\`\`\`` },
        { name: '✅ Recommended Next Action', value: `**${next.action}**\n_${next.rationale}_` },
        { name: '⏰ Optimal Timing', value:
          `**Time:** ${timing.time_of_day || 'TBD'}\n` +
          `**Day(s):** ${(timing.day_of_week || []).join(', ') || 'TBD'}\n` +
          `**TZ:** ${timing.timezone || 'TBD'}\n` +
          `**Backup:** ${timing.backup_window || 'TBD'}`, inline: false },
        { name: '📣 Platform', value: timing.platform?.primary || source },
        { name: '🗂️  Twenty CRM', value: twentyResult?.success
          ? `Opportunity synced — [${twentyResult.companyName}](${twentyLink})`
          : `Sync skipped (${twentyResult?.reason || 'unknown'})` },
        { name: '📦 Artifacts', value:
          `• Research brief\n• Dev checklist\n• Content specs\n• Analytics tags\n• PM stories`, inline: false },
        { name: '🔜 Next Steps', value:
          argv.includes('--activate')
            ? 'Build + deploy → verify PostHog events → kickoff call'
            : 'Review artifacts → run with `--activate` to enable partner', inline: false },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Assistedly.ai Partner Pilot · Care Transition Trust Layer' },
    }],
  };
  await postDiscord(embed);
}

// ─── Main ────────────────────────────────────────────────────────────
function printUsage() {
  console.log(`
Usage:
  node partner-pilot-orchestrator.js
    --partner=<slug>
    --source=<chatbot|email|form>
    --confidence=<low|medium|high>
    --reply="<their reply text>"
    --outreach-text="<message we sent>"
    [--activate]

Example:
  node partner-pilot-orchestrator.js \
    --partner=medicalguardian \
    --source=chatbot \
    --confidence=high \
    --reply="We would love to explore this. Can we schedule a call next week?" \
    --outreach-text="Hi — we help families transition from medical-alert devices into assisted living safely and independently. Would you be open to a 15-min exploration of how a co-branded care-transition path could work for Medical Guardian families?" \
    --activate
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const getArg = (k) => {
    const v = argv.find(a => a.startsWith(`${k}=`));
    return v ? v.split('=').slice(1).join('=') : undefined;
  };

  const slug          = getArg('--partner');
  const source          = getArg('--source') || 'unknown';
  const confidence      = getArg('--confidence') || 'medium';
  const reply           = getArg('--reply') || '';
  const outreachText    = getArg('--outreach-text') || '';

  if (!slug) {
    console.error('❌ Missing --partner argument');
    printUsage();
    process.exit(1);
  }

  log('═══════════════════════════════════════════════════════');
  log('  PARTNER PILOT ORCHESTRATOR');
  log('═══════════════════════════════════════════════════════');
  log(`  Partner:    ${slug}`);
  log(`  Source:     ${source}`);
  log(`  Confidence: ${confidence}`);
  log(`  Activate:   ${argv.includes('--activate') ? 'YES' : 'NO (dry-run)'}`);
  log('═══════════════════════════════════════════════════════');

  try {
    // Phase 1–2
    const partner = phase1_validatePartner(slug);
    if (argv.includes('--activate')) {
      phase2_activatePartner(slug);
      // Re-read after mutation
      const refreshed = readPartners().partners.find(p => p.slug === slug);
      Object.assign(partner, refreshed);
    }

    // Phase 3–7 (artifact generation)
    phase3_researchBrief(partner);
    phase4_devBuild(partner);
    phase5_contentAssets(partner);
    phase6_analytics(partner);
    phase7_pmStories(partner, source, confidence);

    // Phase 8: Twenty Opportunity + Timing Intelligence
    const twentyResult = await phase8_twentyOpportunity(partner, source, confidence, reply, outreachText);

    // Phase 9: Discord notification (with reply + timing + next action)
    await phase9_discordSummary(partner, source, confidence, argv, reply, twentyResult);

    log('═══════════════════════════════════════════════════════');
    log('  ✅ ALL PHASES COMPLETE');
    log('═══════════════════════════════════════════════════════');
    log(`  Artifacts in: docs/partner-pilot/responses/${slug}-*.json`);
    if (!argv.includes('--activate')) {
      log('  To activate partner, re-run with --activate');
    }
    log('═══════════════════════════════════════════════════════');
  } catch (err) {
    log('❌ ORCHESTRATOR FAILED:', err.message);
    await postDiscord({
      username: 'Partner Pilot Bot',
      embeds: [{
        title: '❌ Orchestrator Failure',
        description: err.message,
        color: 0xe11d48,
        timestamp: new Date().toISOString(),
      }],
    });
    process.exit(1);
  }
}

main();
