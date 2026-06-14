/**
 * Normalize AssistedlyWizard → Dify chat app inputs.
 * Dify requires `Location` (text) and `monthly_budget` (number); formatted
 * currency strings cause the upstream workflow to hang on SSE ping only.
 */
import { formatHowUrgentPhrase } from './fastTop3WorkflowConfig'

function parseBudgetNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
  const digits = String(value ?? '').replace(/[^\d]/g, '')
  if (!digits) return null
  const parsed = Number.parseInt(digits, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function pickLocation(inputs) {
  const keys = ['Location', 'location', 'city', 'region', 'zip_code', 'zip']
  for (const key of keys) {
    const raw = inputs?.[key]
    if (raw == null) continue
    const text = String(raw).trim()
    if (!text) continue
    if (key === 'zip_code' || key === 'zip') {
      return text.length === 5 ? `ZIP ${text}, MA` : text
    }
    return text
  }
  return ''
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {{ inputs: Record<string, unknown>, location: string, missing: string[] }}
 */
export function normalizeDifyChatInputs(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
  const missing = []

  const location =
    pickLocation(source) ||
    (typeof source.Location === 'string' ? source.Location.trim() : '')

  if (!location) {
    missing.push('Location')
  }

  const budget =
    parseBudgetNumber(source.monthly_budget) ??
    parseBudgetNumber(source.monthly_budget_raw) ??
    parseBudgetNumber(source.budget)

  const howUrgent =
    typeof source.how_urgent === 'string'
      ? source.how_urgent.trim()
      : typeof source.How_urgent === 'string'
        ? source.How_urgent.trim()
        : ''

  const inputs = {}
  if (location) inputs.Location = location
  if (howUrgent) inputs.how_urgent = formatHowUrgentPhrase(howUrgent) || howUrgent
  if (budget != null) inputs.monthly_budget = budget

  return { inputs, location, missing }
}
