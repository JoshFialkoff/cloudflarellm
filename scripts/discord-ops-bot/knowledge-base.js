const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.join(__dirname, '../..')

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
}

function grepRepo(pattern, maxFiles = 8) {
  try {
    const cmd = `cd "${ROOT}" && rg -l --type-add 'web:*.{js,jsx,ts,tsx,mjs,cjs,json,md}' -tweb '${pattern}' . 2>/dev/null | head -${maxFiles}`
    const out = execSync(cmd, { encoding: 'utf8', timeout: 5000 })
    return out.trim().split('\n').filter(Boolean)
  } catch {
    try {
      const cmd = `cd "${ROOT}" && grep -rlE '${pattern}' --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.cjs' --include='*.json' --include='*.md' . 2>/dev/null | head -${maxFiles}`
      const out = execSync(cmd, { encoding: 'utf8', timeout: 8000 })
      return out.trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }
}

function grepSnippet(filePath, pattern) {
  try {
    const fullPath = path.join(ROOT, filePath.replace(/^\.\//, ''))
    if (!fs.existsSync(fullPath)) return null
    const content = fs.readFileSync(fullPath, 'utf8')
    const lines = content.split('\n')
    const hits = []
    const re = new RegExp(pattern, 'i')
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const start = Math.max(0, i - 1)
        const end = Math.min(lines.length, i + 2)
        hits.push(lines.slice(start, end).join('\n'))
        if (hits.length >= 3) break
      }
    }
    return hits.length ? hits.join('\n') : null
  } catch {
    return null
  }
}

function searchCodebase(query) {
  const keywords = tokenize(query).filter(w => w.length > 2)
  if (!keywords.length) return null
  const pattern = keywords.join('|')
  const files = grepRepo(pattern, 8)
  if (!files.length) return null

  const lines = ['**Relevant files**', '']
  for (const f of files) {
    const rel = f.replace(/^\.\//, '')
    lines.push(`• **${rel}**`)
    const snippet = grepSnippet(rel, keywords[0])
    if (snippet) {
      lines.push('```')
      lines.push(snippet.slice(0, 600))
      lines.push('```')
    }
  }
  return lines.join('\n')
}

function isAnalyticsDataQuestion(query) {
  const n = query.toLowerCase()
  const patterns = ['best lead', 'top lead', 'lead source', 'conversion rate', 'best performing', 'best channel', 'which source', 'what source', 'attribution', 'funnel performance', 'how many users', 'how many leads']
  return patterns.some(p => n.includes(p))
}

function isDeploymentQuestion(query) {
  const n = query.toLowerCase()
  return n.includes('deploy') || n.includes('wrangler') || n.includes('cloudflare') || n.includes('build') || n.includes('release')
}

function isDifyQuestion(query) {
  const n = query.toLowerCase()
  return n.includes('dify') || n.includes('chatbot') || n.includes('chat api') || n.includes('ask page') || n.includes('chat flow') || n.includes('ai assistant')
}

function isAuthQuestion(query) {
  const n = query.toLowerCase()
  return n.includes('auth') || n.includes('login') || n.includes('session') || n.includes('clerk') || n.includes('password') || n.includes('signup')
}

function isAnalyticsCodeQuestion(query) {
  const n = query.toLowerCase()
  return n.includes('track') || n.includes('posthog') || n.includes('ga4') || n.includes('gtag') || n.includes('event') || n.includes('analytic')
}

function analyticsDataAnswer() {
  return {
    type: 'text',
    content: [
      'This is a **data question** — I search the codebase, but I can not query live PostHog/GA4.',
      '',
      '**Where the data lives:**',
      '• **PostHog** → Insights → Trends → Event: `chat_message_sent` or `intake_complete` → Breakdown by: `lead_source`',
      '• **GA4** → Reports → Conversions → Event: `chat_start` or `intake_complete` → Dimension: `lead_source`',
      '',
      '**How lead_source is derived** (`lib/chatAnalytics.js`):',
      '```js',
      'lead_source = bot_surface + "_" + assistant_mode',
      '// e.g. homepage_assistedly_wizard',
      '```',
      '',
      'If you want me to query PostHog by API, give me a `POSTHOG_API_KEY` and I can add live analytics.',
    ].join('\n')
  }
}

function deploymentAnswer() {
  return {
    type: 'text',
    content: [
      '**Deploy (Cloudflare Worker)**',
      '',
      '```bash',
      'npm ci && npm run build',
      'npx wrangler deploy --config wrangler-slot4.toml',
      '```',
      '• Must pass: `node scripts/guard-critical-features.mjs`',
      '• Must pass: `node scripts/guard-no-second-header.mjs`',
      '• Config: `wrangler-slot4.toml` (name=assistedly-slot4)',
      '',
      'See `AGENTS.md` for the full checklist.',
    ].join('\n')
  }
}

function difyAnswer() {
  return {
    type: 'text',
    content: [
      '**Dify in this project**',
      '',
      '• `lib/difyClient.js` — Dify API client (streaming + non-streaming)',
      '• `pages/api/chat.js` & `pages/api/ask-chat.js` — Next.js API routes that proxy to Dify',
      '• `pages/ask/` — React chat UI rendered in the app',
      '• `lib/chatAnalytics.js` — PostHog + GA4 tracking around chat events',
      '',
      'Ask a specific question and I will grep the repo for code.',
    ].join('\n')
  }
}

function authAnswer() {
  return {
    type: 'text',
    content: [
      '**Auth in this project**',
      '',
      '• `pages/api/auth/` — API auth routes',
      '• `lib/auth/` — Shared auth utilities',
      '• `middleware.ts` — Route protection middleware',
      '',
      'Ask a specific question and I will grep the repo for code.',
    ].join('\n')
  }
}

function analyticsCodeAnswer() {
  return {
    type: 'text',
    content: [
      '**Analytics stack**',
      '',
      '• PostHog → `lib/posthogClient.js`',
      '• GA4 bridge → `lib/gtag.js` (`pushGevent`, `pushGconversion`)',
      '• GTM container: `GTM-5MZDBQ5P`',
      '• GA4 ID: `G-V5XFEZ9J0P`',
      '',
      'Trackers: `lib/authAnalytics.js`, `lib/chatAnalytics.js`, `lib/intakeAnalytics.js`',
      '',
      'For data questions ("best lead source"), check PostHog/GA4 dashboards — I can not query live analytics yet.',
    ].join('\n')
  }
}

function knowledgeAnswer(query) {
  if (isAnalyticsDataQuestion(query)) return analyticsDataAnswer()
  if (isDeploymentQuestion(query)) return deploymentAnswer()
  if (isDifyQuestion(query)) return difyAnswer()
  if (isAuthQuestion(query)) return authAnswer()
  if (isAnalyticsCodeQuestion(query)) return analyticsCodeAnswer()

  const result = searchCodebase(query)
  if (result) {
    return { type: 'text', content: result }
  }

  return {
    type: 'text',
    content: [
      'I did not find an exact match. Try asking about:',
      '• Server health / Racknerd status',
      '• Dify chat / API setup',
      '• Deploy / wrangler / build',
      '• Auth / signup / sessions',
      '• Analytics / PostHog / GA4',
      '• Code search: "Where is intake wizard?" / "How does auth work?"',
      '',
      'Or be more specific.',
    ].join('\n')
  }
}

module.exports = { knowledgeAnswer, searchCodebase }
