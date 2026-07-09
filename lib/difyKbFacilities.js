const MAX_MATCHES = 3

function isPlaceholderText(value) {
  const text = String(value || '').trim()
  if (!text) return true
  return (
    /\[.*(facility|town|third).*\]/i.test(text) ||
    /<[^>]+>/.test(text) ||
    /third facility name|town name/i.test(text)
  )
}

function slugToTitle(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function townFromContent(content) {
  const residence = content.match(/Residence Name:\s*[^\r\n]+\r?\nAddress:\s*[^\r\n]+\r?\n\s*([^,\r\n]+),\s*MA\b/i)
  if (residence?.[1]) return residence[1].trim()
  const address = content.match(/\b([A-Za-z .'-]+),\s*MA\s+\d{5}\b/)
  return address?.[1]?.trim() || ''
}

function townFromProfileUrl(content) {
  const match = content.match(/us\/ma\/([^/]+)\/profile/i)
  return match?.[1] ? slugToTitle(match[1]) : ''
}

function facilityNameFromContent(content) {
  const residence = content.match(/Residence Name:\s*([^\r\n]+)/i)
  if (residence?.[1]) return residence[1].trim()
  const profile = content.match(/profile\/assisted-living-facilities\/([^/"'\s]+)/i)
  if (profile?.[1]) return slugToTitle(profile[1])
  return ''
}

function memoryCareFromContent(content) {
  if (/alzheimers_certification\.is_certified["']:\s*["']True/i.test(content)) return 'Yes'
  if (/Special Care Units:\s*0/i.test(content) && /memory care/i.test(content)) return 'Unknown'
  if (/memory care|dementia|alzheimer/i.test(content)) return 'Yes'
  return 'Unknown'
}

function sanitizeFacilityName(name) {
  return String(name || '')
    .replace(/\s*PDF\s+v\.\s*[\d\-]+_LR[^\s]*/gi, '')
    .replace(/\s*—\s*$/g, '')
    .trim()
}

function parseKbSegment(segment) {
  const rawDoc = String(segment?.metadata?.document_name || segment?.title || '').trim()
  const content = String(segment?.content || '')
  if (!rawDoc && !content) return null

  const isSpreadsheet = /\.(xlsx|csv)$/i.test(rawDoc) || /consolidated/i.test(rawDoc)
  let facilityName = ''

  if (isSpreadsheet) {
    facilityName = facilityNameFromContent(content)
  } else {
    facilityName = rawDoc.replace(/\.(pdf|xlsx|csv)$/i, '').trim()
  }

  facilityName = sanitizeFacilityName(facilityName)

  if (!facilityName || isPlaceholderText(facilityName)) return null

  let town = townFromContent(content) || townFromProfileUrl(content)
  if (!town) {
    const ofMatch = facilityName.match(/^(.+?)\s+of\s+(.+)$/i)
    if (ofMatch) town = ofMatch[2].trim()
  }

  const title = town ? `${facilityName} — ${town}` : facilityName
  if (isPlaceholderText(title)) return null

  return {
    title,
    memoryCare: memoryCareFromContent(content),
    why: '',
    kbSource: true,
    documentName: rawDoc || facilityName,
  }
}

/** Top matches from Dify knowledge-retrieval node `outputs.result` (not LLM text). */
export function facilitiesFromKbRetrievalResult(result) {
  const items = []
  const seen = new Set()

  for (const segment of result || []) {
    const item = parseKbSegment(segment)
    if (!item) continue
    const key = item.documentName.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
    if (items.length >= MAX_MATCHES) break
  }

  return items
}

export { isPlaceholderText as isPlaceholderFacilityTitle }
