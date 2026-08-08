// ⚠️ CRITICAL_FEATURE: Intake Wizard — NEVER REMOVE without !!APPROVED
// This is the primary lead-capture flow. Removing it kills new user acquisition.
import { useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useIntake } from '../hooks/useIntake'
import {
  INTAKE_STEPS,
  CARE_NEED_OPTIONS,
  BUDGET_RANGES,
  LOCATION_OPTIONS,
  TIMING_OPTIONS,
  PRIORITY_OPTIONS,
} from '../lib/intakeState'
import {
  trackIntakeStart,
  trackIntakeStepComplete,
  trackIntakeComplete,
} from '../lib/intakeAnalytics'
import styles from '../styles/Intake.module.css'

const STEP_META = {
  care_needs: {
    title: 'What type of care is needed?',
    subtitle: 'Select the option that best describes the level of support required.',
  },
  budget: {
    title: "What's your monthly budget?",
    subtitle: 'Choose the range that fits your situation — you can refine later.',
  },
  location: {
    title: 'Where do you want to search?',
    subtitle: "We'll prioritize facilities in or near this area.",
  },
  timing: {
    title: 'How soon do you need to move in?',
    subtitle: 'Urgency helps us flag availability and realistic options.',
  },
  priorities: {
    title: 'What matters most to you?',
    subtitle: "Pick up to 3 priorities — we'll weight your results accordingly.",
  },
}

const MAX_PRIORITIES = 3

function ProgressBar({ stepIndex, totalSteps }) {
  const pct = Math.round(((stepIndex) / totalSteps) * 100)
  return (
    <div className={styles.progressBarWrapper}>
      <div className={styles.progressLabel}>
        <span>Step {stepIndex + 1} of {totalSteps}</span>
        <span>{pct}% complete</span>
      </div>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${Math.max(4, pct)}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}

function CareNeedsStep({ current, onSelect }) {
  return (
    <div className={styles.optionsGrid}>
      {CARE_NEED_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.optionCard} ${current === opt.value ? styles.selected : ''}`}
          onClick={() => onSelect(opt.value)}
        >
          <span className={styles.optionIcon}>{opt.icon}</span>
          <span className={styles.optionLabel}>{opt.label}</span>
          <span className={styles.optionDesc}>{opt.description}</span>
        </button>
      ))}
    </div>
  )
}

function BudgetStep({ current, onSelect }) {
  return (
    <div className={styles.optionsList}>
      {BUDGET_RANGES.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.optionRow} ${current === opt.value ? styles.selected : ''}`}
          onClick={() => onSelect(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function LocationStep({ current, onSelect }) {
  return (
    <div className={styles.optionsList}>
      {LOCATION_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.optionRow} ${current === opt.value ? styles.selected : ''}`}
          onClick={() => onSelect(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function TimingStep({ current, onSelect }) {
  return (
    <div className={styles.optionsList}>
      {TIMING_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.optionRow} ${current === opt.value ? styles.selected : ''}`}
          onClick={() => onSelect(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function PrioritiesStep({ current = [], onToggle }) {
  return (
    <>
      <p className={styles.priorityHint}>
        Select up to {MAX_PRIORITIES} priorities
      </p>
      <div className={styles.prioritiesGrid}>
        {PRIORITY_OPTIONS.map((opt) => {
          const isSelected = current.includes(opt.value)
          const isDisabled = !isSelected && current.length >= MAX_PRIORITIES
          return (
            <button
              key={opt.value}
              type="button"
              className={`${styles.priorityChip} ${isSelected ? styles.selected : ''}`}
              onClick={() => !isDisabled && onToggle(opt.value)}
              disabled={isDisabled}
              aria-pressed={isSelected}
            >
              <span className={styles.priorityChipIcon}>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function CompletionMessage({ onViewMatches }) {
  return (
    <div className={styles.completionMessage}>
      <div className={styles.completionIcon}>🎯</div>
      <h2 className={styles.completionTitle}>Your preferences are saved!</h2>
      <p className={styles.completionSub}>
        We&apos;ve matched facilities to your criteria. View your personalized results below.
      </p>
      <button type="button" className={styles.btnPrimary} onClick={onViewMatches}>
        View My Matched Facilities →
      </button>
    </div>
  )
}

export default function IntakePage() {
  const router = useRouter()
  const { currentStep, stepIndex, answers, answer, goToStep, reset, isComplete, state } =
    useIntake()
  const startTracked = useRef(false)

  // Track intake start on mount (only once per session)
  useEffect(() => {
    if (!startTracked.current && !state.startedAt) {
      trackIntakeStart()
      startTracked.current = true
    }
  }, [state.startedAt])

  function handleSingleAnswer(stepName, value) {
    answer(stepName, value)
    trackIntakeStepComplete(stepName, value)
    // Auto-advance for single-select steps
    // (the state update itself advances currentStep via applyStepAnswer)
  }

  function handlePriorityToggle(value) {
    const current = answers.priorities || []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value].slice(0, MAX_PRIORITIES)
    // Update in-place (don't advance step yet)
    answer('priorities', next)
  }

  function handlePrioritiesDone() {
    const current = answers.priorities || []
    trackIntakeStepComplete('priorities', current)
    answer('priorities', current) // will advance to completed state
    trackIntakeComplete({ ...answers, priorities: current })
  }

  function handleViewMatches() {
    router.push('/matched')
  }

  const meta = STEP_META[currentStep] || STEP_META.care_needs

  // If already completed show the completion message
  if (isComplete || state.completed) {
    return (
      <>
        <Head>
          <title>Your Matches – Assistedly.ai</title>
          <meta name="description" content="Your personalized assisted living matches are ready." />
        </Head>
        <div className={styles.intakePage}>
          <div className={styles.intakeCard}>
            <CompletionMessage onViewMatches={handleViewMatches} />
          </div>
        </div>
      </>
    )
  }

  const canAdvance = (() => {
    if (currentStep === 'priorities') return (answers.priorities || []).length > 0
    return Boolean(answers[currentStep])
  })()

  return (
    <>
      <Head>
        <title>Find Your Match – Assisted Living Intake | Assistedly.ai</title>
        <meta
          name="description"
          content="Answer 5 quick questions so we can match you to the best Massachusetts assisted living facilities for your situation."
        />
      </Head>
      <div className={styles.intakePage}>
        <div className={styles.intakeCard}>
          <ProgressBar stepIndex={stepIndex} totalSteps={INTAKE_STEPS.length} />

          <h1 className={styles.stepTitle}>{meta.title}</h1>
          <p className={styles.stepSubtitle}>{meta.subtitle}</p>

          {currentStep === 'care_needs' && (
            <CareNeedsStep
              current={answers.care_needs}
              onSelect={(v) => handleSingleAnswer('care_needs', v)}
            />
          )}
          {currentStep === 'budget' && (
            <BudgetStep
              current={answers.budget}
              onSelect={(v) => handleSingleAnswer('budget', v)}
            />
          )}
          {currentStep === 'location' && (
            <LocationStep
              current={answers.location}
              onSelect={(v) => handleSingleAnswer('location', v)}
            />
          )}
          {currentStep === 'timing' && (
            <TimingStep
              current={answers.timing}
              onSelect={(v) => handleSingleAnswer('timing', v)}
            />
          )}
          {currentStep === 'priorities' && (
            <>
              <PrioritiesStep
                current={answers.priorities}
                onToggle={handlePriorityToggle}
              />
              <div className={styles.actionRow}>
                {stepIndex > 0 && (
                  <button
                    type="button"
                    className={styles.btnBack}
                    onClick={() => goToStep(stepIndex - 1)}
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handlePrioritiesDone}
                  disabled={!canAdvance}
                >
                  See My Matches →
                </button>
              </div>
            </>
          )}

          {currentStep !== 'priorities' && stepIndex > 0 && (
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.btnBack}
                onClick={() => goToStep(stepIndex - 1)}
              >
                ← Back
              </button>
            </div>
          )}

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={reset}
              style={{ fontSize: '0.8rem', color: 'var(--text-light)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
