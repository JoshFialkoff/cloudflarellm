/**
 * Guided intake match scoring.
 *
 * scoreFacility(facility, intake) → { score, breakdown, tags, explanation }
 * rankFacilities(facilities, intake) → [{ facility, score, breakdown, tags, explanation, rank }, ...]
 *
 * Score is 0–100. Facilities with score < MINIMUM_DISPLAY_SCORE are excluded from ranked output.
 */

import { BUDGET_RANGES, LOCATION_OPTIONS } from './intakeState.js'

const MINIMUM_DISPLAY_SCORE = 10

/**
 * Care-type mapping from intake value → facility careTypes label.
 */
const CARE_TYPE_MAP = {
  assisted: 'Assisted Living',
  memory: 'Memory Care',
  skilled: 'Skilled Nursing',
  independent: 'Independent Living',
}

/**
 * Score a single facility against the current intake answers.
 *
 * @param {object} facility  - facility data object (shape from massachusettsFacilities)
 * @param {object} intake    - intake state (shape from intakeState)
 * @returns {{ score: number, breakdown: object, tags: object[], explanation: string }}
 */
export function scoreFacility(facility, intake) {
  if (!intake || !intake.answers) {
    return { score: 50, breakdown: {}, tags: [], explanation: 'No matching criteria' }
  }

  const { answers } = intake
  let score = 20 // base score so any result can appear
  const tags = []
  const breakdown = {}

  // ── Care needs (weight 30) ────────────────────────────────────────────────
  if (answers.care_needs) {
    const targetCareLabel = CARE_TYPE_MAP[answers.care_needs]
    const careTypes = Array.isArray(facility.careTypes) ? facility.careTypes : []
    if (targetCareLabel && careTypes.includes(targetCareLabel)) {
      score += 30
      breakdown.care = 30
      tags.push({ key: 'care_match', label: `Offers ${targetCareLabel}`, icon: '✓' })
    } else {
      breakdown.care = 0
    }
  }

  // ── Budget fit (weight 20) ────────────────────────────────────────────────
  if (answers.budget) {
    const range = BUDGET_RANGES.find((r) => r.value === answers.budget)
    if (range) {
      const minOk = facility.monthlyMin <= range.max
      const maxOk = range.min === 0 || facility.monthlyMax >= range.min
      if (minOk && maxOk) {
        score += 20
        breakdown.budget = 20
        tags.push({ key: 'budget_fit', label: 'Within budget range', icon: '💰' })
      } else if (facility.monthlyMin <= range.max * 1.2) {
        // Partial credit — just slightly over budget
        score += 8
        breakdown.budget = 8
        tags.push({ key: 'budget_close', label: 'Near your budget range', icon: '💰' })
      } else {
        breakdown.budget = 0
      }
    }
  }

  // ── Location (weight 10) ──────────────────────────────────────────────────
  if (answers.location && answers.location !== 'anywhere') {
    const locOption = LOCATION_OPTIONS.find((l) => l.value === answers.location)
    const addressLower = String(facility.address || '').toLowerCase()
    const nameLower = String(facility.name || '').toLowerCase()
    const matched = locOption?.keywords.some(
      (kw) => addressLower.includes(kw) || nameLower.includes(kw)
    )
    if (matched) {
      score += 10
      breakdown.location = 10
      tags.push({ key: 'location_match', label: 'In your preferred area', icon: '📍' })
    } else {
      breakdown.location = 0
    }
  } else if (answers.location === 'anywhere') {
    score += 5
    breakdown.location = 5
  }

  // ── Compliance base bonus ─────────────────────────────────────────────────
  if (facility.complianceRating === 'Excellent') {
    score += 8
    breakdown.complianceBase = 8
    tags.push({ key: 'compliance', label: 'Excellent safety record', icon: '✅' })
  } else if (facility.complianceRating === 'Good') {
    score += 4
    breakdown.complianceBase = 4
  } else {
    breakdown.complianceBase = 0
  }

  // ── Priority: safety / compliance (extra weight 8) ────────────────────────
  if (answers.priorities?.includes('compliance')) {
    if (facility.complianceRating === 'Excellent') {
      score += 8
      breakdown.priorityCompliance = 8
    } else if (facility.complianceRating === 'Good') {
      score += 4
      breakdown.priorityCompliance = 4
    }
  }

  // ── Priority: cost ────────────────────────────────────────────────────────
  if (answers.priorities?.includes('cost')) {
    if (facility.monthlyMin < 4500) {
      score += 8
      breakdown.priorityCost = 8
      tags.push({ key: 'cost', label: 'Affordable option', icon: '💰' })
    } else if (facility.monthlyMin < 6000) {
      score += 4
      breakdown.priorityCost = 4
    }
  }

  // ── Priority: memory care ─────────────────────────────────────────────────
  if (answers.priorities?.includes('memory_care')) {
    const hasMC = Array.isArray(facility.careTypes) && facility.careTypes.includes('Memory Care')
    if (hasMC) {
      score += 8
      breakdown.priorityMemoryCare = 8
      tags.push({ key: 'memory_care', label: 'Memory care available', icon: '🧠' })
    }
  }

  // ── Priority: pet-friendly ────────────────────────────────────────────────
  if (answers.priorities?.includes('pet_friendly')) {
    const hasPet = Array.isArray(facility.amenities) &&
      facility.amenities.some((a) => /pet/i.test(String(a.name || '')))
    if (hasPet) {
      score += 6
      breakdown.priorityPetFriendly = 6
      tags.push({ key: 'pet_friendly', label: 'Pet-friendly', icon: '🐾' })
    }
  }

  // ── Priority: rich amenities ──────────────────────────────────────────────
  if (answers.priorities?.includes('amenities')) {
    const count = Array.isArray(facility.amenities) ? facility.amenities.length : 0
    if (count >= 8) {
      score += 6
      breakdown.priorityAmenities = 6
      tags.push({ key: 'amenities', label: 'Rich amenities', icon: '🌟' })
    } else if (count >= 4) {
      score += 2
      breakdown.priorityAmenities = 2
    }
  }

  // ── Rating bonus ──────────────────────────────────────────────────────────
  if (facility.rating >= 4.5) {
    score += 5
    breakdown.rating = 5
  } else if (facility.rating >= 4.0) {
    score += 2
    breakdown.rating = 2
  }

  const finalScore = Math.max(0, Math.min(100, score))
  const explanation =
    tags.length > 0
      ? tags.map((t) => t.label).join(' · ')
      : 'Matches your general criteria'

  return { score: finalScore, breakdown, tags, explanation }
}

/**
 * Score and rank all facilities against user intake.
 *
 * @param {object[]} facilities - Array of facility objects
 * @param {object}  intake      - User intake state
 * @returns {object[]} Ranked array of { facility, score, breakdown, tags, explanation, rank }
 */
export function rankFacilities(facilities, intake) {
  if (!facilities || facilities.length === 0) return []
  if (!intake) {
    return facilities.map((f, i) => ({
      facility: f,
      score: 50,
      breakdown: {},
      tags: [],
      explanation: 'No matching criteria provided',
      rank: i + 1,
    }))
  }

  const scored = facilities
    .map((facility) => {
      const result = scoreFacility(facility, intake)
      return { facility, ...result }
    })
    .filter((item) => item.score >= MINIMUM_DISPLAY_SCORE)

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    // Tie-breaker: rating then compliance
    const ratingDiff = (b.facility.rating || 0) - (a.facility.rating || 0)
    if (ratingDiff !== 0) return ratingDiff
    const compOrder = { Excellent: 2, Good: 1, 'Needs Improvement': 0 }
    return (compOrder[b.facility.complianceRating] || 0) - (compOrder[a.facility.complianceRating] || 0)
  })

  return scored.map((item, index) => ({ ...item, rank: index + 1 }))
}
