import { useState, useCallback, useEffect } from 'react'
import {
  INTAKE_STEPS,
  createInitialIntakeState,
  readIntakeState,
  writeIntakeState,
  clearIntakeState,
  isIntakeComplete,
  getIntakeProgress,
  applyStepAnswer,
} from '../lib/intakeState'

/**
 * React hook for guided intake state management.
 *
 * Returns:
 *  state       — full intake state object
 *  currentStep — name of current step (e.g. 'care_needs')
 *  stepIndex   — numeric index of current step
 *  progress    — 0..1 fraction
 *  isComplete  — whether all steps answered
 *  answer      — fn(stepName, value) to record an answer and advance
 *  goToStep    — fn(index) to navigate directly to a step
 *  reset       — fn() to clear state and restart
 *  answers     — shortcut to state.answers
 */
export function useIntake() {
  const [state, setState] = useState(() => {
    const persisted = readIntakeState()
    return persisted || createInitialIntakeState()
  })

  // Persist on every state change
  useEffect(() => {
    writeIntakeState(state)
  }, [state])

  const answer = useCallback(
    (stepName, value) => {
      setState((prev) => applyStepAnswer(prev, stepName, value))
    },
    []
  )

  const goToStep = useCallback((index) => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, Math.min(index, INTAKE_STEPS.length - 1)),
    }))
  }, [])

  const reset = useCallback(() => {
    clearIntakeState()
    setState(createInitialIntakeState())
  }, [])

  const stepIndex = Math.min(state.currentStep, INTAKE_STEPS.length - 1)
  const currentStep = INTAKE_STEPS[stepIndex]

  return {
    state,
    currentStep,
    stepIndex,
    progress: getIntakeProgress(state),
    isComplete: isIntakeComplete(state),
    answer,
    goToStep,
    reset,
    answers: state.answers,
  }
}
