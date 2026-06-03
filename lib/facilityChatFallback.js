import { MASSACHUSETTS_FACILITIES } from './massachusettsFacilities'
import { formatTownLabel } from './massachusettsRouteUtils'

const TOWN_INDEX = MASSACHUSETTS_FACILITIES.map((facility) => ({
  town: facility.town,
  townLabel: formatTownLabel(facility.town),
}))

function parseBudget(inputs) {
  const raw = String(inputs?.monthly_budget_raw || inputs?.monthly_budget || '').replace(/[^\d]/g, '')
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function inferRequestedCareType(query, inputs) {
  const explicit = String(inputs?.care_type || '').trim().toLowerCase()
  if (explicit === 'memory') return 'Memory Care'
  if (explicit === 'skilled') return 'Skilled Nursing'
  if (explicit === 'assisted') return 'Assisted Living'

  const q = String(query || '').toLowerCase()
  if (/\b(memory|dementia|alzheim)/.test(q)) return 'Memory Care'
  if (/\b(skilled|nursing|wheelchair|rehab)/.test(q)) return 'Skilled Nursing'
  if (/\b(independent)\b/.test(q)) return 'Independent Living'
  return 'Assisted Living'
}

function inferRequestedTown(query) {
  const q = String(query || '').toLowerCase()
  const match = TOWN_INDEX.find(({ town, townLabel }) => {
    return q.includes(town) || q.includes(townLabel.toLowerCase())
  })
  return match || null
}

function scoreFacility(facility, requestedTown, requestedCareType, budget) {
  let score = facility.rating * 10

  if (requestedTown && facility.town === requestedTown.town) score += 40
  if (facility.careTypes.includes(requestedCareType)) score += 25
  if (budget != null && budget >= facility.monthlyMin && budget <= facility.monthlyMax) score += 15
  if (budget != null) {
    const midpoint = (facility.monthlyMin + facility.monthlyMax) / 2
    score -= Math.min(Math.abs(midpoint - budget) / 250, 15)
  }
  if (facility.complianceRating === 'Excellent') score += 8
  if (facility.complianceRating === 'Good') score += 4

  return score
}

function buildReason(facility, requestedTown, requestedCareType, budget) {
  const parts = []

  if (requestedTown && facility.town === requestedTown.town) {
    parts.push(`in ${requestedTown.townLabel}`)
  }
  if (facility.careTypes.includes(requestedCareType)) {
    parts.push(`${requestedCareType.toLowerCase()} available`)
  }
  if (budget != null && budget >= facility.monthlyMin && budget <= facility.monthlyMax) {
    parts.push(`fits about $${budget.toLocaleString()}/mo`)
  }
  if (facility.complianceRating === 'Excellent') {
    parts.push('excellent compliance')
  } else if (facility.complianceRating === 'Good') {
    parts.push('good compliance')
  }

  return parts.slice(0, 3).join(', ')
}

export function buildLocalFacilityChatFallback(query, inputs) {
  const requestedTown = inferRequestedTown(query)
  const requestedCareType = inferRequestedCareType(query, inputs)
  const budget = parseBudget(inputs)

  const ranked = MASSACHUSETTS_FACILITIES
    .map((facility) => ({
      facility,
      score: scoreFacility(facility, requestedTown, requestedCareType, budget),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ facility }) => facility)

  const filtered = ranked.filter((facility) => {
    if (!requestedTown) return facility.careTypes.includes(requestedCareType)
    return facility.town === requestedTown.town || facility.careTypes.includes(requestedCareType)
  })

  const picks = (filtered.length > 0 ? filtered : ranked).slice(0, 3)
  if (picks.length === 0) return ''

  const intro = requestedTown
    ? `Here are the best Assistedly matches I can show right now for ${requestedTown.townLabel}, Massachusetts:`
    : 'Here are the strongest Assistedly matches I can show right now across Massachusetts:'

  const lines = picks.map((facility, index) => {
    const townLabel = formatTownLabel(facility.town)
    const memoryCare = facility.careTypes.includes('Memory Care') ? 'Yes' : 'No'
    const reason = buildReason(facility, requestedTown, requestedCareType, budget)
    return `${index + 1}. ${facility.name} — ${townLabel}. Memory care: ${memoryCare}. Why: ${reason || 'strong overall fit'}.`
  })

  return `${intro}\n\n${lines.join('\n')}`
}
