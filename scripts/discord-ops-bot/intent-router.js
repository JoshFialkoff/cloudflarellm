const { summarizeHealth } = require('./health-parser')
const { knowledgeAnswer } = require('./knowledge-base')

function normalize(text) { return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() }

function isHealthQuery(text) {
  const n = normalize(text)
  const keywords = ['racknerd','server','health','status','alert','warn','load','disk','ram','memory','reboot','action','attention','problem','issue']
  return keywords.some(k => n.includes(k))
}

function isActionQuery(text) {
  const n = normalize(text)
  const phrases = ['action','need to do','should i','need to take','anything to do','any action','next step','recommended']
  return phrases.some(p => n.includes(p))
}

function isInventoryQuery(text) {
  const n = normalize(text)
  return n.includes('inventory') || n.includes('list server') || n.includes('what servers') || n.includes('how many server')
}

function isGreeting(text) { return /^(hi|hello|hey|yo|good morning|good afternoon|good evening)/.test(normalize(text)) }

function isKnowledgeQuery(text) {
  const n = normalize(text)
  // If it's not server-related, treat it as a knowledge question
  if (isHealthQuery(text) || isActionQuery(text) || isInventoryQuery(text)) return false
  return true
}

function number(n) { return n == null ? '—' : typeof n === 'number' ? n.toFixed(1) : String(n) }

function healthSummary() {
  const { alerts, warns, ok, count, timestamp, error } = summarizeHealth()
  if (error) return { type: 'text', content: '⚠️ ' + error }
  const lines = ['**Racknerd server health** (' + count + ' servers, latest: ' + (timestamp || 'unknown') + ')', '']
  if (alerts.length) { lines.push('🚨 **ALERTS**'); for (const s of alerts) { lines.push('• **' + s.ip + '** ' + s.hostname + (s.role ? ' — ' + s.role : '') + ' — load ' + number(s.load) + ' — disk ' + number(s.diskPct) + '%') } lines.push('') }
  if (warns.length) { lines.push('⚠️ **WARNINGS**'); for (const s of warns) { lines.push('• **' + s.ip + '** ' + s.hostname + (s.role ? ' — ' + s.role : '') + ' — load ' + number(s.load) + ' — disk ' + number(s.diskPct) + '%') } lines.push('') }
  lines.push('✅ **OK**: ' + ok.length + ' server(s)')
  return { type: 'text', content: lines.join('\n') }
}

function actionSummary() {
  const { alerts, warns, count, timestamp, error } = summarizeHealth()
  if (error) return { type: 'text', content: '⚠️ ' + error }
  const lines = ['**Recommended actions**', '']
  if (!alerts.length && !warns.length) { lines.push('✅ All servers look healthy. No action required right now.'); return { type: 'text', content: lines.join('\n') } }
  if (alerts.length) { lines.push('🚨 **Immediate attention:**'); for (const s of alerts) { const actions = []; if (s.diskPct != null && s.diskPct >= 90) actions.push('investigate disk usage urgently'); else if (s.diskPct != null && s.diskPct >= 80) actions.push('clean up disk soon'); if (s.load != null && s.load > 3) actions.push('check high load / runaway processes'); if (s.availMB != null && s.availMB < 500) actions.push('free up memory'); lines.push('• **' + s.ip + '** ' + s.hostname + ': ' + (actions.join('; ') || 'review manually')) } lines.push('') }
  if (warns.length) { lines.push('⚠️ **Soon:**'); for (const s of warns) { const actions = []; if (s.diskPct != null && s.diskPct >= 80) actions.push('clean up disk'); if (s.load != null && s.load > 2) actions.push('investigate load'); if (s.availMB != null && s.availMB < 1000) actions.push('monitor memory'); lines.push('• **' + s.ip + '** ' + s.hostname + ': ' + (actions.join('; ') || 'monitor')) } lines.push('') }
  lines.push('Run **npm run ops:discord** to post a detailed report to your ops channel.')
  return { type: 'text', content: lines.join('\n') }
}

function inventorySummary() {
  const INVENTORY = require('../ops/server-inventory.json')
  const lines = ['**Server inventory**', '']
  for (const s of INVENTORY.servers || []) { lines.push('• **' + s.id + '** ' + (s.hostname || '') + (s.role ? ' — ' + s.role : '')) }
  lines.push('', 'Keystash user: **' + (INVENTORY.keystashUsername || '—') + '**')
  return { type: 'text', content: lines.join('\n') }
}

function helpText() {
  return { type: 'text', content: ['**Ops bot — what I can answer**', '', '• **Server health** — How are the Racknerd servers?', '• **Actions needed** — Do I need to take any action?', '• **Inventory** — List all servers', '• **Deploy** — How does the Cloudflare deploy work?', '• **Code search** — "Where is the intake wizard?" / "How does Dify chat work?"', '', 'Ask me anything about your Racknerd infrastructure, this codebase, or Dify.'].join('\n') }
}

function route(text) {
  if (isGreeting(text) && text.length < 30) return { type: 'text', content: '👋 Hey! Ask me about your Racknerd servers, this codebase, or Dify.' }
  if (isInventoryQuery(text)) return inventorySummary()
  if (isActionQuery(text)) return actionSummary()
  if (isHealthQuery(text)) return healthSummary()
  if (isKnowledgeQuery(text)) return knowledgeAnswer(text)
  return helpText()
}

module.exports = { route, isHealthQuery, isActionQuery, isInventoryQuery, isKnowledgeQuery }
