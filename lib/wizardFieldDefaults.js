import { wizardFieldToText } from './composeAssistedlyQuery'

export const WIZARD_FIELD_STORAGE_KEY = 'assistedly-wizard-fields'

/** Sensible MA defaults so Continue is one click after urgency. */
export const WIZARD_FIELD_DEFAULTS = {
  monthly_budget: '10000',
  zip_code: '02108',
  care_type: 'assisted',
}

const VALID_CARE_TYPES = new Set(['assisted', 'memory', 'skilled'])

function pickField(...candidates) {
  for (const value of candidates) {
    const text = wizardFieldToText(value)
    if (text) return text
  }
  return ''
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
export function resolveWizardFields(prefilledVariables = {}) {
  const stored = readStoredWizardFields()

  const monthly_budget =
    pickField(
      prefilledVariables.monthly_budget,
      prefilledVariables.monthly_budget_raw,
      stored.monthly_budget,
      WIZARD_FIELD_DEFAULTS.monthly_budget
    ) || WIZARD_FIELD_DEFAULTS.monthly_budget

  const zip_code =
    pickField(
      prefilledVariables.zip_code,
      prefilledVariables.zip,
      stored.zip_code,
      WIZARD_FIELD_DEFAULTS.zip_code
    ) || WIZARD_FIELD_DEFAULTS.zip_code

  const care_typeRaw = pickField(
    prefilledVariables.care_type,
    stored.care_type,
    WIZARD_FIELD_DEFAULTS.care_type
  )
  const care_type = VALID_CARE_TYPES.has(care_typeRaw)
    ? care_typeRaw
    : WIZARD_FIELD_DEFAULTS.care_type

  const location =
    pickField(prefilledVariables.Location, prefilledVariables.location) ||
    (zip_code.length === 5 ? `ZIP ${zip_code}, MA` : '')

  return { monthly_budget, zip_code, care_type, location }
}
