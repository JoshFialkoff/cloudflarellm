import { wizardFieldToText } from './composeAssistedlyQuery'
import {
  normalizeWizardCareType,
  normalizeWizardZip,
  suggestedMonthlyBudget,
} from './careCostEstimate'

export const WIZARD_FIELD_STORAGE_KEY = 'assistedly-wizard-fields'

/** Sensible MA defaults so Continue is one click after urgency. */
export const WIZARD_FIELD_DEFAULTS = {
  zip_code: '02108',
  care_type: 'assisted',
}

function pickField(...candidates) {
  for (const value of candidates) {
    const text = wizardFieldToText(value)
    if (text) return text
  }
  return ''
}

/** True when budget comes from URL/campaign, stored wizard fields, or estimate range — not the zip/care suggestion alone. */
export function hasPinnedMonthlyBudget(prefilledVariables = {}) {
  const stored = readStoredWizardFields()
  return Boolean(
    pickField(
      prefilledVariables.monthly_budget,
      prefilledVariables.monthly_budget_raw,
      budgetFromPrefillEstimates(prefilledVariables),
      stored.monthly_budget
    )
  )
}

export function readStoredWizardFields() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(WIZARD_FIELD_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function writeStoredWizardFields(fields) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WIZARD_FIELD_STORAGE_KEY, JSON.stringify(fields))
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Merge campaign/URL prefill, saved choices, then hard defaults.
 * @param {Record<string, unknown>} prefilledVariables
 */
function budgetFromPrefillEstimates(prefilledVariables) {
  const lowDigits = String(prefilledVariables.estimated_low || '').replace(/[^\d]/g, '')
  const highDigits = String(prefilledVariables.estimated_high || '').replace(/[^\d]/g, '')
  const low = lowDigits ? Number.parseInt(lowDigits, 10) : null
  const high = highDigits ? Number.parseInt(highDigits, 10) : null
  if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > 0) {
    return String(Math.round((low + high) / 2 / 100) * 100)
  }
  if (Number.isFinite(high) && high > 0) return String(high)
  if (Number.isFinite(low) && low > 0) return String(low)
  return ''
}

export function resolveWizardFields(prefilledVariables = {}) {
  const stored = readStoredWizardFields()

  const zip_code =
    normalizeWizardZip(
      pickField(
        prefilledVariables.zip_code,
        prefilledVariables.zip,
        stored.zip_code,
        WIZARD_FIELD_DEFAULTS.zip_code
      ) || WIZARD_FIELD_DEFAULTS.zip_code
    ) || WIZARD_FIELD_DEFAULTS.zip_code

  const care_type = normalizeWizardCareType(
    pickField(
      prefilledVariables.care_type,
      stored.care_type,
      WIZARD_FIELD_DEFAULTS.care_type
    ) || WIZARD_FIELD_DEFAULTS.care_type
  )

  const monthly_budget =
    pickField(
      prefilledVariables.monthly_budget,
      prefilledVariables.monthly_budget_raw,
      budgetFromPrefillEstimates(prefilledVariables),
      stored.monthly_budget
    ) || String(suggestedMonthlyBudget(care_type, zip_code))

  const location =
    pickField(prefilledVariables.Location, prefilledVariables.location) ||
    (zip_code.length === 5 ? `ZIP ${zip_code}, MA` : '')

  return { monthly_budget, zip_code, care_type, location }
}
