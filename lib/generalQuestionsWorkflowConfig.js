/**
 * Runtime config mirrored from dify/general-questions-ma.dsl.yml.
 * Used by native /api/ask-chat so it can serve general MA assisted-living
 * questions without blocking on Dify knowledge-retrieval + reranking latency.
 */

import { buildFacilityRetrievalContext } from './facilityChatFallback'

export const GENERAL_QUESTIONS_LLM = {
  temperature: 0.15,
  top_p: 0.9,
  max_tokens: 650,
  defaultModel: 'qwen2.5:7b',
}

const FACILITY_NAME_RE = /\b([A-Z][A-Za-z0-9 '&]+(?:of|at|in)\s+[A-Z][a-z]+|[A-Z][A-Za-z0-9 '&]{3,}(?:\s+(?:Assisted\s+Living|Memory\s+Care|Senior\s+Living|Rehabilitation))?)\b/g

function extractFacilityNames(query) {
  const text = String(query || '')
  const matches = text.match(FACILITY_NAME_RE) || []
  const unique = [...new Set(matches.map(m => m.trim()).filter(m => m.length > 3))]
  return unique.slice(0, 2)
}

function hasFacilityIntent(query) {
  const q = String(query || '').toLowerCase()
  return /\b(facility|facilities|community|communities|residence|residences|nursing home|assisted living|memory care)\b/.test(q)
}

/**
 * Build retrieval context from local MA facility data when the query
 * mentions a specific facility or clearly asks for facility comparisons.
 */
export function composeGeneralQuestionsContext(query) {
  const facilityNames = extractFacilityNames(query)
  const useRetrieval = facilityNames.length > 0 || hasFacilityIntent(query)

  if (!useRetrieval) {
    return { context: '', sourcesCount: 0 }
  }

  const retrievalContext = buildFacilityRetrievalContext(query, {}, 3)
  return {
    context: retrievalContext,
    sourcesCount: retrievalContext ? 3 : 0,
  }
}

export function buildGeneralQuestionsSystemPrompt({ context = '' } = {}) {
  const contextBlock = context
    ? `\nUse the following proprietary Massachusetts facility data to answer:\n${context}\n`
    : ''

  return `You are an expert in Massachusetts assisted living.${contextBlock}
Answer questions in an honest, straightforward manner. If you don't know, say you don't know.

Rules:
- No follow-up questions.
- No chain-of-thought. Never show thinking text.
- Answer in 1-2 sentences, easy-to-read paragraph format. If using bullets, use one sentence max per bullet. NEVER answer in more than 3 paragraphs.
- Always cite 1 relevant figure from Massachusetts facility data when available.

Format examples:
- [Sunrise of Arlington] has the most staff per resident of any memory care unit in Metro Boston.
- [The Gables at Winchester] shows the lowest deficiency count among comparable facilities in Winchester.`
}
