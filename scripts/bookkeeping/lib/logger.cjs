/**
 * Structured action logger for the Bookkeeping Agent.
 */
const { appendFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const LOG_DIR = join(__dirname, '..', 'logs');
try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}
function _logFileName() { const d=new Date(); const dateStr=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`; return join(LOG_DIR,`bookkeeping-${dateStr}.jsonl`); }
function log(entry) { const record={ts:new Date().toISOString(),agent:'bookkeeping-agent',...entry}; const line=JSON.stringify(record); console.log(line); try{appendFileSync(_logFileName(),line+'\n');}catch{} }
function buildExceptionReport(entries) { if(!entries||entries.length===0) return 'No exceptions. ✅'; const lines=['## Bookkeeping Exception Report',`Generated: ${new Date().toISOString()}`,`Total exceptions: ${entries.length}\n`]; for(const e of entries){ lines.push(`- [${e.ts}] ${e.action?.toUpperCase()||'UNKNOWN'}`); lines.push(`  Message: ${e.message}`); if(e.meta) lines.push(`  Meta: ${JSON.stringify(e.meta)}`); lines.push(''); } return lines.join('\n'); }
module.exports={log,buildExceptionReport};
