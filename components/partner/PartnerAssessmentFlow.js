'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './PartnerAssessmentFlow.module.css'
import { pushGevent } from '../../lib/gtag'

/**
 * Partner Assessment Flow — 5–8 questions with branch logic.
 * Source-linked. No medical diagnosis.
 * Outputs a "Care Snapshot" that handoffs to /search or save.
 */
const ASSESSMENT_QUESTIONS = [
  {
    id: 'who_needs_care',
    question: 'Who needs care?',
    type: 'single',
    source: null,
    options: [
      { value: 'self', label: 'Myself' },
      { value: 'parent', label: 'My parent' },
      { value: 'spouse', label: 'My spouse or partner' },
      { value: 'other', label: 'Someone else' },
    ],
  },
  {
    id: 'current_living',
    question: 'What type of home does the person live in now?',
    type: 'single',
    source: null,
    options: [
      { value: 'own_home', label: 'Own home or apartment' },
      { value: 'family_home', label: 'With family' },
      { value: 'independent_living', label: 'Independent living community' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    id: 'living_situation',
    question: 'Is the person living alone or with someone?',
    type: 'single',
    source: {
      text: 'AARP Foundation — Isolation Risk Report',
      url: 'https://www.aarp.org/ppi/info-2020/social-isolation.html',
    },
    options: [
      { value: 'alone', label: 'Living alone' },
      { value: 'with_spouse', label: 'With spouse or partner' },
      { value: 'with_family', label: 'With family or caregiver' },
      { value: 'other', label: 'Other arrangement' },
    ],
  },
  {
    id: 'recent_changes',
    question: 'In the last 3 months, has the person had any of the following?',
    type: 'multi',
    source: {
      text: 'CDC — Older Adult Falls',
      url: 'https://www.cdc.gov/falls/index.html',
    },
    options: [
      { value: 'falls', label: 'One or more falls' },
      { value: 'hospital', label: 'Hospital visit or ER trip' },
      { value: 'daily_tasks', label: 'Trouble managing daily tasks' },
      { value: 'memory', label: 'Noticeable memory changes' },
      { value: 'none', label: 'None of the above' },
    ],
  },
  {
    id: 'current_help',
    question: 'What level of help is currently available?',
    type: 'multi',
    source: null,
    options: [
      { value: 'family', label: 'Help from family or friends' },
      { value: 'paid_caregiver', label: 'Paid caregiver or home health aide' },
      { value: 'meals_transport', label: 'Meal delivery or transportation services' },
      { value: 'none', label: 'No regular help' },
    ],
  },
  {
    id: 'location',
    question: 'What location are you exploring care options for?',
    type: 'location',
    source: null,
    options: [],
    placeholder: 'City or ZIP code in Massachusetts',
  },
  {
    id: 'budget',
    question: 'Is there a budget range or insurance type to consider?',
    type: 'single',
    source: {
      text: 'Massachusetts EOEA — ALR Fee Report 2024',
      url: 'https://assistedly.ai/data-sources',
    },
    options: [
      { value: 'private_pay', label: 'Private pay / out of pocket' },
      { value: 'long_term_care', label: 'Long-term care insurance' },
      { value: 'medicaid', label: 'MassHealth / Medicaid' },
      { value: 'va', label: 'VA benefits' },
      { value: 'unsure', label: 'Not sure yet' },
    ],
  },
  {
    id: 'priorities',
    question: 'What matters most? (Select up to 3)',
    type: 'rank',
    source: null,
    maxSelect: 3,
    options: [
      { value: 'safety', label: 'Safety and 24/7 support' },
      { value: 'social', label: 'Social connection and activities' },
      { value: 'proximity', label: 'Proximity to family' },
      { value: 'memory_care', label: 'Specialized memory care' },
      { value: 'cost', label: 'Affordability and value' },
      { value: 'reputation', label: 'Facility reputation and reviews' },
    ],
  },
]

export default function PartnerAssessmentFlow({ partner }) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [direction, setDirection] = useState('forward')
  const [completed, setCompleted] = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  const [startTime, setStartTime] = useState(Date.now())

  const currentQuestion = ASSESSMENT_QUESTIONS[stepIndex]
  const isLastStep = stepIndex === ASSESSMENT_QUESTIONS.length - 1
  const isFirstStep = stepIndex === 0

  useEffect(() => {
    // Log assessment start on first question
    if (stepIndex === 0 && window.posthog) {
      window.posthog.capture('partner_assessment_start', {
        partner_slug: partner.slug,
        partner_name: partner.name,
      })
      pushGevent('partner_assessment_start', { partner_slug: partner.slug })
    }
  }, [partner])

  useEffect(() => {
    // Log step completion
    if (window.posthog && currentQuestion) {
      window.posthog.capture('partner_assessment_step_complete', {
        partner_slug: partner.slug,
        partner_name: partner.name,
        step_id: currentQuestion.id,
        step_number: stepIndex + 1,
        total_steps: ASSESSMENT_QUESTIONS.length,
        has_answer: Boolean(answers[currentQuestion.id]),
      })
    }
  }, [stepIndex, partner, answers, currentQuestion])

  const goNext = useCallback(() => {
    if (!answers[currentQuestion.id] || answers[currentQuestion.id].length === 0) return
    setDirection('forward')
    if (isLastStep) {
      handleComplete()
    } else {
      setStepIndex(i => i + 1)
    }
  }, [currentQuestion, answers, isLastStep])

  const goBack = useCallback(() => {
    if (isFirstStep) return
    setDirection('backward')
    setStepIndex(i => i - 1)
  }, [isFirstStep])

  const handleAnswer = useCallback((questionId, value) => {
    setAnswers(prev => {
      const q = ASSESSMENT_QUESTIONS.find(q => q.id === questionId)
      if (q.type === 'multi' || q.type === 'rank') {
        const current = prev[questionId] || []
        if (current.includes(value)) {
          return { ...prev, [questionId]: current.filter(v => v !== value) }
        }
        if (q.maxSelect && current.length >= q.maxSelect) {
          return prev
        }
        return { ...prev, [questionId]: [...current, value] }
      }
      return { ...prev, [questionId]: value }
    })
  }, [])

  const handleComplete = useCallback(() => {
    const duration = Math.round((Date.now() - startTime) / 1000)
    const hasLocation = Boolean(answers.location)

    // Log assessment completion
    if (window.posthog) {
      window.posthog.capture('partner_assessment_completed', {
        partner_slug: partner.slug,
        partner_name: partner.name,
        duration_seconds: duration,
        has_location: hasLocation,
        answer_summary: Object.keys(answers).map(k => ({
          question: k,
          has_answer: Boolean(answers[k]),
        })),
      })
    }
    pushGevent('partner_assessment_completed', {
      partner_slug: partner.slug,
      duration_seconds: duration,
      has_location: hasLocation,
    })

    // Build snapshot text
    const snap = buildSnapshot(answers)
    setSnapshot(snap)
    setCompleted(true)

    if (window.posthog) {
      window.posthog.capture('partner_snapshot_viewed', {
        partner_slug: partner.slug,
        partner_name: partner.name,
        snapshot_type: 'care_transition_preview',
      })
    }
  }, [partner, answers, startTime])

  const handleSeeOptions = useCallback(() => {
    const city = answers.location || 'massachusetts'
    if (window.posthog) {
      window.posthog.capture('partner_facility_search', {
        partner_slug: partner.slug,
        partner_name: partner.name,
        city,
        has_location: Boolean(answers.location),
      })
    }
    pushGevent('partner_facility_search', {
      partner_slug: partner.slug,
      city,
    })
    router.push(`/search?city=${encodeURIComponent(city)}&partner=${partner.slug}`)
  }, [partner, answers, router])

  const handleSaveSnapshot = useCallback(() => {
    // Handoff to magic link save flow
    router.push(`/partner/${partner.slug}/assessment?save=1&snapshot=${encodeURIComponent(JSON.stringify(answers))}`)
  }, [partner, answers, router])

  // ─── Snapshot View ───────────────────────────────────────
  if (completed && snapshot) {
    return (
      <div className={styles.page}>
        <div className={styles.snapshotCard}>
          <h1 className={styles.snapshotTitle}>Your Care Snapshot</h1>
          <p className={styles.snapshotLead}>
            This is a personalized summary based on your answers, not a medical assessment.
          </p>

          <div className={styles.snapshotBody}>
            {snapshot.points.map((pt, i) => (
              <div key={i} className={styles.snapshotPoint}>
                <span className={styles.snapshotIcon}>•</span>
                <span>{pt}</span>
              </div>
            ))}
          </div>

          <div className={styles.sourceNote}>
            <strong>Sources used:</strong>{' '}
            {snapshot.sources.map((src, i) => (
              <span key={i}>
                {i > 0 && ', '}
                <a href={src.url} target="_blank" rel="noopener noreferrer">
                  {src.text}
                </a>
              </span>
            ))}
          </div>

          <div className={styles.snapshotActions}>
            <button className={styles.primaryAction} onClick={handleSeeOptions}>
              See care options near you
            </button>
            <button className={styles.secondaryAction} onClick={handleSaveSnapshot}>
              Save your snapshot
            </button>
          </div>

          <p className={styles.snapshotDisclaimer}>
            You are in control. Assistedly does not share your information with {partner.shortName} unless you separately authorize it.
          </p>
        </div>
      </div>
    )
  }

  // ─── Assessment Flow ──────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${((stepIndex + 1) / ASSESSMENT_QUESTIONS.length) * 100}%` }}
        />
        <span className={styles.progressText}>
          Question {stepIndex + 1} of {ASSESSMENT_QUESTIONS.length}
        </span>
      </div>

      <div className={styles.questionCard}>
        {currentQuestion.source && (
          <div className={styles.sourceBadge}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <a href={currentQuestion.source.url} target="_blank" rel="noopener noreferrer">
              Source: {currentQuestion.source.text}
            </a>
          </div>
        )}

        <h2 className={styles.questionText}>{currentQuestion.question}</h2>

        {currentQuestion.type === 'location' ? (
          <input
            type="text"
            className={styles.locationInput}
            placeholder={currentQuestion.placeholder}
            value={answers[currentQuestion.id] || ''}
            onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
          />
        ) : (
          <div className={styles.options}>
            {currentQuestion.options.map(opt => {
              const isSelected = (() => {
                const ans = answers[currentQuestion.id]
                if (Array.isArray(ans)) return ans.includes(opt.value)
                return ans === opt.value
              })()

              return (
                <button
                  key={opt.value}
                  className={`${styles.optionButton} ${isSelected ? styles.optionSelected : ''}`}
                  onClick={() => handleAnswer(currentQuestion.id, opt.value)}
                  type="button"
                >
                  <span className={styles.checkCircle}>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className={styles.optionLabel}>{opt.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {currentQuestion.maxSelect && (
          <p className={styles.maxSelectHint}>
            Select up to {currentQuestion.maxSelect}
            {answers[currentQuestion.id]?.length >= currentQuestion.maxSelect && (
              <span> (max reached)</span>
            )}
          </p>
        )}

        <div className={styles.navButtons}>
          {!isFirstStep && (
            <button className={styles.backButton} onClick={goBack} type="button">
              Back
            </button>
          )}
          <button
            className={styles.nextButton}
            onClick={goNext}
            disabled={!answers[currentQuestion.id] || answers[currentQuestion.id].length === 0}
            type="button"
          >
            {isLastStep ? 'See my snapshot' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Snapshot Builder ───────────────────────────────────────
function buildSnapshot(answers) {
  const points = []
  const sources = []

  // Who needs care
  const whoMap = {
    self: 'You are exploring care options for yourself.',
    parent: 'You are exploring care options for a parent.',
    spouse: 'You are exploring care options for a spouse or partner.',
    other: 'You are exploring care options for someone close to you.',
  }
  if (answers.who_needs_care && whoMap[answers.who_needs_care]) {
    points.push(whoMap[answers.who_needs_care])
  }

  // Living situation
  if (answers.living_situation) {
    const aloneRisk = answers.living_situation === 'alone' ? ' Living alone increases isolation risk, which is a known health factor.' : ''
    const situationMap = {
      alone: `The person is currently living alone.${aloneRisk}`,
      with_spouse: 'The person lives with a spouse or partner.',
      with_family: 'The person lives with family or a caregiver.',
      other: 'The living arrangement is noted for context.',
    }
    points.push(situationMap[answers.living_situation])
    sources.push({ text: 'AARP Foundation', url: 'https://www.aarp.org/ppi/info-2020/social-isolation.html' })
  }

  // Recent changes
  if (answers.recent_changes) {
    const changes = Array.isArray(answers.recent_changes) ? answers.recent_changes : [answers.recent_changes]
    if (!changes.includes('none')) {
      const changeLabels = {
        falls: 'One or more falls in the last 3 months',
        hospital: 'A hospital or ER visit recently',
        daily_tasks: 'Difficulty managing daily tasks',
        memory: 'Noticeable memory changes',
      }
      const changeText = changes.map(c => changeLabels[c]).filter(Boolean).join('; ')
      if (changeText) {
        points.push(`Recent changes noted: ${changeText}. This may suggest it's a good time to explore care options.`)
        sources.push({ text: 'CDC Falls Data', url: 'https://www.cdc.gov/falls/index.html' })
      }
    } else {
      points.push('No recent falls, hospital visits, or major changes reported. This is a good time to plan proactively.')
    }
  }

  // Current help
  if (answers.current_help) {
    const help = Array.isArray(answers.current_help) ? answers.current_help : [answers.current_help]
    if (help.includes('none')) {
      points.push('No regular help is currently available. This suggests a higher level of support may be beneficial.')
    } else {
      const helpLabels = {
        family: 'support from family or friends',
        paid_caregiver: 'paid caregiver or home health aide',
        meals_transport: 'meal delivery or transportation services',
      }
      const helpText = help.map(h => helpLabels[h]).filter(Boolean).join(', ')
      points.push(`Current support includes ${helpText}.`)
    }
  }

  // Location
  if (answers.location) {
    points.push(`Exploring options near: ${answers.location}.`)
  }

  // Budget
  if (answers.budget) {
    const budgetMap = {
      private_pay: 'Budget: Private pay. Massachusetts ALR fees range from $3,500–$8,000+/month.',
      long_term_care: 'Budget: Long-term care insurance. We\'ll help verify coverage details.',
      medicaid: 'Budget: MassHealth / Medicaid. We\'ll filter for participating communities.',
      va: 'Budget: VA benefits. We\'ll help identify eligible facilities.',
      unsure: 'Budget: Not sure yet. We\'ll help you understand costs and financing options.',
    }
    points.push(budgetMap[answers.budget])
    sources.push({ text: 'MA EOEA ALR Fee Report', url: 'https://assistedly.ai/data-sources' })
  }

  // Priorities
  if (answers.priorities) {
    const priorities = Array.isArray(answers.priorities) ? answers.priorities : [answers.priorities]
    if (priorities.length > 0) {
      const priorityLabels = {
        safety: 'safety and 24/7 support',
        social: 'social connection and activities',
        proximity: 'proximity to family',
        memory_care: 'specialized memory care',
        cost: 'affordability and value',
        reputation: 'facility reputation and reviews',
      }
      const priorityText = priorities.map(p => priorityLabels[p]).filter(Boolean).join(', ')
      points.push(`Your top priorities: ${priorityText}. We'll use these to sort your results.`)
    }
  }

  return { points, sources }
}
