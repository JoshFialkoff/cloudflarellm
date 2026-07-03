/**
 * Baseline tests for lib/intakeState.js
 * Run: node --test __tests__/intakeState.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  INTAKE_STEPS,
  CARE_NEED_OPTIONS,
  BUDGET_RANGES,
  LOCATION_OPTIONS,
  TIMING_OPTIONS,
  PRIORITY_OPTIONS,
  createInitialIntakeState,
  isIntakeComplete,
  getIntakeProgress,
  applyStepAnswer,
  readIntakeState,
  writeIntakeState,
  clearIntakeState,
} from '../lib/intakeState.js'

// ── createInitialIntakeState ─────────────────────────────────────────────────

test('createInitialIntakeState returns correct initial shape', () => {
  const state = createInitialIntakeState()
  assert.strictEqual(state.currentStep, 0)
  assert.strictEqual(state.completed, false)
  assert.strictEqual(state.startedAt, null)
  assert.strictEqual(state.completedAt, null)
  assert.deepStrictEqual(state.answers, {
    care_needs: null,
    budget: null,
    location: null,
    timing: null,
    priorities: [],
  })
})

// ── INTAKE_STEPS ─────────────────────────────────────────────────────────────

test('INTAKE_STEPS has 5 entries in expected order', () => {
  assert.deepStrictEqual(INTAKE_STEPS, ['care_needs', 'budget', 'location', 'timing', 'priorities'])
})

// ── isIntakeComplete ──────────────────────────────────────────────────────────

test('isIntakeComplete returns false for initial state', () => {
  assert.strictEqual(isIntakeComplete(createInitialIntakeState()), false)
})

test('isIntakeComplete returns false when null', () => {
  assert.strictEqual(isIntakeComplete(null), false)
})

test('isIntakeComplete returns true when all answers present', () => {
  const state = {
    completed: false,
    answers: {
      care_needs: 'assisted',
      budget: '4000_6000',
      location: 'boston',
      timing: 'soon',
      priorities: ['cost'],
    },
  }
  assert.strictEqual(isIntakeComplete(state), true)
})

test('isIntakeComplete returns false when priorities empty', () => {
  const state = {
    answers: {
      care_needs: 'assisted',
      budget: '4000_6000',
      location: 'boston',
      timing: 'soon',
      priorities: [],
    },
  }
  assert.strictEqual(isIntakeComplete(state), false)
})

test('isIntakeComplete returns false when one answer missing', () => {
  const state = {
    answers: {
      care_needs: 'assisted',
      budget: null,
      location: 'boston',
      timing: 'soon',
      priorities: ['cost'],
    },
  }
  assert.strictEqual(isIntakeComplete(state), false)
})

// ── getIntakeProgress ─────────────────────────────────────────────────────────

test('getIntakeProgress returns 0 for initial state', () => {
  const state = createInitialIntakeState()
  assert.strictEqual(getIntakeProgress(state), 0)
})

test('getIntakeProgress returns 0 for null', () => {
  assert.strictEqual(getIntakeProgress(null), 0)
})

test('getIntakeProgress returns 0.6 at step 3', () => {
  const state = { currentStep: 3 }
  const progress = getIntakeProgress(state)
  assert.ok(progress > 0.5 && progress <= 0.65, `Expected ~0.6, got ${progress}`)
})

test('getIntakeProgress caps at 1', () => {
  const state = { currentStep: 100 }
  assert.strictEqual(getIntakeProgress(state), 1)
})

// ── applyStepAnswer ───────────────────────────────────────────────────────────

test('applyStepAnswer advances currentStep', () => {
  const state = createInitialIntakeState()
  const next = applyStepAnswer(state, 'care_needs', 'assisted')
  assert.strictEqual(next.currentStep, 1)
  assert.strictEqual(next.answers.care_needs, 'assisted')
})

test('applyStepAnswer sets startedAt on first answer', () => {
  const state = createInitialIntakeState()
  const next = applyStepAnswer(state, 'care_needs', 'memory')
  assert.ok(typeof next.startedAt === 'string')
})

test('applyStepAnswer preserves startedAt once set', () => {
  const state = { ...createInitialIntakeState(), startedAt: '2024-01-01T00:00:00.000Z' }
  const next = applyStepAnswer(state, 'care_needs', 'assisted')
  assert.strictEqual(next.startedAt, '2024-01-01T00:00:00.000Z')
})

test('applyStepAnswer marks completed when last step answered', () => {
  let state = createInitialIntakeState()
  state = applyStepAnswer(state, 'care_needs', 'assisted')
  state = applyStepAnswer(state, 'budget', '4000_6000')
  state = applyStepAnswer(state, 'location', 'boston')
  state = applyStepAnswer(state, 'timing', 'soon')
  state = applyStepAnswer(state, 'priorities', ['cost'])
  assert.strictEqual(state.completed, true)
  assert.ok(typeof state.completedAt === 'string')
})

test('applyStepAnswer is a no-op for unknown step name', () => {
  const state = createInitialIntakeState()
  const next = applyStepAnswer(state, 'unknown_step', 'foo')
  assert.deepStrictEqual(next, state)
})

// ── localStorage persistence (simulated) ────────────────────────────────────

test('readIntakeState returns null when window is undefined (SSR)', () => {
  // In Node.js, window is not defined by default
  assert.strictEqual(readIntakeState(), null)
})

test('writeIntakeState and clearIntakeState are safe when window is undefined', () => {
  // Should not throw
  assert.doesNotThrow(() => writeIntakeState({ foo: 'bar' }))
  assert.doesNotThrow(() => clearIntakeState())
})

// ── Options shape ─────────────────────────────────────────────────────────────

test('CARE_NEED_OPTIONS has 4 options with required fields', () => {
  assert.strictEqual(CARE_NEED_OPTIONS.length, 4)
  for (const opt of CARE_NEED_OPTIONS) {
    assert.ok(opt.value, 'Option must have value')
    assert.ok(opt.label, 'Option must have label')
    assert.ok(opt.description, 'Option must have description')
  }
})

test('BUDGET_RANGES are in ascending order', () => {
  for (let i = 1; i < BUDGET_RANGES.length; i++) {
    assert.ok(
      BUDGET_RANGES[i].min >= BUDGET_RANGES[i - 1].min,
      `Budget ranges must be ascending (${i})`
    )
  }
})

test('LOCATION_OPTIONS includes "anywhere" option', () => {
  assert.ok(LOCATION_OPTIONS.some((o) => o.value === 'anywhere'))
})

test('TIMING_OPTIONS urgency values are decreasing', () => {
  for (let i = 1; i < TIMING_OPTIONS.length; i++) {
    assert.ok(
      TIMING_OPTIONS[i].urgency <= TIMING_OPTIONS[i - 1].urgency,
      `Urgency should decrease for later timing options`
    )
  }
})

test('PRIORITY_OPTIONS has at least 4 entries with icons', () => {
  assert.ok(PRIORITY_OPTIONS.length >= 4)
  for (const opt of PRIORITY_OPTIONS) {
    assert.ok(opt.value)
    assert.ok(opt.label)
    assert.ok(opt.icon)
  }
})
