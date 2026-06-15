import { extractAnswerFromDifySseText } from './difySse'
import { normalizeDifyApiBaseUrl, resolveDifyServiceUrls } from './difyEndpoints'
import { formatTownLabel } from './massachusettsRouteUtils'
import { lookupFacilityByTitle } from './wizardFacilityInsights'

const DEFAULT_DIFY_BASE_URL = 'https://dify.forwardjump.com/v1'
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 300
const NO_INSIGHT_RE = /^no standout comparative fact found/i

const METRO_BOSTON_TOWNS = new Set([
  'arlington',
  'boston',
  'brookline',
  'cambridge',
  'dedham',
  'lexington',
  'malden',
  'medford',
  'needham',
  'newton',
  'quincy',
  'revere',
  'somerville',
  'waltham',
  'wellesley',
  'winchester',
])

const GREATER_WORCESTER_TOWNS = new Set(['worcester', 'shrewsbury', 'holden', 'grafton'])

const insightCache = new Map()

function cacheKey({ facilityName, careType, location, metroArea }) {
  return [facilityName, careType, location, metroArea].map((part) => String(part || '').trim().toLowerCase()).join('::')
}

function readCache(key) {
  const hit = insightCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    insightCache.delete(key)
    return null
  }
  return hit.value
}

function writeCache(key, value) {
  if (insightCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = insightCache.keys().next().value
    if (oldestKey) insightCache.delete(oldestKey)
  }
  insightCache.set(key, { at: Date.now(), value })
}

export function inferMetroArea({ town = '', location = '', zipCode = '' } = {}) {
  const haystack = `${town} ${location} ${zipCode}`.toLowerCase()
  if ([...METRO_BOSTON_TOWNS].some((name) => haystack.includes(name))) {
    return 'Metro Boston'
  }
  if ([...GREATER_WORCESTER_TOWNS].some((name) => haystack.includes(name))) {
    return 'Greater Worcester'
  }
  return 'Massachusetts'
}

export function normalizeCareTypeLabel(careType = '') {
  const value = String(careType || '').trim().toLowerCase()
  if (value === 'memory') return 'Memory Care'
  if (value === 'skilled') return 'Skilled Nursing'
  if (value === 'assisted') return 'Assisted Living'
  return value || 'Assisted Living'
}

export function sanitizeKbInsightText(text) {
  const cleaned = String(text || '')
    .replace(/^[\s\-*•]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned || NO_INSIGHT_RE.test(cleaned)) return ''
  return cleaned
}

function buildInsightQuery({ facilityName, careTypeLabel, location, metroArea }) {
  return [
    `Facility: ${facilityName}`,
    `Care type focus: ${careTypeLabel}`,
    `Location: ${location}`,
    `Metro / region: ${metroArea}`,
    'Return one standout comparative fact from the knowledge base for this facility.',
  ].join('\n')
}

function resolveDifyConfig() {
  const apiKey = String(process.env.FACILITY_KB_INSIGHT_DIFY_API_KEY || '').trim()
  const baseUrl = normalizeDifyApiBaseUrl(
    process.env.FACILITY_KB_INSIGHT_DIFY_BASE_URL || DEFAULT_DIFY_BASE_URL,
  )
  const { chatMessages } = resolveDifyServiceUrls(baseUrl)
  return { apiKey, chatMessagesUrl: chatMessages }
}

async function parseDifyBlockingResponse(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  const raw = await response.text()

  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(raw)
      if (typeof json?.answer === 'string') return json.answer
      if (typeof json?.data?.outputs?.text === 'string') return json.data.outputs.text
    } catch {
      // fall through to SSE parser
    }
  }

  return extractAnswerFromDifySseText(raw).answer
}

export async function fetchFacilityKbInsight({
  facilityName,
  slug = '',
  careType = '',
  location = '',
  zipCode = '',
  town = '',
} = {}) {
  const name = String(facilityName || '').trim()
  if (!name) {
    return { configured: true, insight: '', error: 'facility_name_required' }
  }

  const facility = lookupFacilityByTitle(name)
  const resolvedTown = town || facility?.town || ''
  const resolvedLocation =
    String(location || '').trim() ||
    (resolvedTown ? `${formatTownLabel(resolvedTown)}, MA` : 'Massachusetts')
  const careTypeLabel = normalizeCareTypeLabel(careType || facility?.careTypes?.[0] || '')
  const metroArea = inferMetroArea({
    town: resolvedTown,
    location: resolvedLocation,
    zipCode,
  })

  const key = cacheKey({
    facilityName: name,
    careType: careTypeLabel,
    location: resolvedLocation,
    metroArea,
  })
  const cached = readCache(key)
  if (cached != null) {
    return { configured: true, insight: cached, cached: true, metroArea }
  }

  const { apiKey, chatMessagesUrl } = resolveDifyConfig()
  if (!apiKey) {
    return { configured: false, insight: '' }
  }

  const user = `facility-kb-insight-${slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  let upstream
  try {
    upstream = await fetch(chatMessagesUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          facility_name: name,
          care_type: careTypeLabel,
          Location: resolvedLocation,
          metro_area: metroArea,
        },
        query: buildInsightQuery({
          facilityName: name,
          careTypeLabel,
          location: resolvedLocation,
          metroArea,
        }),
        response_mode: 'blocking',
        user,
      }),
      signal: AbortSignal.timeout(25000),
    })
  } catch (err) {
    console.error('facility-kb-insight fetch error', err)
    return { configured: true, insight: '', error: 'upstream_unreachable' }
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => upstream.statusText)
    console.error('facility-kb-insight upstream error', upstream.status, errText)
    return { configured: true, insight: '', error: 'upstream_error' }
  }

  const answer = sanitizeKbInsightText(await parseDifyBlockingResponse(upstream))
  writeCache(key, answer)
  return { configured: true, insight: answer, metroArea }
}
