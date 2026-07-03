/**
 * Guided intake state machine.
 *
 * Shape of a persisted intake object:
 * {
 *   currentStep: number,       // 0-indexed step index
 *   completed: boolean,
 *   startedAt: string|null,    // ISO timestamp
 *   completedAt: string|null,  // ISO timestamp
 *   answers: {
 *     care_needs: string|null,
 *     budget: string|null,
 *     location: string|null,
 *     timing: string|null,
 *     priorities: string[],
 *   }
 * }
 */

export const INTAKE_STORAGE_KEY = 'assistedly-intake'

export const INTAKE_STEPS = [
  'care_needs',
  'budget',
  'location',
  'timing',
  'priorities',
]

export const CARE_NEED_OPTIONS = [
  { value: 'assisted', label: 'Assisted Living', description: 'Help with daily activities', icon: '🏠' },
  { value: 'memory', label: 'Memory Care', description: 'Specialized dementia support', icon: '🧠' },
  { value: 'skilled', label: 'Skilled Nursing', description: 'Medical & rehabilitation care', icon: '🏥' },
  { value: 'independent', label: 'Independent Living', description: 'Active senior community', icon: '🌳' },
]

export const BUDGET_RANGES = [
  { value: 'under_4000', label: 'Under $4,000/mo', min: 0, max: 4000 },
  { value: '4000_6000', label: '$4,000 – $6,000/mo', min: 4000, max: 6000 },
  { value: '6000_8000', label: '$6,000 – $8,000/mo', min: 6000, max: 8000 },
  { value: '8000_10000', label: '$8,000 – $10,000/mo', min: 8000, max: 10000 },
  { value: 'over_10000', label: 'Over $10,000/mo', min: 10000, max: Infinity },
]

export const LOCATION_OPTIONS = [
  { value: 'boston', label: 'Boston area', keywords: ['boston', 'brookline', 'newton', 'cambridge'] },
  { value: 'worcester', label: 'Worcester area', keywords: ['worcester'] },
  { value: 'springfield', label: 'Springfield area', keywords: ['springfield', 'holyoke'] },
  { value: 'anywhere', label: 'Anywhere in MA', keywords: [] },
]

export const TIMING_OPTIONS = [
  { value: 'immediate', label: 'Right away (within 2 weeks)', urgency: 10 },
  { value: 'soon', label: 'Within 1 month', urgency: 7 },
  { value: 'planning', label: '1–3 months', urgency: 4 },
  { value: 'exploring', label: 'Just exploring', urgency: 1 },
]

export const PRIORITY_OPTIONS = [
  { value: 'cost', label: 'Affordable cost', icon: '💰' },
  { value: 'compliance', label: 'Safety record', icon: '✅' },
  { value: 'memory_care', label: 'Memory care', icon: '🧠' },
  { value: 'pet_friendly', label: 'Pet-friendly', icon: '🐾' },
  { value: 'location', label: 'Close to family', icon: '📍' },
  { value: 'amenities', label: 'Rich amenities', icon: '🌟' },
]

/** Create a blank intake state object. */
export function createInitialIntakeState() {
  return {
    currentStep: 0,
    completed: false,
    startedAt: null,
    completedAt: null,
    answers: {
      care_needs: null,
      budget: null,
      location: null,
      timing: null,
      priorities: [],
    },
  }
}

/** Read persisted intake from localStorage. Returns null when unavailable. */
export function readIntakeState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(INTAKE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Persist intake state to localStorage. */
export function writeIntakeState(state) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // quota / private-browsing — ignore
  }
}

/** Remove persisted intake state. */
export function clearIntakeState() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(INTAKE_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** True when all required steps have an answer. */
export function isIntakeComplete(state) {
  if (!state) return false
  const { answers } = state
  return Boolean(
    answers.care_needs &&
    answers.budget &&
    answers.location &&
    answers.timing &&
    answers.priorities &&
    answers.priorities.length > 0
  )
}

/** 0..1 progress fraction based on currentStep. */
export function getIntakeProgress(state) {
  if (!state) return 0
  return Math.min(1, state.currentStep / INTAKE_STEPS.length)
}

/** Apply an answer for the current step and advance to next. */
export function applyStepAnswer(state, stepName, value) {
  const stepIndex = INTAKE_STEPS.indexOf(stepName)
  if (stepIndex === -1) return state

  const now = new Date().toISOString()
  const nextStep = Math.min(stepIndex + 1, INTAKE_STEPS.length)
  const answers = { ...state.answers, [stepName]: value }
  const completed = nextStep >= INTAKE_STEPS.length

  return {
    ...state,
    currentStep: nextStep,
    completed,
    startedAt: state.startedAt || now,
    completedAt: completed ? now : null,
    answers,
  }
}
