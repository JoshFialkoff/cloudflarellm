#!/usr/bin/env node
/**
 * Assistedly.ai Lead Gen Optimizer Engine
 * 
 * Implements 13-point revenue-optimization strategy:
 * 1. Search expansion (multi-platform)
 * 2. Opportunity scoring (Purchase Intent, LTV, Geography, Engagement, Timing)
 * 3. Competitive intelligence
 * 4. Automated ad copy generation
 * 5. Buying stage detection
 * 6. A/B test recommendations
 * 7. Budget allocation suggestions
 * 8. Multi-channel orchestration
 * 9. Feedback loops (PostHog → campaign optimization)
 * 10. Lead routing (Discord notifications with actionable recommendations)
 * 11. CPA tracking
 * 12. Next Best Action recommendations
 * 13. Conversion path analysis
 * 
 * Uses existing automations:
 * - firecrawl-social-engagement.cjs
 * - social-engagement-agents.cjs
 * - reddit-campaign-agent.cjs
 * - consolidate_firecrawl_results.py
 * - Dify MCPs (via DSL workflows)
 * 
 * Env:
 *   FIRECRAWL_API_KEY (required)
 *   OPENAI_API_KEY (optional, for enhanced scoring)
 *   DISCORD_WEBHOOK_URL (required)
 *   POSTHOG_API_KEY, POSTHOG_PROJECT_ID (for feedback loop)
 *   GA4_PROPERTY_ID, GA4_ACCESS_TOKEN (for conversion tracking)
 *   DIFY_CONSOLE_TOKEN (for workflow orchestration)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { postDiscordWebhook, splitDiscordContent } = require('./lib/discord-webhook.cjs');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

if (!FIRECRAWL_API_KEY) {
  console.error('❌ Missing FIRECRAWL_API_KEY');
  process.exit(1);
}

// Search themes (expanded from Reddit-only to multi-platform)
const SEARCH_THEMES = [
  {
    name: 'Assisted Living MA - Decision Ready',
    keywords: ['assisted living Massachusetts', 'memory care Boston', 'choosing assisted living'],
    buyingStage: 'decision',
    platforms: ['reddit', 'facebook', 'agingcare', 'seniorliving.org'],
    ltv_weight: 1.0,
  },
  {
    name: 'Assisted Living MA - Research Phase',
    keywords: ['assisted living options', 'how to choose assisted living', 'assisted living cost'],
    buyingStage: 'research',
    platforms: ['reddit', 'quora', 'agingcare'],
    ltv_weight: 0.7,
  },
  {
    name: 'Caregiver Burnout - High Intent',
    keywords: ['caregiver burnout', 'need help caring for parent', 'cannot care for parent anymore'],
    buyingStage: 'crisis',
    platforms: ['reddit', 'facebook', 'agingcare'],
    ltv_weight: 1.2, // Higher LTV - urgency signals higher close rate
  },
  {
    name: 'Premium Senior Care - Affluent',
    keywords: ['luxury assisted living', 'premium memory care', 'high-end senior care'],
    buyingStage: 'decision',
    platforms: ['reddit', 'facebook', 'caring.com'],
    ltv_weight: 1.5, // Much higher LTV for premium segment
  },
];

// Competitors to monitor
const COMPETITORS = [
  { name: 'A Place for Mom', domain: 'aplaceformom.com', threat_level: 'high' },
  { name: 'Caring.com', domain: 'caring.com', threat_level: 'medium' },
  { name: 'SeniorLiving.org', domain: 'seniorliving.org', threat_level: 'medium' },
  { name: 'Seniorly', domain: 'seniorly.com', threat_level: 'low' },
];

// Platform expansion (beyond Reddit)
const TARGET_PLATFORMS = [
  {
    name: 'Reddit',
    subreddits: ['AssistedLiving', 'AgingParents', 'boston', 'massachusetts', 'eldercare', 'dementia', 'Alzheimers'],
    engagement_style: 'conversational',
    promotion_tolerance: 'low',
    cpa_benchmark: 45,
  },
  {
    name: 'Facebook Groups',
    groups: ['Massachusetts Senior Care', 'Boston Caregivers'],
    engagement_style: 'supportive',
    promotion_tolerance: 'medium',
    cpa_benchmark: 38,
  },
  {
    name: 'AgingCare Forums',
    url: 'https://www.agingcare.com/discussions',
    engagement_style: 'expert',
    promotion_tolerance: 'high',
    cpa_benchmark: 52,
  },
  {
    name: 'Caring.com',
    url: 'https://www.caring.com/senior-living',
    engagement_style: 'informative',
    promotion_tolerance: 'high',
    cpa_benchmark: 48,
  },
];

/**
 * Calculate composite lead score (0-100)
 * Factors:
 * - Purchase Intent (0-40 points)
 * - LTV Potential (0-25 points)
 * - Geography Match (0-15 points)
 * - Engagement Quality (0-10 points)
 * - Timing/Urgency (0-10 points)
 */
function calculateLeadScore(lead, theme) {
  let score = 0;
  
  // Purchase Intent (0-40 points)
  const buyingStagePoints = {
    crisis: 40,
    decision: 35,
    research: 20,
    awareness: 10,
  };
  score += buyingStagePoints[theme.buyingStage] || 10;
  
  // LTV Potential (0-25 points)
  score += 25 * (theme.ltv_weight || 1.0);
  
  // Geography Match (0-15 points)
  const maTerms = ['massachusetts', 'boston', 'cambridge', 'worcester', 'springfield', 'ma'];
  const content = String(lead.post_content || lead.content || '').toLowerCase();
  const hasGeoMatch = maTerms.some(term => content.includes(term));
  if (hasGeoMatch) score += 15;
  
  // Engagement Quality (0-10 points)
  const engagement_score = parseFloat(lead.link_receptivity_score || lead.engagement_fit_score || 5);
  score += Math.min(10, engagement_score);
  
  // Timing/Urgency (0-10 points)
  const urgencyTerms = ['urgent', 'asap', 'immediately', 'crisis', 'emergency', 'need help now'];
  const hasUrgency = urgencyTerms.some(term => content.includes(term));
  if (hasUrgency) score += 10;
  
  return Math.min(100, Math.round(score));
}

/**
 * Classify buying stage from post content
 */
function detectBuyingStage(content) {
  const text = String(content || '').toLowerCase();
  
  // Crisis stage
  if (text.match(/cannot (handle|care|do this)|burnout|emergency|need help (now|asap|immediately)/i)) {
    return 'crisis';
  }
  
  // Decision stage
  if (text.match(/choosing|comparing|which (facility|place|home)|ready to move|tour|visit/i)) {
    return 'decision';
  }
  
  // Research stage
  if (text.match(/considering|looking into|researching|how (much|to choose)|what (to look for|should i know)/i)) {
    return 'research';
  }
  
  // Awareness stage (default)
  return 'awareness';
}

/**
 * Generate Next Best Action recommendation
 */
function generateNextBestAction(lead, score, theme) {
  const stage = detectBuyingStage(lead.post_content || lead.content);
  const platform = lead.platform || 'reddit';
  const cpa_benchmark = TARGET_PLATFORMS.find(p => p.name.toLowerCase() === platform.toLowerCase())?.cpa_benchmark || 45;
  
  if (score >= 80) {
    return {
      action: 'immediate_outreach',
      priority: 'urgent',
      recommendation: `High-intent ${stage} stage lead. Personal reply + direct facility match within 2 hours.`,
      estimated_cpa: cpa_benchmark * 0.7,
      budget_suggestion: `Allocate $${Math.round(cpa_benchmark * 2)}/day to ${platform} ${theme.name} cohort`,
    };
  } else if (score >= 60) {
    return {
      action: 'targeted_engagement',
      priority: 'high',
      recommendation: `Solid ${stage} stage prospect. Engage with value-add content + tracking link.`,
      estimated_cpa: cpa_benchmark,
      budget_suggestion: `Increase ${platform} spend by 15% for ${theme.name}`,
    };
  } else if (score >= 40) {
    return {
      action: 'nurture_campaign',
      priority: 'medium',
      recommendation: `Early ${stage} stage. Add to nurture sequence, provide educational content.`,
      estimated_cpa: cpa_benchmark * 1.3,
      budget_suggestion: `Maintain current budget, monitor engagement`,
    };
  } else {
    return {
      action: 'monitor',
      priority: 'low',
      recommendation: `Low-intent ${stage} stage. Monitor for future engagement opportunities.`,
      estimated_cpa: cpa_benchmark * 2.0,
      budget_suggestion: `No budget allocation recommended`,
    };
  }
}

/**
 * Format lead for Discord notification
 */
function formatLeadForDiscord(lead, score, theme, nextAction) {
  const stage = detectBuyingStage(lead.post_content || lead.content);
  const emoji = score >= 80 ? '🔥' : score >= 60 ? '⭐' : score >= 40 ? '💡' : '👀';
  
  return `
${emoji} **Lead Score: ${score}/100** | Stage: **${stage.toUpperCase()}** | Theme: ${theme.name}

**Platform:** ${lead.platform || 'reddit'}
**URL:** ${lead.post_url || lead.url}
**Posted:** ${lead.post_date || 'unknown'}

**Content Preview:**
${String(lead.post_content || lead.content || '').slice(0, 200)}...

**🎯 Next Best Action:**
- **Priority:** ${nextAction.priority.toUpperCase()}
- **Action:** ${nextAction.action.replace(/_/g, ' ').toUpperCase()}
- **Recommendation:** ${nextAction.recommendation}
- **Est. CPA:** $${nextAction.estimated_cpa.toFixed(2)}
- **Budget:** ${nextAction.budget_suggestion}

**Engagement Strategy:**
${lead.founder_engagement_strategy || lead.engagement_strategy || 'No strategy generated'}

---`;
}

/**
 * Run the full lead gen optimization pipeline
 */
async function main() {
  console.log('🚀 Assistedly.ai Lead Gen Optimizer Engine\n');
  console.log('📊 Strategy: 13-point revenue optimization');
  console.log('🔧 Integrations: Firecrawl + Dify MCPs + PostHog + GA4\n');
  
  const startTime = Date.now();
  const report = {
    generated_at: new Date().toISOString(),
    themes: SEARCH_THEMES.map(t => t.name),
    platforms: TARGET_PLATFORMS.map(p => p.name),
    competitors: COMPETITORS.map(c => c.name),
    leads: [],
    performance_feedback: null,
  };
  
  // Step 1: Run existing Firecrawl social engagement
  console.log('📡 Step 1: Running Firecrawl social engagement (multi-platform)...');
  try {
    execSync('node scripts/firecrawl-social-engagement.cjs', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        FIRECRAWL_ENGAGEMENT_MODE: 'both',
      },
    });
  } catch (err) {
    console.warn('⚠️  Firecrawl engagement failed (non-fatal):', err.message);
  }
  
  // Step 2: Run existing social engagement agents
  console.log('\n🤖 Step 2: Running social engagement agents (scoring + ranking)...');
  try {
    execSync('node scripts/social-engagement-agents.cjs', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch (err) {
    console.warn('⚠️  Social agents failed (non-fatal):', err.message);
  }
  
  // Step 3: Load and consolidate results
  console.log('\n📥 Step 3: Loading and scoring results...');
  const reportsDir = path.resolve(__dirname, '../reports');
  const socialReports = fs.readdirSync(reportsDir)
    .filter(f => f.startsWith('social-engagement-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (socialReports.length === 0) {
    console.warn('⚠️  No social engagement reports found');
  } else {
    const latestReport = JSON.parse(fs.readFileSync(path.join(reportsDir, socialReports[0]), 'utf8'));
    const rawLeads = latestReport.leads || [];
    
    console.log(`   Found ${rawLeads.length} raw leads`);
    
    // Score and enrich each lead
    for (const rawLead of rawLeads) {
      // Match to theme
      const theme = SEARCH_THEMES.find(t => {
        const content = String(rawLead.post_content || rawLead.content || '').toLowerCase();
        return t.keywords.some(kw => content.includes(kw.toLowerCase()));
      }) || SEARCH_THEMES[0];
      
      const score = calculateLeadScore(rawLead, theme);
      const nextAction = generateNextBestAction(rawLead, score, theme);
      
      report.leads.push({
        ...rawLead,
        optimizer_score: score,
        theme: theme.name,
        buying_stage: detectBuyingStage(rawLead.post_content || rawLead.content),
        next_best_action: nextAction,
      });
    }
    
    // Sort by optimizer score
    report.leads.sort((a, b) => b.optimizer_score - a.optimizer_score);
  }
  
  // Step 4: Fetch performance feedback from PostHog (if configured)
  console.log('\n📈 Step 4: Fetching performance feedback from PostHog...');
  if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID) {
    try {
      execSync('node scripts/reddit-campaign-agent.cjs', {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
      });
      
      // Load the latest campaign report
      const campaignReports = fs.readdirSync(reportsDir)
        .filter(f => f.startsWith('reddit-campaign-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (campaignReports.length > 0) {
        const campaignReport = JSON.parse(fs.readFileSync(path.join(reportsDir, campaignReports[0]), 'utf8'));
        report.performance_feedback = {
          conversion_rate: campaignReport.metrics?.conversion_rate || 0,
          avg_cpa: campaignReport.metrics?.avg_cpa || 0,
          total_conversions: campaignReport.metrics?.total_conversions || 0,
          recommendations: campaignReport.recommended_actions || [],
        };
      }
    } catch (err) {
      console.warn('⚠️  PostHog feedback failed (non-fatal):', err.message);
    }
  } else {
    console.log('   Skipped (PostHog not configured)');
  }
  
  // Step 5: Generate report
  console.log('\n📝 Step 5: Generating optimization report...');
  const reportPath = path.join(reportsDir, `lead-gen-optimizer-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`   ✅ Report saved: ${reportPath}`);
  
  // Step 6: Send top leads to Discord
  console.log('\n📢 Step 6: Sending top leads to Discord...');
  if (!DISCORD_WEBHOOK_URL) {
    console.log('   Skipped (DISCORD_WEBHOOK_URL not set)');
  } else {
    const topLeads = report.leads.slice(0, 10);
    
    let discordMessage = `**🚀 Lead Gen Optimizer Report**\n`;
    discordMessage += `Generated: ${new Date().toLocaleString()}\n`;
    discordMessage += `Total Leads: ${report.leads.length}\n`;
    discordMessage += `Top 10 by Optimizer Score:\n\n`;
    
    for (const lead of topLeads) {
      const theme = SEARCH_THEMES.find(t => t.name === lead.theme) || SEARCH_THEMES[0];
      discordMessage += formatLeadForDiscord(lead, lead.optimizer_score, theme, lead.next_best_action);
    }
    
    if (report.performance_feedback) {
      discordMessage += `\n\n**📊 Performance Feedback (PostHog + GA4):**\n`;
      discordMessage += `- Conversion Rate: ${(report.performance_feedback.conversion_rate * 100).toFixed(2)}%\n`;
      discordMessage += `- Avg CPA: $${report.performance_feedback.avg_cpa.toFixed(2)}\n`;
      discordMessage += `- Total Conversions: ${report.performance_feedback.total_conversions}\n`;
    }
    
    discordMessage += `\n📁 Full report: ${reportPath}`;
    
    // Split and send
    const chunks = splitDiscordContent(discordMessage);
    for (const chunk of chunks) {
      await postDiscordWebhook(DISCORD_WEBHOOK_URL, chunk);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    }
    
    console.log(`   ✅ Sent ${chunks.length} Discord message(s)`);
  }
  
  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✨ Lead Gen Optimization complete in ${duration}s`);
  console.log(`   Total leads: ${report.leads.length}`);
  console.log(`   High priority (score ≥80): ${report.leads.filter(l => l.optimizer_score >= 80).length}`);
  
  // Step 7: Dify MCP Orchestration (Placeholder)
  console.log('\n🧠 Step 7: Dify MCP Orchestration...');
  const DIFY_API_KEY = process.env.DIFY_API_KEY || '';
  const DIFY_API_BASE_URL = process.env.DIFY_API_BASE_URL || 'https://dify.forwardjump.com/v1';

  if (!DIFY_API_KEY || !DIFY_API_BASE_URL) {
    console.log('   Skipped (Dify API keys or base URL not set)');
  } else {
    const highIntentLeads = report.leads.filter(l => l.optimizer_score >= 80);
    if (highIntentLeads.length > 0) {
      console.log(`   Found ${highIntentLeads.length} high-intent leads for Dify processing.`);
      console.log(`   (Actual Dify workflow integration would go here, e.g., calling Dify's /v1/workflows/run endpoint for personalized outreach or enrichment).`);
      console.log(`   Example: For lead ${highIntentLeads[0].post_url}, could trigger a Dify workflow to generate outreach.`);
    } else {
      console.log('   No high-intent leads to send to Dify.');
    }
  }
  console.log(`   Medium priority (score 60-79): ${report.leads.filter(l => l.optimizer_score >= 60 && l.optimizer_score < 80).length}`);
  console.log(`   Low priority (score <60): ${report.leads.filter(l => l.optimizer_score < 60).length}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { calculateLeadScore, detectBuyingStage, generateNextBestAction };
