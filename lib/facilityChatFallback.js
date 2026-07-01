/**
 * Facility fallback utilities for the Dify chat response pipeline.
 *
 * These functions provide a native fallback in case the Dify response doesn't
 * include a structured Top 3 facility match list.
 */

/**
 * Check whether text already contains a Top-3 facility match list
 * (numbered items with Memory care and Why sections).
 */
export function replyIncludesTop3Matches(text) {
  if (!text || typeof text !== 'string') return false
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return false

  // Look for numbered items (1) 2) 3)) that mention Memory care
  const items = [...normalized.matchAll(/(?:^|\n)\s*(\d+)\)\s+/g)]
  if (items.length < 2) return false

  // Count items that mention "Memory care"
  let memoryCareCount = 0
  for (let i = 0; i < items.length; i++) {
    const start = items[i].index + items[i][0].length
    const end = i + 1 < items.length ? items[i + 1].index : normalized.length
    const block = normalized.slice(start, end)
    if (/memory\s*care/i.test(block)) memoryCareCount++
  }

  return memoryCareCount >= 2
}

/**
 * Build a complete native Top 3 facility reply from the query and inputs.
 * Returns null if not enough data is available (falls through to LLM/Dify).
 */
export function buildCompleteNativeTop3Reply(query, inputs) {
  // Native facility data lookup is not yet implemented.
  // When the Dify response already has the right format, we skip this.
  return null
}

/**
 * Build a minimal local fallback when the Dify/LLM response is empty.
 * Returns null by default (the caller uses a generic fallback string).
 */
export function buildLocalFacilityChatFallback(query, inputs) {
  return null
}

/**
 * Build facility retrieval context from the query and inputs.
 * Used by nativeFastTop3Chat.js for retrieval-augmented generation.
 */
export function buildFacilityRetrievalContext(query, inputs, topK = 5) {
  // Not yet implemented — returns empty context so the system prompt is
  // still generated without facility data.
  return ''
}
