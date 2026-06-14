const MAX_MATCHES = 3

const INTRO_PATTERNS = [
  /Based on your goal[\s\S]*?(?:here are your best options|best options)[:\s]*/i,
  /Here are the (?:best|strongest|top)[\s\S]*?:\s*/i,
  /(?:^|[\n\r])(?:here are your best options|are your best options)[:\s]*/i,
]

function stripHtml(text) {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\*\*/g, '')
}

function normalizeNumberedListBody(body) {
  return String(body || '')
    .replace(/(?:^|\n)(\d+)\s*\n+(?=[A-Za-z])/g, '\n$1. ')
    .replace(/(?:^|\n)(\d+)\)\s*\n+(?=[A-Za-z])/g, '\n$1) ')
}

function extractAssistantIntro(text) {
  for (const pattern of INTRO_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[0]) return match[0].trim()
  }
  const firstItem = text.search(/(?:^|\n)\s*\d+(?:[.)]|\s*\n)/)
  if (firstItem <= 0) return ''
  return text
    .slice(0, firstItem)
    .replace(/\s*Top\s+\d+\s+matches:?\s*$/i, '')
    .trim()
}

function stripAssistantIntro(text) {
  let stripped = text
  for (const pattern of INTRO_PATTERNS) {
    stripped = stripped.replace(pattern, '')
  }
  return stripped.trim()
}

function parseMatchBlock(block) {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const title = (lines[0] ?? block).trim()
  let memoryCare
  let why

  for (const line of lines.slice(1)) {
    const memoryMatch = line.match(/^(?:\d+[.)]\s*|-\s*|•\s*)?(?:\*\*)?Memory care:(?:\*\*)?\s*(.+)$/i)
    const whyMatch = line.match(/^(?:\d+[.)]\s*|-\s*|•\s*)?(?:\*\*)?Why:(?:\*\*)?\s*(.+)$/i)
    if (memoryMatch) memoryCare = memoryMatch[1].trim()
    if (whyMatch) why = whyMatch[1].trim()
  }

  if (!memoryCare && !why) {
    const inline = block.match(/^(.*?)\s+-\s+Memory care:\s*(.*?)(?:\s+-\s+Why:\s*(.*))?$/is)
    if (inline) {
      return {
        title: inline[1].trim(),
        memoryCare: inline[2]?.trim(),
        why: inline[3]?.trim(),
      }
    }
    const sentence = block.match(/^(.*?)[.\s]+Memory care:\s*(.*?)(?:[.\s]+Why:\s*(.*))?\.?\s*$/is)
    if (sentence) {
      return {
        title: sentence[1].trim(),
        memoryCare: sentence[2]?.trim(),
        why: sentence[3]?.trim(),
      }
    }
  }

  return { title, memoryCare, why }
}

function parseUnnumberedAssistantMatches(body) {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const items = []
  const seen = new Set()

  for (let index = 0; index < lines.length; index += 1) {
    if (/^\d+$/.test(lines[index])) continue
    const header = lines[index].match(/^(.+?)\s*[—–-]\s*(.+)$/)
    if (!header) continue
    const title = `${header[1].trim()} — ${header[2].trim()}`
    const dedupeKey = title.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    let memoryCare
    let why
    for (let look = index + 1; look < Math.min(index + 4, lines.length); look += 1) {
      if (/^\d+$/.test(lines[look])) break
      const memoryMatch = lines[look].match(/^[-•\s]*memory care:\s*(.+)$/i)
      const whyMatch = lines[look].match(/^[-•\s]*why:\s*(.+)$/i)
      if (memoryMatch) memoryCare = memoryMatch[1].trim()
      if (whyMatch) why = whyMatch[1].trim()
      if (/^.+[—–-].+$/.test(lines[look])) break
    }
    items.push({ title, memoryCare, why })
  }

  return items.slice(0, MAX_MATCHES)
}

export function looksLikeTop3AssistantReply(text) {
  const normalized = stripHtml(text).replace(/\r\n/g, '\n')
  return (
    /best options|top\s+\d+\s+matches|memory care:/i.test(normalized) ||
    /(?:^|\n)\s*\d+(?:[.)]|\s*\n)/m.test(normalized)
  )
}

export function parseAssistantMatches(text) {
  const normalized = stripHtml(text).replace(/\r\n/g, '\n').trim()
  if (!normalized) return null

  const intro = extractAssistantIntro(normalized)
  const body = normalizeNumberedListBody(stripAssistantIntro(normalized))
  const itemStarts = [...body.matchAll(/(?:^|\n)\s*(\d+)[.)]\s+/g)]
  let items = []

  if (itemStarts.length > 0) {
    const limitedStarts = itemStarts.slice(0, MAX_MATCHES)
    items = limitedStarts
      .map((match, index) => {
        const contentStart = match.index + match[0].length
        const nextStart = itemStarts[index + 1]
        const contentEnd = nextStart ? nextStart.index : body.length
        return parseMatchBlock(body.slice(contentStart, contentEnd))
      })
      .map((item) => ({ ...item, title: item.title.trim() }))
      .filter((item) => item.title && !/^\d+$/.test(item.title))
  } else {
    items = parseUnnumberedAssistantMatches(body)
  }

  if (items.length === 0) return null
  return { intro, items }
}

export { MAX_MATCHES as WIZARD_PARSE_MAX_MATCHES }
