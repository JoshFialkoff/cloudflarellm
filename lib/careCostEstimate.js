/** MA assisted-living cost bands by care type (statewide base before ZIP multiplier). */
export const WIZARD_CARE_TYPE_OPTIONS = [
  { value: 'assisted', label: 'Assisted living', low: 5500, high: 7600 },
  { value: 'memory', label: 'Memory care', low: 7800, high: 12500 },
  { value: 'skilled', label: 'Skilled nursing', low: 13000, high: 16500 },
]

const VALID_CARE_TYPES = new Set(WIZARD_CARE_TYPE_OPTIONS.map((option) => option.value))

export function normalizeWizardZip(value) {
  return String(value || '').replace(/[^\d]/g, '').slice(0, 5)
}

export function zipCostMultiplier(zipCode) {
  const zip = Number.parseInt(normalizeWizardZip(zipCode), 10)
  if (!Number.isFinite(zip)) return 1
  if ((zip >= 2100 && zip <= 2499) || zip === 5501) return 1.18
  if (zip >= 1700 && zip <= 2099) return 1.08
  if (zip >= 1000 && zip <= 1699) return 0.96
  return 0.9
}

export function estimateCareCostRange(careType, zipCode) {
  const care =
    WIZARD_CARE_TYPE_OPTIONS.find((option) => option.value === careType) ||
    WIZARD_CARE_TYPE_OPTIONS[0]
  const multiplier = zipCostMultiplier(zipCode)
  return {
    low: Math.round(care.low * multiplier),
    high: Math.round(care.high * multiplier),
    careLabel: care.label,
  }
}

/** Midpoint of the local range, rounded to nearest $100 — default budget prefill. */
export function suggestedMonthlyBudget(careType, zipCode) {
  const { low, high } = estimateCareCostRange(careType, zipCode)
  return Math.round((low + high) / 2 / 100) * 100
}

export function normalizeWizardCareType(value) {
  const raw = String(value || '').trim()
  return VALID_CARE_TYPES.has(raw) ? raw : WIZARD_CARE_TYPE_OPTIONS[0].value
}
