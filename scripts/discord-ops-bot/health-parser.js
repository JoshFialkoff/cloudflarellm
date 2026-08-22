const fs = require('fs')
const path = require('path')
const INVENTORY = require('../ops/server-inventory.json')

function findLogFiles() {
  const candidates = []
  const dirs = [
    path.join(__dirname, '../..'),
    path.join(__dirname, '../../monitoring-fallback'),
  ]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (/^(racknerd-)?health-.*\.log$/.test(f)) {
        candidates.push({ file: f, dir, mtime: fs.statSync(path.join(dir, f)).mtimeMs })
      }
    }
  }
  return candidates.sort((a, b) => b.mtime - a.mtime)
}

function parseLine(line) {
  const m1 = line.match(
    /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\d+\.\d+\.\d+\.\d+)\s+(\S+)\s+(OK|WARN|ALERT)(?:\s+load=([\d.]+))?(?:\s+ram=([\d.]+)([KMGT]?))?(?:\s+swap=([\d.]+)([KMGT]?))?(?:\s+disk=([\d.]+)%)?/
  )
  if (m1) {
    const ramMB = m1[6] ? parseFloat(m1[5]) * (m1[6] === 'K' ? 1/1024 : m1[6] === 'M' ? 1 : m1[6] === 'G' ? 1024 : 1) : null
    const swapMB = m1[8] ? parseFloat(m1[7]) * (m1[8] === 'K' ? 1/1024 : m1[8] === 'M' ? 1 : m1[8] === 'G' ? 1024 : 1) : null
    return {
      timestamp: m1[1], ip: m1[2], hostname: m1[3], status: m1[4],
      load: m1[5] ? parseFloat(m1[5]) : null,
      ramMB, swapMB,
      diskPct: m1[9] ? parseFloat(m1[9]) : null,
    }
  }
  const m2 = line.match(
    /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\d+\.\d+\.\d+\.\d+)\s+hostname=(\S+)\s+load5m=([\d.]+)\s+avail_MB=([\d.]+)\s+swap_used_MB=([\d.]+)\s+disk_used=([\d.]+)%/
  )
  if (m2) {
    const load = parseFloat(m2[4])
    const availMB = parseFloat(m2[5])
    const diskPct = parseFloat(m2[7])
    let status = 'OK'
    if (diskPct >= 90 || availMB < 500) status = 'ALERT'
    else if (diskPct >= 80 || availMB < 1000 || load > 3) status = 'WARN'
    return {
      timestamp: m2[1], ip: m2[2], hostname: m2[3], status,
      load, availMB, swapUsedMB: parseFloat(m2[6]), diskPct,
    }
  }
  return null
}

function getLatestSnapshot() {
  const files = findLogFiles()
  if (!files.length) return null
  const rows = []
  for (const { dir, file } of files.slice(0, 2)) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8')
    for (const line of text.split('\n')) {
      const parsed = parseLine(line.trim())
      if (parsed) rows.push({ ...parsed, sourceFile: file })
    }
  }
  const byIp = new Map()
  for (const row of rows) {
    const existing = byIp.get(row.ip)
    if (!existing || row.timestamp > existing.timestamp) byIp.set(row.ip, row)
  }
  return Array.from(byIp.values()).sort((a, b) => a.ip.localeCompare(b.ip))
}

function getInventoryMeta() {
  const byIp = new Map()
  for (const s of INVENTORY.servers || []) {
    byIp.set(s.id, s)
    if (s.hostname) byIp.set(s.hostname, s)
  }
  return byIp
}

function summarizeHealth() {
  const snaps = getLatestSnapshot()
  if (!snaps) return { error: 'No health logs found.' }
  const meta = getInventoryMeta()
  const alerts = []; const warns = []; const ok = []
  for (const s of snaps) {
    const m = meta.get(s.ip) || meta.get(s.hostname) || {}
    const enriched = { ...s, role: m.role || '', notes: m.notes || '' }
    if (s.status === 'ALERT') alerts.push(enriched)
    else if (s.status === 'WARN') warns.push(enriched)
    else ok.push(enriched)
  }
  return { alerts, warns, ok, count: snaps.length, timestamp: snaps[0]?.timestamp }
}

module.exports = { getLatestSnapshot, summarizeHealth, getInventoryMeta }
