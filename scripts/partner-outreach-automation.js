#!/usr/bin/env node
/**
 * Partner Outreach Automation — Headless Browser Chat & Form Outreach
 *
 * Usage:
 *   npm install playwright
 *   node scripts/partner-outreach-automation.js --dry-run
 *   node scripts/partner-outreach-automation.js --targets gogograndparent,aloecare
 *   node scripts/partner-outreach-automation.js --vector form --message-file ./custom-message.txt
 *
 * --targets: comma-separated list of company slugs to run outreach for
 * --dry-run: log what would happen without sending messages
 * --vector: "chat" or "form" (default: chat)
 * --message-file: path to custom message file
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION — Partner Targets with Agentic Vectors
// ═══════════════════════════════════════════════════════════════

const PARTNER_TARGETS = [
  {
    slug: 'gogograndparent',
    name: 'GoGoGrandparent',
    url: 'https://gogograndparent.com',
    chatType: 'crisp',
    websiteId: 'b3c3ceb9-78c2-4e48-b2b8-24bdb0ead741',
    fallbackVectors: ['impact-affiliate', 'email-subscription'],
    localTimezone: 'America/Los_Angeles',
    businessHours: { start: 9, end: 17 },
  },
  {
    slug: 'herohealth',
    name: 'Hero Health',
    url: 'https://herohealth.com',
    chatType: 'intercom',
    fallbackVectors: ['sales-demo-form'],
    localTimezone: 'America/New_York',
    businessHours: { start: 9, end: 18 },
  },
  {
    slug: 'aloecare',
    name: 'Aloe Care Health',
    url: 'https://aloecare.com',
    chatType: 'webflow-form',
    formAction: '/contact',
    fallbackVectors: ['zendesk-submit-request'],
    localTimezone: 'America/New_York',
    businessHours: { start: 9, end: 17 },
  },
  {
    slug: 'medicalguardian',
    name: 'Medical Guardian',
    url: 'https://www.medicalguardian.com',
    chatType: 'olark',
    fallbackVectors: ['phone', 'request-brochure-form'],
    localTimezone: 'America/New_York',
    businessHours: { start: 8, end: 20 },
  },
  {
    slug: 'bayalarmmedical',
    name: 'Bay Alarm Medical',
    url: 'https://www.bayalarmmedical.com',
    chatType: 'crisp',
    fallbackVectors: ['phone'],
    localTimezone: 'America/Los_Angeles',
    businessHours: { start: 8, end: 17 },
  },
  {
    slug: 'unaliwear',
    name: 'UnaliWear',
    url: 'https://unaliwear.com',
    chatType: 'zoho-salesiq',
    fallbackVectors: ['phone'],
    localTimezone: 'America/Chicago',
    businessHours: { start: 9, end: 17 },
  },
];

// ═══════════════════════════════════════════════════════════════
// OUTREACH MESSAGE TEMPLATES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_MESSAGE_HEAD = `Hi there,

I'm Josh Fialkoff, founder of Assistedly.ai. We help families navigate care transitions with independent, data-backed guidance — no commission-driven referrals, just transparent information.`;

const DEFAULT_MESSAGE_BODY = `We partner with companies that help older adults remain at home. When a family's needs evolve beyond what home safety alone can address, we give them an independent way to understand what comes next.

We'd love to explore whether a partnership with {{COMPANY}} makes sense. Our model is:
• Your product serves families at home
• When care needs change, you offer a trusted, co-branded resource (Assistedly)
• Families get independent care-navigation; you stay relevant as needs evolve
• Transparent economics, subject to legal review and pilot results

Would someone from partnerships be open to a 15-minute call this week or next?

Best,
Josh Fialkoff
Founder, Assistedly.ai
josh@assistedly.ai`;

const DEFAULT_MESSAGE = `${DEFAULT_MESSAGE_HEAD}\n\n${DEFAULT_MESSAGE_BODY}`;

// ─── Response capture + orchestrator trigger ─────────────────────
const RESPONSE_LOG = path.resolve(__dirname, '../docs/partner-pilot/responses/outreach-response-log.jsonl');

function ensureResponseDir() {
  const dir = path.dirname(RESPONSE_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendResponseLog(entry) {
  ensureResponseDir();
  fs.appendFileSync(RESPONSE_LOG, JSON.stringify(entry) + '\n');
}

function classifyResponse(text) {
  const lower = (text || '').toLowerCase();
  const positiveSignals = ['interested', 'partnership', 'call', 'schedule', 'email me', 'send', ' proposal', 'deck', 'learn more', 'book', 'meeting', 'talk', 'connect', 'reach out', 'follow up'];
  const negativeSignals = ['not interested', 'no thanks', 'unsubscribe', 'remove', 'spam', 'do not contact', 'wrong person'];
  
  const posHits = positiveSignals.filter(s => lower.includes(s)).length;
  const negHits = negativeSignals.filter(s => lower.includes(s)).length;
  
  if (negHits > 0) return { sentiment: 'negative', confidence: 'high', score: -1 };
  if (posHits >= 2) return { sentiment: 'positive', confidence: 'high', score: posHits };
  if (posHits === 1) return { sentiment: 'positive', confidence: 'medium', score: posHits };
  return { sentiment: 'unknown', confidence: 'low', score: 0 };
}

async function captureChatReply(page, target, waitMs = 120000) {
  log(`[${target.name}] Waiting up to ${waitMs/1000}s for agent reply...`);
  const start = Date.now();
  let lastScreenshot = null;
  
  while (Date.now() - start < waitMs) {
    await delay(8000);
    
    // Scrape common chat widget reply selectors
    const replies = await page.evaluate(() => {
      const selectors = [
        '.crisp-client .messages .message[bubble] .text',
        '.crisp-client [data-area="message"] .text',
        '.intercom-conversation .intercom-block-paragraph',
        '.intercom-conversation .intercom-message-body',
        '.olark-chat-message .olark-message-text',
        '.zsiq_msgtxt', '.zsiq_flt_rel .zsiq_msgtxt',
        '[class*="chat-message"] p',
        '[class*="message-content"]',
        '[class*="bubble"]',
      ];
      const texts = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          const txt = el.innerText?.trim();
          if (txt && txt.length > 5) texts.push(txt);
        });
      }
      return [...new Set(texts)];
    });
    
    if (replies.length > 0) {
      const combined = replies.join('\n');
      const classification = classifyResponse(combined);
      lastScreenshot = path.join(process.cwd(), `outreach-reply-${target.slug}-${Date.now()}.png`);
      await page.screenshot({ path: lastScreenshot, fullPage: false });
      
      const entry = {
        ts: new Date().toISOString(),
        target: target.slug,
        name: target.name,
        chatType: target.chatType,
        outreachText: message,
        replies,
        classification,
        screenshot: lastScreenshot,
      };
      appendResponseLog(entry);
      log(`[${target.name}] Reply captured. Sentiment=${classification.sentiment} confidence=${classification.confidence}`);
      return entry;
    }
  }
  
  log(`[${target.name}] No reply detected within ${waitMs/1000}s.`);
  const entry = {
    ts: new Date().toISOString(),
    target: target.slug,
    name: target.name,
    chatType: target.chatType,
    outreachText: message,
    replies: [],
    classification: { sentiment: 'no_reply', confidence: 'low', score: 0 },
    screenshot: null,
  };
  appendResponseLog(entry);
  return entry;
}

async function triggerOrchestratorIfPositive(entry) {
  if (!AUTO_TRIGGER) {
    log(`[TRIGGER] Positive response detected for ${entry.target}, but --auto-trigger not set. Re-run with --auto-trigger to launch orchestrator.`);
    return;
  }
  if (entry.classification.sentiment !== 'positive') return;
  const { execSync } = require('child_process');
  const reply = (entry.replies || []).join('\\n').replace(/"/g, '\\"').substring(0, 1200);
  const outreach = (entry.outreachText || '').replace(/"/g, '\\"').substring(0, 1200);
  const cmd = [
    'node', `"${path.resolve(__dirname, 'partner-pilot-orchestrator.js')}"`,
    `--partner=${entry.target}`,
    `--source=${entry.chatType || 'chatbot'}`,
    `--confidence=${entry.classification.confidence}`,
    reply ? `--reply="${reply}"` : '',
    outreach ? `--outreach-text="${outreach}"` : '',
    '--activate',
  ].filter(Boolean).join(' ');
  log(`[TRIGGER] Positive response detected! Running: ${cmd}`);
  try {
    execSync(cmd, { cwd: PROJECT_ROOT, stdio: 'inherit' });
  } catch (err) {
    log(`[TRIGGER] Orchestrator failed: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// ARGUMENT PARSING
// ═══════════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

const flags = parseArgs();
const DRY_RUN = flags['dry-run'] || false;
const VECTOR = flags['vector'] || 'chat';
const TARGET_SLUGS = flags['targets'] ? flags['targets'].split(',').map(s => s.trim()) : null;
const MESSAGE_FILE = flags['message-file'] || null;
const AUTO_TRIGGER = flags['auto-trigger'] || false;

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function loadMessage() {
  if (MESSAGE_FILE && fs.existsSync(MESSAGE_FILE)) {
    return fs.readFileSync(MESSAGE_FILE, 'utf-8');
  }
  return DEFAULT_MESSAGE;
}

function buildMessageFor(target) {
  const template = loadMessage();
  return template.replace(/\{\{COMPANY\}\}/g, target.name);
}

function isBusinessHours(target) {
  const tz = target.localTimezone || 'America/New_York';
  const now = new Date().toLocaleString('en-US', { timeZone: tz, hour12: false });
  const hour = parseInt(now.split(',')[1].split(':')[0].trim(), 10);
  return hour >= target.businessHours.start && hour < target.businessHours.end;
}

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════
// CHAT AUTOMATION ENGINES
// ═══════════════════════════════════════════════════════════════

async function automateCrisp(page, target, message) {
  log(`[${target.name}] Injecting Crisp chat...`);
  
  await page.evaluate(({ websiteId, msg }) => {
    window.CRISP_WEBSITE_ID = websiteId;
    window.$crisp = window.$crisp || [];
    
    // If Crisp is already loaded, use it
    if (window.$crisp && typeof window.$crisp.push === 'function') {
      window.$crisp.push(['do', 'chat:open']);
      setTimeout(() => {
        window.$crisp.push(['do', 'message:send', ['text', msg]]);
      }, 800);
      return 'immediate';
    }
    
    // Otherwise, wait for Crisp to load
    window.CRISP_READY_TRIGGER = function() {
      window.$crisp.push(['do', 'chat:open']);
      setTimeout(() => {
        window.$crisp.push(['do', 'message:send', ['text', msg]]);
      }, 800);
    };
    return 'trigger';
  }, { websiteId: target.websiteId, msg: message });
  
  // Wait longer if Crisp script needs to load
  await delay(5000);
  log(`[${target.name}] Crisp message sent (or queued).`);
}

async function automateIntercom(page, target, message) {
  log(`[${target.name}] Injecting Intercom message...`);
  
  const sent = await page.evaluate((msg) => {
    if (window.Intercom) {
      Intercom('showNewMessage', msg);
      return true;
    }
    return false;
  }, message);
  
  if (!sent) {
    // Try to find and trigger Intercom launcher
    await page.evaluate((msg) => {
      const launcher = document.querySelector('#intercom-container, .intercom-launcher, [class*="intercom"]');
      if (launcher) launcher.click();
      // Fallback: scroll for Intercom to load
      setTimeout(() => {
        if (window.Intercom) Intercom('showNewMessage', msg);
      }, 3000);
    }, message);
  }
  
  await delay(5000);
  log(`[${target.name}] Intercom message sent.`);
}

async function automateOlark(page, target, message) {
  log(`[${target.name}] Attempting Olark chat...`);
  
  await page.evaluate((msg) => {
    if (window.olark) {
      olark('api.box.expand');
      setTimeout(() => {
        const textareas = document.querySelectorAll('textarea, [class*="olark-text"], [class*="message"]');
        for (const ta of textareas) {
          ta.value = msg;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
      }, 2000);
    }
  }, message);
  
  await delay(5000);
  log(`[${target.name}] Olark message attempted.`);
}

async function automateZohoSalesIQ(page, target, message) {
  log(`[${target.name}] Attempting Zoho SalesIQ chat...`);
  
  await page.evaluate((msg) => {
    if (window.$zoho && window.$zoho.salesiq) {
      window.$zoho.salesiq.visitor.show();
      setTimeout(() => {
        const inputs = document.querySelectorAll('textarea, [id*="salesiq"] textarea, .zsiq_flt_rel textarea, .zsiq_msginput');
        for (const inp of inputs) {
          inp.value = msg;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          const form = inp.closest('form');
          if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
        }
      }, 2000);
    }
  }, message);
  
  await delay(5000);
  log(`[${target.name}] Zoho SalesIQ message attempted.`);
}

async function automateWebflowForm(page, target, message) {
  log(`[${target.name}] Attempting Webflow form submission...`);
  
  const contactUrl = target.url + (target.formAction || '/contact');
  await page.goto(contactUrl, { waitUntil: 'networkidle' });
  await delay(3000);
  
  // Fill out form fields
  await page.evaluate(({ msg, name }) => {
    const setVal = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    
    setVal('[name="Name-2"], [name="Name"], [name="name"]', 'Josh Fialkoff');
    setVal('[name="Email-4"], [name="Email"], [name="email"], [type="email"]', 'josh@assistedly.ai');
    setVal('[name="Phone-2"], [name="Phone"], [name="phone"], [type="tel"]', '617-555-0100');
    setVal('[name="Message-2"], [name="Message"], [name="message"], textarea', msg);
    
    // Check consent checkbox
    const consent = document.querySelector('[name="Consent-2"], [name="Consent"], [type="checkbox"]');
    if (consent && !consent.checked) consent.click();
    
    // Submit
    setTimeout(() => {
      const submitBtn = document.querySelector('input[type="submit"], button[type="submit"], .w-button');
      if (submitBtn) submitBtn.click();
    }, 500);
  }, { msg: message, name: target.name });
  
  await delay(5000);
  log(`[${target.name}] Webflow form submitted.`);
}

// ═══════════════════════════════════════════════════════════════
// MAIN RUNNER
// ═══════════════════════════════════════════════════════════════

async function runOutreach(targets) {
  let browser;
  try {
    browser = await chromium.launch({ 
      headless: true,
      // Use stealth args to avoid detection
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ]
    });
    
    for (const target of targets) {
      log(`\n=== Starting outreach to ${target.name} ===`);
      
      if (!isBusinessHours(target)) {
        log(`[${target.name}] SKIPPED: Outside business hours (${target.localTimezone}).`);
        continue;
      }
      
      const message = buildMessageFor(target);
      
      if (DRY_RUN) {
        log(`[DRY-RUN] Would send to ${target.name} via ${target.chatType}:`);
        log(message.substring(0, 200) + '...');
        continue;
      }
      
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        viewport: { width: 1440, height: 900 },
        locale: 'en-US',
        timezoneId: target.localTimezone,
      });
      
      const page = await context.newPage();
      
      // Bypass Webdriver detection
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      });
      
      try {
        if (!target.chatType || VECTOR === 'form') {
          // Default to form if chat not configured
          await automateWebflowForm(page, target, message);
        } else {
          await page.goto(target.url, { waitUntil: 'networkidle' });
          await delay(3000); // Let chat widgets load
          
          switch (target.chatType) {
            case 'crisp':
              await automateCrisp(page, target, message);
              break;
            case 'intercom':
              await automateIntercom(page, target, message);
              break;
            case 'olark':
              await automateOlark(page, target, message);
              break;
            case 'zoho-salesiq':
              await automateZohoSalesIQ(page, target, message);
              break;
            case 'webflow-form':
              await automateWebflowForm(page, target, message);
              break;
            default:
              log(`[${target.name}] Unknown chat type: ${target.chatType}`);
          }
        }
        
        // Capture reply if in chat mode (skip for form-only)
        let responseEntry = null;
        if (target.chatType && target.chatType !== 'webflow-form' && VECTOR !== 'form') {
          responseEntry = await captureChatReply(page, target);
          if (responseEntry && responseEntry.classification.sentiment === 'positive') {
            await triggerOrchestratorIfPositive(responseEntry);
          }
        }
        
        // Screenshot for audit trail
        const screenshotPath = path.join(process.cwd(), `outreach-${target.slug}-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        log(`[${target.name}] Screenshot saved: ${screenshotPath}`);
        
      } catch (err) {
        log(`[${target.name}] ERROR:`, err.message);
      } finally {
        await context.close();
      }
      
      // Rate limiting: 15s delay between targets
      log(`[${target.name}] Waiting 15s before next target...`);
      await delay(15000);
    }
    
  } finally {
    if (browser) await browser.close();
  }
  
  log('\n=== Outreach automation complete ===');
}

// ═══════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════

(async () => {
  let targets = PARTNER_TARGETS;
  
  if (TARGET_SLUGS) {
    targets = PARTNER_TARGETS.filter(t => TARGET_SLUGS.includes(t.slug));
    if (targets.length === 0) {
      console.error('No targets matched. Available:', PARTNER_TARGETS.map(t => t.slug).join(', '));
      process.exit(1);
    }
  }
  
  if (targets.length === 0) {
    console.log('No targets specified. Use --targets to select companies.');
    console.log('Available:', PARTNER_TARGETS.map(t => `${t.slug} (${t.name})`).join(', '));
    process.exit(0);
  }
  
  log('Partner Outreach Automation');
  log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);
  log(`Vector: ${VECTOR}`);
  log(`Targets: ${targets.map(t => t.name).join(', ')}`);
  log('─'.repeat(60));
  
  await runOutreach(targets);
})();
