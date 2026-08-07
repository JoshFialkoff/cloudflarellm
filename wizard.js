'use client'

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
import {
  composeCustomListQuery,
  composeLocationSearchQuery,
  formatMonthlyBudget,
  urgencyFromPrefill,
} from '../lib/composeAssistedlyQuery'
import {
  buildCompleteNativeTop3Reply,
  buildLocalFacilityChatFallback,
  buildWizardSearchSnapshot,
  replyIncludesTop3Matches,
} from '../lib/facilityChatFallback'
import { useChatAnalytics } from '../hooks/useChatAnalytics'
import {
  emailLengthBucket,
  trackAuthEmailFocused,
  trackAuthEmailTypingStarted,
  trackAuthFormSubmitted,
  trackAuthMagicLinkRequestFailed,
  trackAuthMagicLinkSent,
  trackAuthTestLinkClicked,
} from '../lib/authAnalytics'
import { normalizeAssistantHtml, streamDifyChatResponse } from '../lib/streamDifyChat'
import { isDifyChatEngine, prefetchChatEngine } from '../lib/chatEngineClient'
import { resolveLocationFromZip } from '../lib/zipLocation'
import { resolveWizardFields, writeStoredWizardFields, hasPinnedMonthlyBudget } from '../lib/wizardFieldDefaults'
import {
  WIZARD_CARE_TYPE_OPTIONS,
  estimateCareCostRange,
  suggestedMonthlyBudget,
} from '../lib/careCostEstimate'
import { formatHowUrgentPhrase, normalizeFastTop3AnswerIntro } from '../lib/fastTop3WorkflowConfig'
import {
  captureWizardPathVariantShown,
  readWizardPathVariantFromPostHog,
} from '../lib/wizardBudgetScenariosExperiment'
import { PENDING_SNAPSHOT_KEY } from './ResultsSnapshotSection'
import ResultsSatisfactionPrompt from './ResultsSatisfactionPrompt'
import WizardFacilityMatchList, { MAX_MATCHES } from './WizardFacilityMatchList'
import { extractAssistantIntro, looksLikeTop3AssistantReply, parseAssistantMatches, stripHtml } from '../lib/wizardAssistantParse'
import { revealFocusTarget } from '../lib/revealFocusTarget'
import styles from './AssistedlyWizard.module.css'

const USER_STORAGE_KEY = 'assistedly-dify-user-id'
const EMAIL_STORAGE_KEY = 'assistedly_email'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function uid() {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getOrCreateUserId() {
  if (typeof window === 'undefined') return 'anonymous'
  try {
    let id = window.sessionStorage.getItem(USER_STORAGE_KEY)
    if (!id) {
      id = uid()
      window.sessionStorage.setItem(USER_STORAGE_KEY, id)
    }

    return id
  } catch {
    return `u-${Date.now()}`
  }
}

function getStoredContact() {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(EMAIL_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function isValidPhoneOrEmail(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return false
  if (EMAIL_RE.test(trimmed)) return true
  const digits = trimmed.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

const URGENCY_OPTIONS = ['Right away', 'In the next month', 'In more than one month']

const URGENCY_INTRO_QUESTION = 'How urgently do you need to find assisted living?'

const CUSTOM_USER_PLACEHOLDER =
  "Tell me for whom you're looking for assisted living, how old they are and in what location they want to live."

const CUSTOM_SEARCH_PLACEHOLDER = 'Where do you want to search for assisted-living homes?'
const BUDGET_QUESTION = 'What is your budget?'
const BUDGET_MIN = 4000
const BUDGET_MAX = 18000
const CARE_TYPE_OPTIONS = WIZARD_CARE_TYPE_OPTIONS

const EMPTY_ASSISTANT_FALLBACK =
  'Sorry — no answer came back from the assistant. Please tap Start over, or check that Dify is configured for /api/chat.'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function BotAvatar() {
  return <div className={styles.avatar} aria-hidden />
}

function UrgencyIntroBubble() {
  return (
    <div className={styles.urgencyIntro}>
      <p className={styles.urgencyIntroQuestion}>{URGENCY_INTRO_QUESTION}</p>
    </div>
  )
}

function BudgetIntroBubble() {
  return (
    <div className={styles.urgencyIntro}>
      <p className={styles.urgencyIntroQuestion}>{BUDGET_QUESTION}</p>
      <p className={styles.budgetIntroHint}>Share ZIP code and care type to see a local estimated range.</p>
    </div>
  )
}

function parseBudget(value) {
  const digits = String(value || '').replace(/[^\d]/g, '')
  if (!digits) return null
  const parsed = Number.parseInt(digits, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatBudgetFieldDisplay(value) {
  const parsed = parseBudget(value)
  return parsed != null ? currency.format(parsed) : ''
}

function normalizeZip(value) {
  const digits = String(value || '').replace(/[^\d]/g, '').slice(0, 5)
  return digits
}

function budgetPercent(value) {
  const clamped = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, value))
  return ((clamped - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100
}

function budgetFromClientX(clientX, trackElement) {
  if (!trackElement) return null
  const rect = trackElement.getBoundingClientRect()
  if (!rect.width) return null
  const ratio = (clientX - rect.left) / rect.width
  const clamped = Math.min(1, Math.max(0, ratio))
  const raw = BUDGET_MIN + clamped * (BUDGET_MAX - BUDGET_MIN)
  return Math.round(Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, raw)) / 100) * 100
}

const BudgetRangeChart = memo(function BudgetRangeChart({ monthlyBudget, zipCode, careType, onBudgetChange }) {
  const trackRef = useRef(null)
  const estimate = estimateCareCostRange(careType, zipCode)
  const lowPercent = budgetPercent(estimate.low)
  const highPercent = budgetPercent(estimate.high)
  const barWidth = Math.max(3, highPercent - lowPercent)
  const budgetValue = parseBudget(monthlyBudget)
  const sliderValue = budgetValue ?? suggestedMonthlyBudget(careType, zipCode)
  const budgetMarker = budgetPercent(sliderValue)
  const canSetBudget = typeof onBudgetChange === 'function'

  const pickBudgetAt = (clientX) => {
    if (!canSetBudget) return
    const nextBudget = budgetFromClientX(clientX, trackRef.current)
    if (nextBudget == null) return
    onBudgetChange(nextBudget)
  }

  const handleTrackPointer = (event) => {
    if (!canSetBudget) return
    event.preventDefault()
    pickBudgetAt(event.clientX)
  }

  const handleSliderInput = (event) => {
    if (!canSetBudget) return
    const nextBudget = Number(event.target.value)
    if (!Number.isFinite(nextBudget)) return
    onBudgetChange(nextBudget)
  }

  return (
    <div className={styles.budgetChart}>
      <div className={styles.budgetChartHeader}>
        <span className={styles.budgetChartLabel}>Estimated {estimate.careLabel} range</span>
        <strong>{currency.format(estimate.low)} – {currency.format(estimate.high)}</strong>
      </div>
      <div
        className={`${styles.budgetChartTrackWrap} ${canSetBudget ? styles.budgetChartTrackInteractive : ''}`}
        onPointerDown={canSetBudget ? handleTrackPointer : undefined}
        onClick={canSetBudget ? handleTrackPointer : undefined}
      >
        <div ref={trackRef} className={styles.budgetChartTrack} data-budget-chart-track>
          <span
            className={styles.budgetChartRange}
            data-budget-chart-range
            style={{ left: `${lowPercent}%`, width: `${barWidth}%` }}
          />
          <span className={styles.budgetChartMarker} style={{ left: `${budgetMarker}%` }} />
        </div>
        {canSetBudget ? (
          <input
            type="range"
            className={styles.budgetChartRangeInput}
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={100}
            value={sliderValue}
            aria-label={`Monthly budget ${currency.format(sliderValue)}. Drag or click to adjust.`}
            onChange={handleSliderInput}
            onInput={handleSliderInput}
          />
        ) : null}
      </div>
      <div className={styles.budgetChartScale}>
        <span>{currency.format(BUDGET_MIN)}</span>
        {canSetBudget ? <span className={styles.budgetChartHint}>Click or drag the bar to set budget</span> : null}
        <span>{currency.format(BUDGET_MAX)}</span>
      </div>
    </div>
  )
})

function scheduleAfterPaint(task) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task)
    return
  }
  setTimeout(task, 0)
}

function prefetchChatRoute() {
  if (typeof window === 'undefined') return
  void prefetchChatEngine()
}

function normalizeMonthlyBudgetText(text) {
  return text.replace(/\$(\d[\d,]*)(?:\s*\/\s*month|\s+per\s+month)/gi, (_match, rawAmount) =>
    formatMonthlyBudget(Number(String(rawAmount).replace(/\D/g, '')))
  )
}

function assistantLineHasMatchList(line) {
  if (line?.type !== 'assistant' || typeof line.text !== 'string' || !line.text.trim()) {
    return false
  }
  return Boolean(parseAssistantMatches(normalizeMonthlyBudgetText(line.text)))
}

/**
 * Convert markdown bold (**text**) to <strong> elements and render line breaks.
 * Used as a fallback when the structured parser cannot match the response.
 */
function renderMarkdownText(text) {
  if (!text) return null
  // Split on **bold** markers and render alternating plain/bold segments
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    // Preserve newlines as <br> elements
    const lines = part.split('\n')
    return lines.map((line, j) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < lines.length - 1 ? <br /> : null}
      </span>
    ))
  })
}

function AssistantText({
  text,
  kbFacilities = null,
  searchContext = null,
  isStreaming = false,
  onFacilityExpand = null,
  matchListRef = null,
}) {
  const formattedText = normalizeMonthlyBudgetText(text)
  const introFromText = extractAssistantIntro(stripHtml(formattedText).replace(/\r\n/g, '\n').trim())
  const kbItems = Array.isArray(kbFacilities) && kbFacilities.length > 0 ? kbFacilities : null
  const parsed = kbItems ? null : parseAssistantMatches(formattedText)

  if (kbItems?.length) {
    return (
      <div className={styles.assistantText}>
        <WizardFacilityMatchList
          key={`kb-${kbItems.map((item) => item.title).join('|')}`}
          intro={introFromText}
          items={kbItems}
          searchContext={searchContext}
          expandFirst={false}
          onFacilityExpand={onFacilityExpand}
          listRef={matchListRef}
        />
        {isStreaming && !introFromText ? (
          <span className={styles.typing}>Finding your top matches…</span>
        ) : null}
      </div>
    )
  }

  if (parsed) {
    return (
      <div className={styles.assistantText}>
        <WizardFacilityMatchList
          key={
            isStreaming
              ? 'streaming'
              : `done-${parsed.items.map((item) => item.title).join('|')}`
          }
          intro={parsed.intro}
          items={parsed.items}
          searchContext={searchContext}
          expandFirst={false}
          onFacilityExpand={onFacilityExpand}
          listRef={matchListRef}
        />
      </div>
    )
  }

  if (isStreaming || looksLikeTop3AssistantReply(formattedText)) {
    return (
      <div className={styles.assistantText}>
        <span className={styles.typing}>Finding your top matches…</span>
      </div>
    )
  }

  return (
    <div className={`${styles.assistantText} ${styles.assistantTextFallback}`}>
      {renderMarkdownText(formattedText)}
    </div>
  )
}

function RegistrationPrompt({
  zipCode = '',
  careType = 'assisted',
  monthlyBudget = null,
  location = '',
  urgency = '',
  assistantReply = '',
  resultSnapshot = null,
  onLeadCaptured,
}) {
  const [contact, setContact] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [emailMagicLink, setEmailMagicLink] = useState('')
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const focusedRef = useRef(false)
  const typingStartedRef = useRef(false)
  const careTypeLabel =
    CARE_TYPE_OPTIONS.find((option) => option.value === careType)?.label || 'Assisted living'

  const sendLink = async () => {
    if (!contact.trim() || isSendingEmail) return

    const authProps = {
      auth_surface: 'homepage_wizard',
      form_id: 'homepage_wizard_registration',
    }

    trackAuthFormSubmitted({
      ...authProps,
      email_length_bucket: emailLengthBucket(contact.trim().length),
    })

    setIsSendingEmail(true)
    setEmailStatus('Sending your secure link...')
    setEmailMagicLink('')

    try {
      const resolvedLocation =
        zipCode.length === 5
          ? resolveLocationFromZip(zipCode, location || 'Massachusetts')
          : location || 'Massachusetts'
      const snapshot =
        resultSnapshot ||
        buildWizardSearchSnapshot({
          zipCode,
          careType,
          monthlyBudget,
          location: resolvedLocation,
          replyText: assistantReply,
          urgency,
        })

      if (typeof window !== 'undefined' && snapshot) {
        window.localStorage.setItem(PENDING_SNAPSHOT_KEY, JSON.stringify(snapshot))
      }

      const res = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contact.trim(),
          zip: zipCode,
          facilityType: careTypeLabel,
          location: resolvedLocation,
          resultSnapshot: snapshot,
          authSurface: 'homepage_wizard',
          redirectTo: '/results',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = data.error || 'Could not send link. Please try again.'
        setEmailStatus(message)
        trackAuthMagicLinkRequestFailed({
          ...authProps,
          error_message: message,
        })
        return
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('assistedly_email', contact.trim())
      }

      trackAuthMagicLinkSent({
        ...authProps,
        email_delivery_sent: Boolean(data.sent),
        test_mode: Boolean(data.magicLink),
      })

      setEmailStatus(
        data.sent
          ? 'Check your inbox for your secure sign-in link.'
          : "Email delivery isn't configured yet. Use the direct sign-in link below."
      )
      setEmailMagicLink(String(data.magicLink || ''))
      onLeadCaptured?.()
    } catch {
      setEmailStatus('Could not send link. Please try again.')
      trackAuthMagicLinkRequestFailed({
        ...authProps,
        error_message: 'network_error',
      })
    } finally {
      setIsSendingEmail(false)
    }
  }

  const hasEmailError = Boolean(emailStatus) && /could not|valid email|required|invalid/i.test(emailStatus)

  return (
    <div className={styles.registrationPrompt}>
      <input type="checkbox" id="email-consent" name="email-consent" required /><label htmlFor="email-consent">I agree to receive emails, including a password-less login link, for more data on Massachusetts assisted-living facilities.</label>
      <p className={styles.registrationCopy}>Enter your email to receive a free, passwordless sign-in link.</p>
      <div className={styles.authInputRow}>
        <input
          className={styles.textInput}
          type="email"
          inputMode="email"
          placeholder="Email address"
          value={contact}
          onFocus={() => {
            if (focusedRef.current) return
            focusedRef.current = true
            trackAuthEmailFocused({
              auth_surface: 'homepage_wizard',
              form_id: 'homepage_wizard_registration',
            })
          }}
          onChange={(e) => {
            const next = e.target.value
            setContact(next)
            if (!typingStartedRef.current && next.trim().length > 0) {
              typingStartedRef.current = true
              trackAuthEmailTypingStarted({
                auth_surface: 'homepage_wizard',
                form_id: 'homepage_wizard_registration',
                email_length_bucket: emailLengthBucket(next.trim().length),
              })
            }
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') sendLink() }}
        />
        <button
          type="button"
          className={styles.registrationButtonPrimary}
          disabled={!contact.trim() || isSendingEmail}
          onClick={sendLink}
        >
          {isSendingEmail ? 'Sending...' : 'Send magic link'}
        </button>
      </div>
      {emailStatus ? (
        <p className={`${styles.registrationStatus} ${hasEmailError ? styles.registrationError : ''}`}>
          {emailStatus}
        </p>
      ) : null}
    </div>
  )
}

function FailureFollowUpPrompt({
  contact,
  disabled,
  onChange,
  onSend,
  status,
}) {
  const hasError = Boolean(status) && /could not|valid|required|again/i.test(status)

  return (
    <div className={styles.registrationPrompt}>
      <p className={styles.registrationTitle}>
        Oh no! Our AI has gone AWOL. I&apos;m alerting our humans now! Do you want me to email or text you when it&apos;s fixed?
      </p>
      <div className={styles.authInputRow}>
        <input
          className={styles.textInput}
          type="text"
          inputMode="email"
          placeholder="Phone number or email address"
          value={contact}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend()
          }}
        />
        <button
          type="button"
          className={styles.registrationButtonPrimary}
          disabled={disabled || !contact.trim()}
          onClick={onSend}
        >
          {disabled ? 'SENDING…' : 'SEND'}
        </button>
      </div>
      {status ? (
        <p className={`${styles.registrationStatus} ${hasError ? styles.registrationError : ''}`}>
          {status}
        </p>
      ) : null}
    </div>
  )
}

function applyResolvedWizardFields(prefilledVariables) {
  return resolveWizardFields(prefilledVariables)
}

export function AssistedlyWizard({
  prefilledVariables = {},
  homepage_layout = '',
  assistantEngaged = false,
  onEngagedChange,
}) {
  const analyticsContext = useMemo(
    () => ({
      homepage_layout,
      assistant_mode: 'assistedly_wizard',
      bot_id: 'homepage-assistedly-wizard',
      bot_surface: 'homepage',
      lead_source: 'homepage_wizard_assistant',
    }),
    [homepage_layout],
  )
  const { trackMessageSent, trackChatCompleted } = useChatAnalytics(analyticsContext)
  const [userId] = useState(() => getOrCreateUserId())

  const [step, setStep] = useState('urgency')
  const [urgency, setUrgency] = useState(() => urgencyFromPrefill(prefilledVariables) || null)

  const [lines, setLines] = useState(() => [
    {
      id: 'intro',
      type: 'bot',
      node: <UrgencyIntroBubble />,
    },
  ])

  const [customUserQuestion, setCustomUserQuestion] = useState('')
  const [customSearchLocation, setCustomSearchLocation] = useState('')
  const [pendingCustomUserQuestion, setPendingCustomUserQuestion] = useState(null)
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState(() =>
    formatBudgetFieldDisplay(applyResolvedWizardFields(prefilledVariables).monthly_budget)
  )
  const [monthlyBudget, setMonthlyBudget] = useState(() =>
    parseBudget(applyResolvedWizardFields(prefilledVariables).monthly_budget)
  )
  const [zipCode, setZipCode] = useState(() =>
    normalizeZip(applyResolvedWizardFields(prefilledVariables).zip_code)
  )
  const [difyLocation, setDifyLocation] = useState(() =>
    applyResolvedWizardFields(prefilledVariables).location
  )
  const [careType, setCareType] = useState(() =>
    applyResolvedWizardFields(prefilledVariables).care_type
  )
  const [failureContact, setFailureContact] = useState(() => getStoredContact())
  const [failureContactStatus, setFailureContactStatus] = useState('')
  const [sendingFailureContact, setSendingFailureContact] = useState(false)

  const [conversationId, setConversationId] = useState()
  const [wizardComplete, setWizardComplete] = useState(false)
  const [wizardRegistrationComplete, setWizardRegistrationComplete] = useState(false)
  const [facilityRowExpanded, setFacilityRowExpanded] = useState(false)
  const [wizardResultSnapshot, setWizardResultSnapshot] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /** Wizard scroll container — avoid `scrollIntoView` on the window when the thread alone should move. */
  const wizardMainRef = useRef(null)
  const mainScrollRef = useRef(null)
  const budgetComposerRef = useRef(null)
  const budgetChartRef = useRef(null)
  const zipInputRef = useRef(null)
  const careTypeSelectRef = useRef(null)
  const customUserComposerRef = useRef(null)
  const customLocationComposerRef = useRef(null)
  const registrationPanelRef = useRef(null)
  const matchListRef = useRef(null)
  const scrollRafRef = useRef(0)
  const pinFirstMatchRef = useRef(false)
  const facilityRowExpandedRef = useRef(false)
  const streamAccRef = useRef('')
  const streamFlushRafRef = useRef(0)
  const reportedErrorRef = useRef('')
  const chatPrefetchedRef = useRef(false)
  const budgetTouchedRef = useRef(false)
  const wizardPathExposureRef = useRef(false)

  const applyResolvedBudgetFields = useCallback((fields, { resetTouched = false } = {}) => {
    if (resetTouched) budgetTouchedRef.current = false
    const parsed = parseBudget(fields.monthly_budget)
    setZipCode(normalizeZip(fields.zip_code))
    setCareType(fields.care_type)
    setMonthlyBudgetInput(formatBudgetFieldDisplay(fields.monthly_budget))
    setMonthlyBudget(parsed)
    if (fields.location) setDifyLocation(fields.location)
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = mainScrollRef.current
    if (!el) return
    const run = () => {
      scrollRafRef.current = 0
      if (pinFirstMatchRef.current) return
      if (facilityRowExpandedRef.current) return
      const current = mainScrollRef.current
      if (current) current.scrollTop = current.scrollHeight
    }
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = window.requestAnimationFrame(run)
      return
    }
    run()
  }, [])

  const cancelPendingScrollToBottom = useCallback(() => {
    if (scrollRafRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = 0
    }
  }, [])

  const scrollToFirstMatch = useCallback(() => {
    const viewport = mainScrollRef.current
    if (!viewport) return false

    const listRoot =
      matchListRef.current ||
      viewport.querySelector('[data-wizard-match-list]')
    const firstRow =
      listRoot?.querySelector('[data-wizard-match-row="0"]') ||
      listRoot?.querySelector('[data-wizard-first-match]')
    const scrollTarget =
      firstRow?.querySelector('[data-wizard-first-match-toggle]') ||
      firstRow?.querySelector('button[aria-expanded]') ||
      firstRow
    if (!scrollTarget) return false

    cancelPendingScrollToBottom()

    const padding = 8
    const top =
      scrollTarget.getBoundingClientRect().top -
      viewport.getBoundingClientRect().top +
      viewport.scrollTop
    viewport.scrollTop = Math.max(0, top - padding)
    return true
  }, [cancelPendingScrollToBottom])

  const handleFacilityExpand = useCallback(() => {
    cancelPendingScrollToBottom()
    setFacilityRowExpanded(true)
  }, [cancelPendingScrollToBottom])

  const shouldPinFirstMatch = useMemo(() => {
    if (facilityRowExpanded || wizardRegistrationComplete) return false
    if (wizardComplete) return true
    return lines.some(assistantLineHasMatchList)
  }, [facilityRowExpanded, lines, wizardComplete, wizardRegistrationComplete])

  useEffect(() => {
    pinFirstMatchRef.current = shouldPinFirstMatch
    facilityRowExpandedRef.current = facilityRowExpanded
  }, [shouldPinFirstMatch, facilityRowExpanded])

  const pinFirstMatchInViewport = useCallback(() => {
    if (!shouldPinFirstMatch) return false
    return scrollToFirstMatch()
  }, [scrollToFirstMatch, shouldPinFirstMatch])

  const schedulePinFirstMatchRef = useRef(() => {})

  const schedulePinFirstMatch = useCallback(() => {
    if (typeof window === 'undefined') return
    cancelPendingScrollToBottom()
    let attempts = 0
    let rafId = 0
    const tryPin = () => {
      if (pinFirstMatchInViewport()) return
      if (attempts++ < 40) rafId = requestAnimationFrame(tryPin)
    }
    tryPin()
    requestAnimationFrame(() => {
      pinFirstMatchInViewport()
      requestAnimationFrame(() => pinFirstMatchInViewport())
    })
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [cancelPendingScrollToBottom, pinFirstMatchInViewport])

  useEffect(() => {
    schedulePinFirstMatchRef.current = schedulePinFirstMatch
  }, [schedulePinFirstMatch])

  const revealComposerPanel = useCallback(
    (panelRef, { focusElement = null, focus = true, block = 'end' } = {}) => {
      const panel = panelRef?.current
      if (!panel) return
      revealFocusTarget(panel, {
        scrollRoot: wizardMainRef.current,
        pageAnchorId: 'assistant',
        focus,
        focusElement,
        block,
        padding: 16,
      })
    },
    []
  )

  // Pin first facility row as soon as listings render; block scroll-to-bottom until expand.
  useIsomorphicLayoutEffect(() => {
    if (!shouldPinFirstMatch) return
    return schedulePinFirstMatch()
  }, [
    lines,
    loading,
    schedulePinFirstMatch,
    shouldPinFirstMatch,
    wizardComplete,
  ])

  // Scroll thread on updates unless listings are pinned to row 0 or user expanded a match.
  useEffect(() => {
    if (shouldPinFirstMatch) return
    if (wizardComplete && facilityRowExpanded) return
    scrollToBottom()
  }, [
    error,
    facilityRowExpanded,
    lines,
    loading,
    scrollToBottom,
    shouldPinFirstMatch,
    step,
    wizardComplete,
    wizardRegistrationComplete,
  ])

  // Re-pin when results finish loading (DOM + match list ref settle after stream).
  useEffect(() => {
    if (!wizardComplete || loading || facilityRowExpanded) return
    return schedulePinFirstMatch()
  }, [facilityRowExpanded, loading, schedulePinFirstMatch, wizardComplete])

  useEffect(
    () => () => {
      if (scrollRafRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(scrollRafRef.current)
      }
      if (streamFlushRafRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(streamFlushRafRef.current)
      }
    },
    []
  )

  useEffect(() => {
    if (!error) return
    const signature = [error, conversationId || '', userId].join('::')
    if (reportedErrorRef.current === signature) return
    reportedErrorRef.current = signature

    const controller = new AbortController()
    fetch('/api/chat-failure-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorMessage: error,
        userId,
        conversationId,
        currentUrl: typeof window !== 'undefined' ? window.location.href : '',
        stage: 'error',
      }),
      signal: controller.signal,
    }).catch(() => {})

    return () => controller.abort()
  }, [conversationId, error, userId])

  const engageAssistant = useCallback(() => {
    onEngagedChange?.(true)
  }, [onEngagedChange])

  useEffect(() => {
    onEngagedChange?.(Boolean(urgency))
  }, [urgency, onEngagedChange])

  const applyBudgetFields = useCallback(() => {
    if (step !== 'urgency' || !prefilledVariables) return
    applyResolvedBudgetFields(resolveWizardFields(prefilledVariables))
  }, [applyResolvedBudgetFields, prefilledVariables, step])

  useEffect(() => {
    applyBudgetFields()
  }, [applyBudgetFields])

  useEffect(() => {
    if (step !== 'budget' || budgetTouchedRef.current) return
    const normalizedZip = normalizeZip(zipCode)
    if (normalizedZip.length !== 5) return

    if (hasPinnedMonthlyBudget(prefilledVariables)) {
      const fields = resolveWizardFields(prefilledVariables)
      const parsed = parseBudget(fields.monthly_budget)
      if (parsed != null) {
        if (monthlyBudgetInput !== formatBudgetFieldDisplay(fields.monthly_budget)) {
          setMonthlyBudgetInput(formatBudgetFieldDisplay(fields.monthly_budget))
        }
        if (monthlyBudget !== parsed) {
          setMonthlyBudget(parsed)
        }
      }
      return
    }

    const suggested = suggestedMonthlyBudget(careType, normalizedZip)
    setMonthlyBudgetInput(formatBudgetFieldDisplay(String(suggested)))
    setMonthlyBudget(suggested)
  }, [careType, prefilledVariables, step, zipCode])

  const buildDifyInputs = useCallback(
    (extra = {}) => {
      const location =
        (typeof extra?.Location === 'string' && extra.Location.trim()) ||
        difyLocation ||
        (zipCode.length === 5 ? `ZIP ${zipCode}, MA` : '')

      const merged = {
        ...(urgency ? { how_urgent: formatHowUrgentPhrase(urgency) } : {}),
        ...(monthlyBudget != null ? { monthly_budget: monthlyBudget } : {}),
        ...(location ? { Location: location } : {}),
        ...(zipCode ? { zip_code: zipCode } : {}),
        ...(careType ? { care_type: careType } : {}),
        ...extra,
      }
      return Object.fromEntries(
        Object.entries(merged).filter(
          ([, value]) =>
            value != null && (typeof value === 'number' || String(value).trim() !== '')
        )
      )
    },
    [careType, difyLocation, monthlyBudget, urgency, zipCode]
  )

  const runDifyQuery = useCallback(
    async (composedQuery, inputs) => {
      setLoading(true)
      setError(null)
      const assistantId = uid()
      streamAccRef.current = ''
      const kbFacilitiesRef = { current: [] }
      setLines((prev) => [...prev, { id: assistantId, type: 'assistant', text: '' }])

      const flushStreamedText = (force = false) => {
        const apply = () => {
          streamFlushRafRef.current = 0
          const text = normalizeFastTop3AnswerIntro(streamAccRef.current)
          setLines((prev) => prev.map((l) => (l.id === assistantId ? { ...l, text } : l)))
          if (
            text &&
            (kbFacilitiesRef.current.length > 0 ||
              parseAssistantMatches(normalizeMonthlyBudgetText(text)))
          ) {
            scheduleAfterPaint(() => schedulePinFirstMatchRef.current())
          }
        }
        if (force) {
          if (streamFlushRafRef.current && typeof window !== 'undefined') {
            window.cancelAnimationFrame(streamFlushRafRef.current)
          }
          streamFlushRafRef.current = 0
          apply()
          return
        }
        if (streamFlushRafRef.current || typeof window === 'undefined') {
          apply()
          return
        }
        streamFlushRafRef.current = window.requestAnimationFrame(apply)
      }

      let acc = ''
      let difyAcc = ''
      const resolvedInputs = inputs ?? buildDifyInputs()
      const chatEngine = await prefetchChatEngine()
      const useNativeTop3Preview = !isDifyChatEngine(chatEngine)
      if (useNativeTop3Preview) {
        const instantPreview = buildCompleteNativeTop3Reply(composedQuery, resolvedInputs)
        if (instantPreview && replyIncludesTop3Matches(instantPreview)) {
          acc = instantPreview
          streamAccRef.current = normalizeFastTop3AnswerIntro(instantPreview)
          flushStreamedText(true)
        }
      }

      let kbFacilitiesForLine = []
      try {
        const streamResult = await streamDifyChatResponse(
          composedQuery,
          userId,
          conversationId ?? '',
          {
            onDelta: (d) => {
              difyAcc += d
              if (replyIncludesTop3Matches(difyAcc)) {
                acc = difyAcc
                streamAccRef.current = normalizeFastTop3AnswerIntro(difyAcc)
                flushStreamedText()
              }
            },
            onFinal: (full) => {
              difyAcc = full
              if (replyIncludesTop3Matches(full)) {
                acc = full
                streamAccRef.current = normalizeFastTop3AnswerIntro(full)
                flushStreamedText(true)
              }
            },
            onKbFacilities: (items) => {
              kbFacilitiesRef.current = items
              kbFacilitiesForLine = items
              setLines((prev) =>
                prev.map((l) =>
                  l.id === assistantId ? { ...l, kbFacilities: items } : l
                )
              )
              scheduleAfterPaint(() => schedulePinFirstMatchRef.current())
            },
            onConversationId: (cid) => setConversationId(cid),
            onStreamError: (m) => setError(m),
          },
          resolvedInputs
        )
        const finalText =
          typeof streamResult === 'string' ? streamResult : streamResult?.answer || ''
        if (streamResult?.kbFacilities?.length) {
          kbFacilitiesForLine = streamResult.kbFacilities
        }
        let safeReply = normalizeFastTop3AnswerIntro(normalizeAssistantHtml(finalText || difyAcc || acc).trim())
        if (useNativeTop3Preview && !replyIncludesTop3Matches(safeReply)) {
          const rebuilt = buildCompleteNativeTop3Reply(composedQuery, resolvedInputs)
          if (rebuilt) safeReply = rebuilt
        }
        if (!safeReply && useNativeTop3Preview) {
          safeReply =
            buildLocalFacilityChatFallback(composedQuery, resolvedInputs) ||
            EMPTY_ASSISTANT_FALLBACK
        }
        if (!safeReply) {
          safeReply = EMPTY_ASSISTANT_FALLBACK
        }
        if (!safeReply.trim()) {
          throw new Error('Facility recommendations did not load. Please try again.')
        }
        const resultLocation =
          String(resolvedInputs?.Location || resolvedInputs?.location || difyLocation || '').trim() ||
          (zipCode.length === 5 ? resolveLocationFromZip(zipCode) : 'Massachusetts')
        setWizardResultSnapshot(
          buildWizardSearchSnapshot({
            zipCode: zipCode.length === 5 ? zipCode : '',
            careType,
            monthlyBudget,
            location: resultLocation,
            replyText: safeReply,
            kbFacilities: kbFacilitiesForLine,
            urgency,
          })
        )
        setLines((prev) =>
          prev.map((l) =>
            l.id === assistantId
              ? { ...l, text: safeReply, kbFacilities: kbFacilitiesForLine }
              : l
          )
        )
        setWizardComplete(true)
        setStep('idle')
        scheduleAfterPaint(() => schedulePinFirstMatchRef.current())
        trackChatCompleted({
          homepage_layout,
          zip_code: zipCode.length === 5 ? zipCode : undefined,
          care_type:
            CARE_TYPE_OPTIONS.find((option) => option.value === careType)?.label ||
            careType,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg)
        setLines((prev) => prev.filter((l) => l.id !== assistantId))
      } finally {
        setLoading(false)
      }
    },
    [buildDifyInputs, conversationId, careType, difyLocation, homepage_layout, monthlyBudget, trackChatCompleted, urgency, userId, zipCode]
  )

  const pickUrgency = useCallback(
    (label) => {
      // Always collect budget/location immediately after urgency. The previous
      // PostHog scenarios-first experiment created a duplicate path where some
      // sessions saw budget/location and then scenario choices before search.
      // Keep reading/capturing the variant only for analytics continuity, but do
      // not let it change wizard control flow.
      const activeVariant = readWizardPathVariantFromPostHog()

      setUrgency(label)
      engageAssistant()
      applyResolvedBudgetFields(resolveWizardFields(prefilledVariables), { resetTouched: true })

      if (!wizardPathExposureRef.current) {
        wizardPathExposureRef.current = true
        captureWizardPathVariantShown(activeVariant, { homepage_layout })
      }

      scheduleAfterPaint(() => {
        trackMessageSent({
          percent_complete: 25,
          message_preview: label,
          step_id: 'urgency',
          wizard_path_variant: activeVariant,
        })
      })

      setLines((prev) => [
        ...prev,
        { id: uid(), type: 'user', text: label },
        {
          id: uid(),
          type: 'bot',
          node: <BudgetIntroBubble />,
        },
      ])
      setStep('budget')
      prefetchChatRoute()
    },
    [
      applyResolvedBudgetFields,
      engageAssistant,
      homepage_layout,
      prefilledVariables,
      trackMessageSent,
    ]
  )

  const handleBudgetChartSelect = useCallback((value) => {
    budgetTouchedRef.current = true
    setMonthlyBudgetInput(formatBudgetFieldDisplay(value))
    setMonthlyBudget(value)
  }, [])

  const submitBudget = useCallback(() => {
    const parsedBudget = parseBudget(monthlyBudgetInput)
    const normalizedZip = normalizeZip(zipCode)
    if (!parsedBudget || normalizedZip.length !== 5 || loading) return
    engageAssistant()
    scheduleAfterPaint(() => {
      trackMessageSent({
        percent_complete: 50,
        message_preview: 'budget_and_zip_submitted',
        step_id: 'budget',
        wizard_path_variant: readWizardPathVariantFromPostHog(),
      })
    })
    setMonthlyBudget(parsedBudget)
    setZipCode(normalizedZip)
    scheduleAfterPaint(() => {
      writeStoredWizardFields({
        monthly_budget: String(parsedBudget),
        zip_code: normalizedZip,
        care_type: careType,
      })
    })
    const careLabel = CARE_TYPE_OPTIONS.find((option) => option.value === careType)?.label || 'Assisted living'
    const location =
      normalizedZip.length === 5
        ? resolveLocationFromZip(normalizedZip, difyLocation || 'Massachusetts')
        : difyLocation || 'Massachusetts'
    setDifyLocation(location)

    const userBudgetLine = `${currency.format(parsedBudget)} per month • ZIP ${normalizedZip} • ${careLabel}`
    setLines((prev) => [...prev, { id: uid(), type: 'user', text: userBudgetLine }])
    setStep('idle')
    prefetchChatRoute()
    void runDifyQuery(
      composeLocationSearchQuery({
        location,
        urgency,
        monthlyBudget: parsedBudget,
      }),
      buildDifyInputs({ Location: location })
    )
  }, [
    buildDifyInputs,
    careType,
    difyLocation,
    engageAssistant,
    loading,
    monthlyBudgetInput,
    runDifyQuery,
    trackMessageSent,
    urgency,
    zipCode,
  ])

  const submitCustomUserQuestion = useCallback(() => {
    const t = customUserQuestion.trim()
    if (!t || !urgency || loading) return
    engageAssistant()
    trackMessageSent({
      percent_complete: 60,
      text: t,
      step_id: 'custom_user',
    })
    setPendingCustomUserQuestion(t)
    setLines((prev) => [...prev, { id: uid(), type: 'user', text: t }])
    setCustomUserQuestion('')
    setStep('customLocation')
    scrollToBottom()
  }, [customUserQuestion, engageAssistant, loading, scrollToBottom, trackMessageSent, urgency])

  const submitCustomSearchLocation = useCallback(() => {
    const loc = customSearchLocation.trim()
    const userQ = pendingCustomUserQuestion?.trim()
    if (!loc || !urgency || loading || !userQ) return

    engageAssistant()
    scheduleAfterPaint(() => {
      trackMessageSent({
        percent_complete: 70,
        text: loc,
        step_id: 'custom_location',
      })
    })
    setDifyLocation(loc)
    setLines((prev) => [...prev, { id: uid(), type: 'user', text: loc }])
    setCustomSearchLocation('')
    setPendingCustomUserQuestion(null)
    setStep('idle')
    void runDifyQuery(composeCustomListQuery(userQ, loc, urgency, monthlyBudget), buildDifyInputs({
      Location: loc,
    }))
  }, [buildDifyInputs, customSearchLocation, engageAssistant, loading, monthlyBudget, pendingCustomUserQuestion, runDifyQuery, trackMessageSent, urgency])

  const handleWizardRegistrationComplete = useCallback(() => {
    setWizardRegistrationComplete(true)
    trackChatCompleted(
      {
        homepage_layout,
        zip_code: zipCode.length === 5 ? zipCode : undefined,
        care_type:
          CARE_TYPE_OPTIONS.find((option) => option.value === careType)?.label ||
          careType,
        contact_method: 'email',
      },
      { leadOnly: true },
    )
  }, [careType, homepage_layout, trackChatCompleted, zipCode])

  const sendFailureFollowUp = useCallback(async () => {
    const trimmed = failureContact.trim()
    if (!trimmed || sendingFailureContact) return
    if (!isValidPhoneOrEmail(trimmed)) {
      setFailureContactStatus('Enter a valid phone number or email address.')
      return
    }

    setSendingFailureContact(true)
    setFailureContactStatus('Sending your info to our humans...')

    try {
      const res = await fetch('/api/chat-failure-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: trimmed,
          errorMessage: error,
          userId,
          conversationId,
          currentUrl: typeof window !== 'undefined' ? window.location.href : '',
          stage: 'contact_followup',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFailureContactStatus(data.error || 'Could not save your contact info. Please try again.')
        return
      }

      if (EMAIL_RE.test(trimmed) && typeof window !== 'undefined') {
        window.localStorage.setItem(EMAIL_STORAGE_KEY, trimmed)
      }
      setFailureContactStatus('Got it — we’ll email or text you when it’s fixed.')
    } catch {
      setFailureContactStatus('Could not save your contact info. Please try again.')
    } finally {
      setSendingFailureContact(false)
    }
  }, [conversationId, error, failureContact, sendingFailureContact, userId])

  const resetAll = useCallback(() => {
    setStep('urgency')
    const prefilledUrgency = urgencyFromPrefill(prefilledVariables) || null
    setUrgency(prefilledUrgency)
    const fields = resolveWizardFields(prefilledVariables)
    applyResolvedBudgetFields(fields, { resetTouched: true })
    onEngagedChange?.(Boolean(prefilledUrgency))
    setLines([
      {
        id: uid(),
        type: 'bot',
        node: <UrgencyIntroBubble />,
      },
    ])
    setCustomUserQuestion('')
    setCustomSearchLocation('')
    setPendingCustomUserQuestion(null)
    setFailureContact(getStoredContact())
    setFailureContactStatus('')
    setSendingFailureContact(false)
    reportedErrorRef.current = ''
    setConversationId(undefined)
    wizardPathExposureRef.current = false
    setWizardComplete(false)
    setWizardRegistrationComplete(false)
    setFacilityRowExpanded(false)
    setWizardResultSnapshot(null)
    setError(null)
  }, [applyResolvedBudgetFields, onEngagedChange, prefilledVariables])

  const parsedBudgetForStep = parseBudget(monthlyBudgetInput)
  const normalizedZipForStep = normalizeZip(zipCode)
  const canSubmitBudgetStep =
    !loading && parsedBudgetForStep != null && normalizedZipForStep.length === 5
  const usesComposerLayout =
    step === 'budget' || step === 'customUser' || step === 'customLocation'
  const latestAssistantReply =
    lines
      .filter((line) => line.type === 'assistant' && typeof line.text === 'string' && line.text.trim())
      .at(-1)?.text || ''

  const wizardSearchContext = useMemo(
    () => ({
      careType,
      monthlyBudget,
      zipCode: normalizedZipForStep,
      location: difyLocation,
      urgency,
    }),
    [careType, monthlyBudget, normalizedZipForStep, difyLocation, urgency],
  )

  const streamingAssistantId = loading
    ? lines.filter((line) => line.type === 'assistant').at(-1)?.id
    : null

  useEffect(() => {
    if (step !== 'budget' || !canSubmitBudgetStep || chatPrefetchedRef.current) return
    chatPrefetchedRef.current = true
    prefetchChatRoute()
  }, [canSubmitBudgetStep, step])

  useEffect(() => {
    if (step !== 'budget') return
    revealComposerPanel(budgetComposerRef, {
      focusElement:
        normalizedZipForStep.length === 5 ? careTypeSelectRef.current : zipInputRef.current,
    })
  }, [lines.length, normalizedZipForStep.length, revealComposerPanel, step])

  useEffect(() => {
    if (step !== 'budget' || normalizedZipForStep.length !== 5) return
    revealFocusTarget(budgetChartRef.current || budgetComposerRef.current, {
      scrollRoot: wizardMainRef.current,
      pageAnchorId: 'assistant',
      focus: false,
      block: 'nearest',
      padding: 12,
    })
  }, [careType, normalizedZipForStep, step])

  useEffect(() => {
    if (step === 'customUser') {
      revealComposerPanel(customUserComposerRef, { block: 'end' })
      return
    }
    if (step === 'customLocation') {
      revealComposerPanel(customLocationComposerRef, { block: 'end' })
    }
  }, [lines.length, revealComposerPanel, step])

  return (
    <div
      className={`${styles.shell} ${assistantEngaged ? styles.shellEngaged : ''}`}
    >
      <main
        ref={wizardMainRef}
        className={`${styles.main} ${usesComposerLayout ? styles.mainComposerStep : ''}`}
      >
        <div
          ref={mainScrollRef}
          className={`${styles.scrollViewport} ${assistantEngaged ? styles.scrollViewportEngaged : ''}`}
          aria-label="Conversation"
          tabIndex={0}
        >
          <div className={styles.thread}>
          {lines.map((line) => {
            if (line.type === 'user') {
              return (
                <div key={line.id} className={styles.userColumn}>
                  <div className={styles.userBubble}>{line.text}</div>
                </div>
              )
            }
            if (line.type === 'bot') {
              return (
                <div key={line.id} className={styles.botLine}>
                  <BotAvatar />
                  <div className={styles.botBubble}>{line.node}</div>
                </div>
              )
            }
            return (
              <div key={line.id} className={styles.botLine}>
                <BotAvatar />
                <div className={styles.botBubble}>
                  {line.text ? (
                    <AssistantText
                      text={line.text}
                      kbFacilities={line.kbFacilities}
                      searchContext={wizardSearchContext}
                      isStreaming={line.id === streamingAssistantId}
                      onFacilityExpand={handleFacilityExpand}
                      matchListRef={matchListRef}
                    />
                  ) : loading ? (
                    <span className={styles.typing}>…</span>
                  ) : (
                    ''
                  )}
                </div>
              </div>
            )
          })}
          </div>
        </div>

        <div className={styles.bottomBar}>
          {step === 'urgency' && (
            <div className={styles.quickReplies}>
            {URGENCY_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={styles.choiceBtn}
                disabled={loading}
                onClick={() => void pickUrgency(opt)}
              >
                {opt}
              </button>
            ))}
            </div>
          )}

          {step === 'budget' && (
            <div
              ref={budgetComposerRef}
              id="assistedly-wizard-composer"
              className={`${styles.composer} scrollRevealTarget`}
            >
              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Monthly budget</span>
                <input
                  className={styles.textInput}
                  inputMode="numeric"
                  placeholder="$10,000"
                  value={monthlyBudgetInput}
                  disabled={loading}
                  onFocus={() => {
                    engageAssistant()
                    prefetchChatRoute()
                    const parsed = parseBudget(monthlyBudgetInput)
                    if (parsed != null) setMonthlyBudgetInput(String(parsed))
                  }}
                  onBlur={() => {
                    const parsed = parseBudget(monthlyBudgetInput)
                    setMonthlyBudgetInput(parsed != null ? formatBudgetFieldDisplay(parsed) : '')
                    setMonthlyBudget(parsed)
                  }}
                  onChange={(e) => {
                    budgetTouchedRef.current = true
                    const digits = e.target.value.replace(/[^\d]/g, '')
                    setMonthlyBudgetInput(digits)
                    setMonthlyBudget(parseBudget(digits))
                  }}
                />
              </label>
              <div className={styles.inputRow}>
                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>ZIP code</span>
                  <input
                    ref={zipInputRef}
                    className={styles.textInput}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="01801"
                    value={zipCode}
                    disabled={loading}
                    onFocus={() => {
                      engageAssistant()
                      prefetchChatRoute()
                    }}
                    onChange={(e) => setZipCode(normalizeZip(e.target.value))}
                  />
                </label>
                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Type of care</span>
                  <select
                    ref={careTypeSelectRef}
                    className={styles.textInput}
                    value={careType}
                    disabled={loading}
                    onFocus={() => {
                      engageAssistant()
                      prefetchChatRoute()
                    }}
                    onChange={(e) => setCareType(e.target.value)}
                  >
                    {CARE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div ref={budgetChartRef} className={`${styles.budgetChartWrap} scrollRevealTarget`}>
                <BudgetRangeChart
                  monthlyBudget={monthlyBudgetInput}
                  zipCode={normalizedZipForStep}
                  careType={careType}
                  onBudgetChange={handleBudgetChartSelect}
                />
              </div>
              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.sendBtn}
                  disabled={!canSubmitBudgetStep}
                  onClick={submitBudget}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {error && (
            <FailureFollowUpPrompt
              contact={failureContact}
              disabled={sendingFailureContact}
              onChange={(value) => {
                setFailureContact(value)
                if (failureContactStatus) setFailureContactStatus('')
              }}
              onSend={() => void sendFailureFollowUp()}
              status={failureContactStatus}
            />
          )}

          {step === 'customUser' && (
            <div ref={customUserComposerRef} className={`${styles.composer} scrollRevealTarget`}>
              <textarea
                className={styles.textarea}
                placeholder={CUSTOM_USER_PLACEHOLDER}
                value={customUserQuestion}
                disabled={loading}
                onFocus={engageAssistant}
                onChange={(e) => setCustomUserQuestion(e.target.value)}
              />
              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.sendBtn}
                  disabled={loading || !customUserQuestion.trim()}
                  onClick={submitCustomUserQuestion}
                >
                  Help Me
                </button>
              </div>
            </div>
          )}

          {step === 'customLocation' && (
            <div ref={customLocationComposerRef} className={`${styles.composer} scrollRevealTarget`}>
              <div className={styles.inputRow}>
                <input
                  className={styles.textInput}
                  placeholder={CUSTOM_SEARCH_PLACEHOLDER}
                  value={customSearchLocation}
                  disabled={loading}
                  onFocus={() => {
                    engageAssistant()
                    prefetchChatRoute()
                  }}
                  onChange={(e) => setCustomSearchLocation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void submitCustomSearchLocation()
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.sendBtn}
                  disabled={loading || !customSearchLocation.trim()}
                  onClick={() => void submitCustomSearchLocation()}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {wizardComplete && facilityRowExpanded ? (
            <>
              {!wizardRegistrationComplete ? (
                <div ref={registrationPanelRef} className="scrollRevealTarget">
                  <RegistrationPrompt
                  zipCode={normalizedZipForStep}
                  careType={careType}
                  monthlyBudget={monthlyBudget}
                  urgency={urgency || ''}
                  assistantReply={latestAssistantReply}
                  location={
                    normalizedZipForStep.length === 5
                      ? resolveLocationFromZip(
                          normalizedZipForStep,
                          difyLocation || customSearchLocation || 'Massachusetts'
                        )
                      : difyLocation || customSearchLocation
                  }
                  resultSnapshot={wizardResultSnapshot}
                  onLeadCaptured={handleWizardRegistrationComplete}
                />
                </div>
              ) : (
                <ResultsSatisfactionPrompt
                  surface="homepage_wizard"
                  context={{
                    homepage_layout,
                    zip_code: normalizedZipForStep.length === 5 ? normalizedZipForStep : undefined,
                    care_type:
                      CARE_TYPE_OPTIONS.find((option) => option.value === careType)?.label ||
                      careType,
                    wizard_path_variant: readWizardPathVariantFromPostHog(),
                  }}
                />
              )}
              <div className={styles.actionsRow}>
                <button type="button" className={styles.ghostBtn} disabled={loading} onClick={resetAll}>
                  Start over
                </button>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
