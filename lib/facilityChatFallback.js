/**
 * Facility fallback utilities for the Dify chat response pipeline.
 *
 * These functions provide a native fallback in case the Dify response doesn't
 * include a structured Top 3 facility match list.
 */

import { searchLocalFacilities, titleCaseTown } from './instantTop3Sse'

function formatCurrency(amount) {
  return `$${Math.round(amount || 0).toLocaleString('en-US')}`
}

function normalizeCareTypeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'memory') return 'Memory Care'
  if (normalized === 'skilled') return 'Skilled Nursing'
  if (normalized === 'assisted') return 'Assisted Living'
  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : ''
}

function facilityMatchesCareType(facility, careTypeLabel) {
  if (!careTypeLabel) return false
  return (facility.careTypes || []).some((entry) => String(entry).toLowerCase().includes(careTypeLabel.toLowerCase()))
}

function buildWhyLine(facility, inputs) {
  const reasons = []
  const careTypeLabel = normalizeCareTypeLabel(inputs?.care_type || inputs?.careType)
  const budget = Number(inputs?.monthly_budget) || 0

  if (careTypeLabel && facilityMatchesCareType(facility, careTypeLabel)) {
    reasons.push(`offers ${careTypeLabel.toLowerCase()}`)
  }

  if (budget > 0) {
    if ((facility.monthlyMax || 0) <= budget) {
      reasons.push('fits within the stated budget')
    } else if ((facility.monthlyMin || 0) <= budget) {
      reasons.push('starts near the stated budget')
    }
  }

  if (facility.complianceRating) {
    reasons.push(`${facility.complianceRating.toLowerCase()} compliance history`)
  }

  if (facility.rating) {
    reasons.push(`${facility.rating}/5 rating`)
  }

  return reasons.slice(0, 3).join(', ')
}

/**
 * Check whether text already contains a Top-3 facility match list
 * (numbered items with Memory care and Why sections).
 */
export function replyIncludesTop3Matches(text) {
  if (!text || typeof text !== 'string') return false
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return false
  if (/cannot provide a third option|need additional information|not enough information/i.test(normalized)) {
    return false
  }
  const items = [...normalized.matchAll(/(?:^|\n)\s*(\d+)[\).]\s+/g)]
  return items.length >= 3
}

/**
 * Build a complete native Top 3 facility reply from the query and inputs.
 * Returns null if not enough data is available (falls through to LLM/Dify).
 */
export function buildCompleteNativeTop3Reply(query, inputs) {
  const facilities = searchLocalFacilities(query, inputs)
  if (!facilities.length) return null

  const location = String(inputs?.Location || '').trim() || 'Massachusetts'
  const careTypeLabel = normalizeCareTypeLabel(inputs?.care_type || inputs?.careType) || 'senior living'
  const budget = Number(inputs?.monthly_budget) || 0
  const intro = [
    [
      "Here are instant results from my proprietary database. I'm updating this now to make sure I give you the best options",
      `for ${careTypeLabel.toLowerCase()} options near ${location}`,
      budget > 0 ? `with a target budget of ${formatCurrency(budget)} per month.` : '.',
    ].join(' '),
  ]
    .filter(Boolean)
    .join(' ')

  const body = facilities.slice(0, 3).map((facility, index) => {
    const townLabel = titleCaseTown(facility.town)
    const town = townLabel ? ` — ${townLabel}` : ''
    const why = buildWhyLine(facility, inputs)
    const amenities = (facility.amenities || [])
      .slice(0, 3)
      .map((item) => item.name)
      .join(', ')

    return [
      `${index + 1}) ${facility.name}${town}`,
      `Care types: ${(facility.careTypes || []).join(', ')}`,
      `Monthly cost: ${formatCurrency(facility.monthlyMin)}–${formatCurrency(facility.monthlyMax)}`,
      `Why it may fit: ${why || 'strong local match based on care needs, budget, and location'}.`,
      amenities ? `Notable amenities: ${amenities}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [intro, ...body].join('\n\n').trim()
}

/**
 * Build a minimal local fallback when the Dify/LLM response is empty.
 * Returns null by default (the caller uses a generic fallback string).
 */
export function buildLocalFacilityChatFallback(query, inputs) {
  return buildCompleteNativeTop3Reply(query, inputs)
}

/**
 * Build facility retrieval context from the query and inputs.
 * Used by nativeFastTop3Chat.js for retrieval-augmented generation.
 */
export function buildFacilityRetrievalContext(query, inputs, topK = 5) {
  const facilities = searchLocalFacilities(query, inputs).slice(0, topK)
  if (!facilities.length) return ''
  return facilities
    .map(
      (facility, index) =>
        `${index + 1}. ${facility.name} (${titleCaseTown(facility.town)}) — ${facility.rating}/5, ${
          facility.complianceRating || 'N/A'
        } compliance, ${(facility.careTypes || []).join(', ')}, ${formatCurrency(
          facility.monthlyMin
        )}-${formatCurrency(facility.monthlyMax)}/month.`,
    )
    .join('\n')
}
