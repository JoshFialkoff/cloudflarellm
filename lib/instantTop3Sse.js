/**
 * Instant Top-3 SSE streaming for local facility data.
 *
 * Searches the local Massachusetts facilities database and builds
 * Dify-compatible SSE `node_finished` / `knowledge-retrieval` event chunks.
 *
 * These are written to the HTTP response BEFORE the Dify stream starts,
 * giving users immediate facility data while waiting for the LLM refinement.
 *
 * The client-side `consumeDifySseLines` parses the events via the
 * `onKbRetrieval` / `onKbFacilities` handlers — no client changes needed.
 */

import { MASSACHUSETTS_FACILITIES } from './massachusettsFacilities'

const MAX_INSTANT_FACILITIES = 3

export function titleCaseTown(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  return normalized.replace(/\b([a-z])/g, (match) => match.toUpperCase())
}

/**
 * Simple keyword-based facility search over the local database.
 * Extracts location and care-type keywords from the query string.
 */
export function searchLocalFacilities(query, extraInputs = {}) {
  if (!Array.isArray(MASSACHUSETTS_FACILITIES) || MASSACHUSETTS_FACILITIES.length === 0) {
    return []
  }

  const q = String(query || '').toLowerCase().trim()
  const location = String(extraInputs?.Location || '').toLowerCase().trim()
  const careType = String(extraInputs?.care_type || extraInputs?.careType || '').toLowerCase().trim()
  const budget = Number(extraInputs?.monthly_budget) || 0

  // Extract town names from query
  const townKeywords = location
    ? [location]
    : (q.match(/\b(boston|cambridge|somerville|brookline|newton|lexington|concord|sudbury|framingham|worcester|springfield|wellesley|needham|dedham|quincy|waltham|marlborough|natick|andover|lowell|lawrence|lynn|salem|gloucester|beverly|peabody|medford|malden|everett|revere|chelsea|winthrop|arlington|belmont|watertown|woburn|reading|stoneham|melrose|wakefield|saugus|swampscott|marblehead|lynnfield|north reading|wilmington|burlington|bedford|lincoln|weston|wayland|sherborn|dover|medfield|millis|norwood|westwood|walpole|foxborough|sharon|stoughton|canton|milton|randolph|holbrook|avon|bridgewater|easton|mansfield|norton|taunton|raynham|rehoboth|seekonk|swansea|somerset|fall river|new bedford|dartmouth|freetown|lakeville|middleborough|wareham|plymouth|kingston|duxbury|marshfield|scituate|cohasset|hull|hingham|weymouth|braintree|abington|whitman|hanover|norwell|rockland|halifax|hanson|pembroke|carver)\b/gi) || [])


  // Extract care type keywords
  const careKeywords = careType
    ? [careType]
    : (q.match(/\b(assisted living|memory care|dementia|alzheimer|skilled nursing|independent living|respite|hospice)\b/gi) || [])


  // Score each facility
  const scored = MASSACHUSETTS_FACILITIES.map(facility => {
    let score = 0
    const town = String(facility.town || '').toLowerCase()
    const name = String(facility.name || '').toLowerCase()
    const careTypes = (facility.careTypes || []).map(c => c.toLowerCase())

    // Town/location match (highest weight)
    for (const kw of townKeywords) {
      if (town.includes(kw) || kw.includes(town)) score += 10
      if (name.includes(kw)) score += 5
    }

    // Care type match
    for (const kw of careKeywords) {
      for (const ct of careTypes) {
        if (ct.includes(kw) || kw.includes(ct)) score += 8
      }
    }

    // Budget match
    if (budget > 0) {
      if (facility.monthlyMin <= budget && facility.monthlyMax <= budget) {
        score += 6
      } else if (facility.monthlyMin <= budget) {
        score += 3
      } else {
        score -= 2
      }
    }

    // Rating bonus
    score += (facility.rating || 0) * 2

    return { facility, score }
  })

  const matched = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INSTANT_FACILITIES)
    .map(s => s.facility)

  return matched
}

/**
 * Build a Dify-compatible knowledge-retrieval `node_finished` result entry
 * from a local facility record.
 */
function facilityToKbResultEntry(facility) {
  const town = titleCaseTown(facility.town)
  const fullTitle = facility.town
    ? `${facility.name} — ${town}`
    : facility.name

  return {
    metadata: {
      _source: 'local',
      dataset_id: 'instant-top-3-local',
      dataset_name: 'Massachusetts Facilities (Local)',
      document_id: `local-${facility.id}`,
      document_name: `${facility.name}.pdf`,
      segment_id: `local-seg-${facility.id}`,
      retriever_from: 'workflow',
      score: 0,
      segment_hit_count: 1,
      segment_word_count: 500,
    },
    title: fullTitle,
    content: [
      `Residence Name: ${facility.name}`,
      `Address: ${facility.address}`,
      `Rating: ${facility.rating}/5.0`,
      `Compliance: ${facility.complianceRating || 'N/A'}`,
      `Care Types: ${(facility.careTypes || []).join(', ')}`,
      `Monthly Cost: $${(facility.monthlyMin || 0).toLocaleString()} – $${(facility.monthlyMax || 0).toLocaleString()}`,
      `Capacity: ${facility.capacity || 'N/A'} residents`,
      `Amenities: ${(facility.amenities || []).map(a => a.name).join(', ')}`,
      facility.about || '',
    ].join('\n'),
    summary: `${facility.name} in ${town || 'Massachusetts'} — ${facility.rating}/5 stars, ${facility.complianceRating || 'N/A'} compliance. ${(facility.careTypes || []).join(', ')}. $${(facility.monthlyMin || 0).toLocaleString()}–$${(facility.monthlyMax || 0).toLocaleString()}/month.`,
    files: null,
  }
}

/**
 * Build instant Top-3 facility data as Dify-compatible SSE event chunks.
 *
 * Returns an array of raw SSE strings that should be written to the response
 * AFTER the SSE headers are set but BEFORE the main Dify stream starts.
 *
 * Returns an empty array if no local facilities matched.
 */
export function buildInstantTop3SseChunks(query, inputs) {
  const facilities = searchLocalFacilities(query, inputs)
  if (facilities.length === 0) return []

  const result = facilities.map(facilityToKbResultEntry)

  const payload = {
    event: 'node_finished',
    conversation_id: '',
    data: {
      id: `local-instant-kb-${Date.now()}`,
      node_id: 'local-knowledge-retrieval',
      node_type: 'knowledge-retrieval',
      title: 'Knowledge Retrieval',
      index: 0,
      outputs: { result },
      status: 'succeeded',
      error: null,
      elapsed_time: 0,
      created_at: Date.now(),
      finished_at: Date.now(),
    },
  }

  return [`data: ${JSON.stringify(payload)}\n\n`]
}

/**
 * Legacy API — kept for compatibility with nativeFastTop3Chat.js.
 * Writes instant facility data SSE directly to res (headers must already be set).
 */
export function streamInstantTop3ToSse(res, query, inputs) {
  const chunks = buildInstantTop3SseChunks(query, inputs)
  if (chunks.length === 0) return 0

  for (const chunk of chunks) {
    try {
      res.write(chunk)
      if (typeof res.flush === 'function') res.flush()
    } catch {
      return 0
    }
  }
  return chunks.length
}
