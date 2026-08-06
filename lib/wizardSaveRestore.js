/**
 * Wizard save/restore helpers for "Save & Continue Later".
 *
 * Persisted fields (client-side localStorage):
 *   - urgency          – selected urgency label
 *   - monthly_budget   – parsed budget number
 *   - zip_code         – 5-digit ZIP
 *   - care_type        – assisted | memory | skilled
 *   - dify_location    – resolved location string
 *   - scenario_selected – preset scenario label or null
 *   - step             – current wizard step at time of save
 *   - saved_at         – ISO timestamp
 *
 * Restore reads these fields and returns them as an object suitable for
 * spreading into the wizard's prefilledVariables prop.
 */

const SAVE_KEY = 'assistedly-wizard-save'

/** Maximum age for a saved wizard state before we consider it stale (7 days). */
const SAVE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function getSavedWizardState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (!entry || typeof entry !== 'object') return null
    // Expire stale saves
    if (entry.saved_at && Date.now() - new Date(entry.saved_at).getTime() > SAVE_TTL_MS) {
      window.localStorage.removeItem(SAVE_KEY)
      return null
    }
    return entry
  } catch {
    return null
  }
}

export function setSavedWizardState(fields) {
  if (typeof window === 'undefined') return false
  try {
    const entry = {
      ...fields,
      saved_at: new Date().toISOString(),
    }
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(entry))
    return true
  } catch {
    return false
  }
}

export function clearSavedWizardState() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SAVE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Build a minimal snapshot object suitable for server-side storage
 * (compatible with sanitizeResultSnapshot / authResultStore).
 */
export function buildWizardSaveSnapshot(fields) {
  return {
    kind: 'wizard_save',
    version: 1,
    createdAt: new Date().toISOString(),
    title: `Wizard save — ${fields.urgency || 'no urgency'} • ${fields.zip_code ? `ZIP ${fields.zip_code}` : 'no ZIP'}`,
    inputs: {
      urgency: fields.urgency || '',
      monthlyBudget: fields.monthly_budget ?? null,
      zip: fields.zip_code || '',
      careType: fields.care_type || '',
      location: fields.dify_location || '',
      scenarioSelected: fields.scenario_selected || '',
      step: fields.step || '',
    },
    results: {},
  }
}

/**
 * Check whether there is a valid saved state to restore.
 */
export function hasValidSavedState() {
  const state = getSavedWizardState()
  if (!state) return false
  // Require at least urgency to be meaningful
  return Boolean(state.urgency)
}
