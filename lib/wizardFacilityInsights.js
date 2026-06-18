import { MASSACHUSETTS_FACILITIES } from './massachusettsFacilities'
import { facilitySafetyScore } from './facilityTrust'

const CARE_TYPE_LABELS = {
  assisted: 'Assisted Living',
  memory: 'Memory Care',
  skilled: 'Skilled Nursing',
}

function deficiencyCount(facility) {
  return (facility.complianceHistory || []).filter((row) =>
    /deficien|partial|in progress/i.test(`${row.findings} ${row.status}`),
  ).length
}

export function normalizeMemoryCareStatus(value, careTypes = []) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'yes') return 'yes'
  if (normalized === 'no') return 'no'
  if (normalized === 'unknown') return 'unknown'
  if (careTypes.includes('Memory Care')) return 'yes'
  return ''
}

export function lookupFacilityByTitle(title) {
  const name = String(title || '')
    .split(/[—–-]/)[0]
    .replace(/^\d+[.)]\s*/, '')
    .trim()
    .toLowerCase()
  if (!name) return null

  return (
    MASSACHUSETTS_FACILITIES.find((facility) => facility.name.toLowerCase() === name) || null
  )
}

function formatBudgetComparison(facility, budget) {
  if (!Number.isFinite(budget) || budget <= 0 || !facility?.monthlyMin || !facility?.monthlyMax) {
    return null
  }
  if (budget >= facility.monthlyMin && budget <= facility.monthlyMax) {
    return `$${budget.toLocaleString()}/mo — within published $${facility.monthlyMin.toLocaleString()}–$${facility.monthlyMax.toLocaleString()}/mo range`
  }
  if (budget < facility.monthlyMin) {
    return `$${budget.toLocaleString()}/mo — below published low of $${facility.monthlyMin.toLocaleString()}/mo`
  }
  return `$${budget.toLocaleString()}/mo — above published high of $${facility.monthlyMax.toLocaleString()}/mo`
}

function buildDirectoryFacilityInsights(facility, searchContext = {}, item = {}) {
  const insights = []
  const budget = Number(searchContext.monthlyBudget)

  insights.push({
    label: 'Assistedly safety score',
    value: `${facilitySafetyScore(facility)}/100`,
  })

  if (facility.rating != null) {
    insights.push({
      label: 'Resident rating',
      value: `${facility.rating}/5`,
    })
  }

  if (facility.complianceRating) {
    insights.push({
      label: 'Compliance rating',
      value: facility.complianceRating,
    })
  }

  if (facility.monthlyMin != null && facility.monthlyMax != null) {
    insights.push({
      label: 'Monthly range',
      value: `$${facility.monthlyMin.toLocaleString()}–$${facility.monthlyMax.toLocaleString()}/mo`,
    })
  }

  const budgetLine = formatBudgetComparison(facility, budget)
  if (budgetLine) {
    insights.push({
      label: 'Your budget',
      value: budgetLine,
    })
  }

  if (facility.careTypes?.length) {
    insights.push({
      label: 'Care types',
      value: facility.careTypes.join(', '),
    })
  }

  if (facility.capacity) {
    insights.push({
      label: 'Capacity',
      value: `${facility.capacity} residents`,
    })
  }

  const latestInspection = facility.complianceHistory?.[0]
  if (latestInspection) {
    insights.push({
      label: 'Latest inspection',
      value: `${latestInspection.date} — ${latestInspection.findings} (${latestInspection.status})`,
    })
  }

  insights.push({
    label: 'Recent deficiencies',
    value: String(deficiencyCount(facility)),
  })

  if (item.why) {
    insights.push({
      label: 'Why this match',
      value: item.why,
    })
  }

  return insights
}

function buildReplyOnlyInsights(item = {}, searchContext = {}) {
  const insights = []

  if (item.why) {
    insights.push({
      label: 'Why this match',
      value: item.why,
    })
  }

  const requestedCare = CARE_TYPE_LABELS[searchContext.careType]
  const memoryStatus = normalizeMemoryCareStatus(item.memoryCare, item.careTypes)
  if (requestedCare === 'Memory Care' && memoryStatus === 'yes') {
    insights.push({
      label: 'Memory care',
      value: 'Yes',
    })
  }

  return insights
}

export function buildWizardFacilityInsights(facility, searchContext = {}, item = {}) {
  if (facility) return buildDirectoryFacilityInsights(facility, searchContext, item)
  return buildReplyOnlyInsights(item, searchContext)
}

export function enrichWizardMatchItem(item, searchContext = {}) {
  const facility = item.kbSource ? null : lookupFacilityByTitle(item.title)
  const careTypes = facility?.careTypes || item.careTypes || []
  const memoryCareStatus = normalizeMemoryCareStatus(item.memoryCare, careTypes)
  const monthlyRange =
    facility?.monthlyMin != null && facility?.monthlyMax != null
      ? `$${facility.monthlyMin.toLocaleString()}–$${facility.monthlyMax.toLocaleString()}/mo`
      : item.monthlyRange || ''

  return {
    ...item,
    slug: facility?.slug || item.slug || '',
    town: facility?.town || item.town || '',
    address: facility?.address || item.address || '',
    phone: facility?.phone || item.phone || '',
    careTypes,
    monthlyRange,
    memoryCareStatus,
    memoryCare: memoryCareStatus === 'yes' ? 'Yes' : item.memoryCare,
    safetyScore: facility ? facilitySafetyScore(facility) : item.safetyScore || null,
    insights: buildWizardFacilityInsights(facility, searchContext, item),
    directoryMatch: Boolean(facility),
  }
}

export function enrichWizardMatchItems(items, searchContext = {}) {
  return (items || []).map((item) => enrichWizardMatchItem(item, searchContext))
}
