/** Remove zero-width / format chars that yield "truthy" but invisible UI text. */
const INVISIBLE_CHARS = /[\u200B-\u200D\u2060\uFEFF]/g

function stripForDisplay(raw) {
  return String(raw).replace(INVISIBLE_CHARS, '').replace(/\s+/g, ' ').trim()
}

/** Coerce wizard fields to plain display/API strings (never "[object Object]"). */
export function wizardFieldToText(value) {
  if (value == null) return ''
  const t = typeof value
  if (t === 'string') return stripForDisplay(value)
  if (t === 'number' || t === 'boolean') return stripForDisplay(String(value))
  if (t === 'object') {
    for (const key of ['label', 'value', 'text', 'content', 'plainText', 'message', 'title']) {
      if (value[key] != null && typeof value[key] === 'string' && stripForDisplay(value[key])) {
        return stripForDisplay(value[key])
      }
    }
  }
  try {
    const s = stripForDisplay(String(value))
    return s === '[object Object]' ? '' : s
  } catch {
    return ''
  }
}

/** Urgency may arrive via URL/prefill keys (legacy Typebot variable names). */
export function urgencyFromPrefill(prefilledVariables) {
  if (!prefilledVariables || typeof prefilledVariables !== 'object' || Array.isArray(prefilledVariables)) {
    return ''
  }
  const keys = [
    'how_urgent',
    'How_urgent',
    'urgency',
    'how_urgently_do_you_need_to_find_assisted_living',
  ]
  for (const k of keys) {
    const text = wizardFieldToText(prefilledVariables[k])
    if (text) return text
  }
  return ''
}

/** @param {number} amount */
export function formatMonthlyBudget(amount) {
  return `$${Math.round(amount).toLocaleString('en-US')} per month`
}

/** Preset scenario chip → Dify request (matches AI-Bot-Front-End / Typebot export wording). */
export function composePresetListQuery(presetIntroChoice, urgencyLabel) {
  return `Return an ordered list of 2–3 assisted-living facilities based on ${presetIntroChoice},${urgencyLabel}.`
}

/** Custom intro + location → Dify (double space after "based on", per export). */
export function composeCustomListQuery(userQuestion, facilityLocation) {
  return `Return an ordered list of 2–3 assisted-living facilities based on  ${userQuestion} in ${facilityLocation}.`
}

/** Map preset scenario chip → `Location` workflow input (Dify form). */
export function locationHintFromPresetScenario(presetIntroChoice) {
  if (presetIntroChoice.includes('Winchester')) return 'Winchester, MA'
  if (presetIntroChoice.includes('Amherst')) return 'Amherst, MA'
  if (presetIntroChoice.includes('Stoneham')) return 'Stoneham, MA'
  return 'Massachusetts'
}

export function composeWizardQuery(parts) {
  return [
    'Massachusetts assisted living / memory care search.',
    `Urgency: ${wizardFieldToText(parts.urgency) || '(missing)'}.`,
    `Loved one (name): ${wizardFieldToText(parts.lovedOneName) || '(missing)'}.`,
    `Scenario / needs: ${wizardFieldToText(parts.scenario) || '(missing)'}.`,
  ].join('\n')
}

export function composeLocationSearchQuery(parts) {
  const location = wizardFieldToText(parts.location) || '(missing)'
  const urgency = wizardFieldToText(parts.urgency) || '(missing)'
  return [
    'Massachusetts assisted living / memory care search.',
    `Location: ${location}.`,
    ...(parts.monthlyBudget ? [`Monthly budget: ${formatMonthlyBudget(parts.monthlyBudget)}.`] : []),
    `Urgency: ${urgency}.`,
    'Return the top 3 matches if possible.',
  ].join('\n')
}

export function composeFollowUpQuery(storedContext, followUp) {
  return `${String(storedContext || '').trim()}\n\nFollow-up:\n${String(followUp || '').trim()}`
}
