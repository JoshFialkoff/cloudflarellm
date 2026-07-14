'use client'

import { memo, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import {
  composeCustomListQuery,
  composePresetListQuery,
  formatMonthlyBudget,
  locationHintFromPresetScenario,
  presetScenarioContextFromChoice,
  urgencyFromPrefill,
} from '../lib/composeAssistedlyQuery'
import {
  buildCompleteNativeTop3Reply,
  buildLocalFacilityChatFallback,
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
  trackWizardSavePromptShown,
  trackWizardSaveStarted,
  trackWizardSaveSuccess,
  trackWizardSaveFailed,
  trackWizardRestoreAttempted,
  trackWizardRestoreSuccess,
  trackWizardRestoreFailed,
} from '../lib/authAnalytics'
import { normalizeAssistantHtml, streamDifyChatResponse } from '../lib/streamDifyChat'
import { suggestedMonthlyBudget } from '../lib/careCostEstimate'
import {
  hasPinnedMonthlyBudget,
  resolveWizardFields,
  writeStoredWizardFields,
} from '../lib/wizardFieldDefaults'
import posthog from '../lib/posthogClient'
import {
  getSavedWizardState,
  setSavedWizardState,
  clearSavedWizardState,
  hasValidSavedState,
} from '../lib/wizardSaveRestore'
import {
  WIZARD_BUDGET_SCENARIOS_EXPERIMENT_FLAG,
  WIZARD_PATH_VARIANT,
  captureWizardPathVariantShown,
  readWizardPathVariantFromPostHog,
} from '../lib/wizardBudgetScenariosExperiment'
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

const COMMON_SCENARIOS_PROMPT =
  'Click on a common scenario or tell us how we can help you choose best assisted-living options:'

const CUSTOM_USER_PLACEHOLDER =
  "Tell me for whom you're looking for assisted living, how old they are and in what location they want to live."

const CUSTOM_SEARCH_PLACEHOLDER = 'Where do you want to search for assisted-living homes?'
const BUDGET_QUESTION = 'What is your budget?'
const BUDGET_MIN = 4000
const BUDGET_MAX = 18000
const CARE_TYPE_OPTIONS = [
  { value: 'assisted', label: 'Assisted living', low: 5500, high: 7600 },
  { value: 'memory', label: 'Memory care', low: 7800, high: 12500 },
  { value: 'skilled', label: 'Skilled nursing', low: 13000, high: 16500 },
]

const SCENARIO_OPTIONS = [
  '75 year-old woman with dementia in Winchester, MA',
  '82 year-old man in a wheelchair in Amherst, MA',
  '69 year-old in Stoneham with memory-loss',
  'Something else...',
]

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

function ScenarioIntroBubble() {
  return <p className={styles.scenariosLead}>{COMMON_SCENARIOS_PROMPT}</p>
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

function zipMultiplier(zipCode) {
  const zip = Number.parseInt(normalizeZip(zipCode), 10)
  if (!Number.isFinite(zip)) return 1
  if ((zip >= 2100 && zip <= 2499) || zip === 5501) return 1.18
  if (zip >= 1700 && zip <= 2099) return 1.08
  if (zip >= 1000 && zip <= 1699) return 0.96
  return 0.9
}

function estimateRange(careType, zipCode) {
  const care = CARE_TYPE_OPTIONS.find((option) => option.value === careType) || CARE_TYPE_OPTIONS[0]
  const multiplier = zipMultiplier(zipCode)
  return {
    low: Math.round(care.low * multiplier),
    high: Math.round(care.high * multiplier),
    careLabel: care.label,
  }
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
  const estimate = estimateRange(careType, zipCode)
  const lowPercent = budgetPercent(estimate.low)
  const highPercent = budgetPercent(estimate.high)
  const barWidth = Math.max(3, highPercent - lowPercent)
  const budgetValue = parseBudget(monthlyBudget)
  const sliderValue = budgetValue ?? Math.round(((estimate.low + estimate.high) / 2) / 100) * 100
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

  const handleTrackWheel = (event) => {
    if (!canSetBudget) return
    const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (!dominantDelta) return
    event.preventDefault()
    const direction = dominantDelta > 0 ? 1 : -1
    const nextBudget = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, sliderValue + direction * 100))
    if (nextBudget !== sliderValue) onBudgetChange(nextBudget)
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
        onWheel={canSetBudget ? handleTrackWheel : undefined}
      >
        <div ref={trackRef} className={styles.budgetChartTrack} aria-hidden="true">
          <span className={styles.budgetChartRange} style={{ left: `${lowPercent}%`, width: `${barWidth}%` }} />
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
            aria-label={`Monthly budget ${currency.format(sliderValue)}`}
            onChange={handleSliderInput}
            onInput={handleSliderInput}
          />
        ) : null}
      </div>
      <div className={styles.budgetChartScale}>
        <span>{currency.format(BUDGET_MIN)}</span>
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
  fetch('/api/chat', { method: 'GET', cache: 'no-store' }).catch(() => {})
}

function normalizeMonthlyBudgetText(text) {
  return text.replace(/\$(\d[\d,]*)(?:\s*\/\s*month|\s+per\s+month)/gi, (_match, rawAmount) =>
    formatMonthlyBudget(Number(String(rawAmount).replace(/\D/g, '')))
  )
}

const INTRO_PATTERNS = [
  /Based on your goal[\s\S]*?(?:here are your best options|best options)[:\s]*/i,
  /Here are the (?:best|strongest)[\s\S]*?:\s*/i,
]

function extractAssistantIntro(text) {
  for (const pattern of INTRO_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[0]) return match[0].trim()
  }
  const firstItem = text.search(/(?:^|\n)\s*\d+\)\s+/)
  if (firstItem <= 0) return ''
  return text
    .slice(0, firstItem)
    .replace(/\s*Top\s+\d+\s+matches:?\s*$/i, '')
    .trim()
}

function stripAssistantIntro(text) {
  let stripped = text
  for (const pattern of INTRO_PATTERNS) {
    stripped = stripped.replace(pattern, '')
  }
  return stripped.trim()
}

function parseMatchBlock(block) {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const title = (lines[0] ?? block).trim()
  let memoryCare
  let why

  for (const line of lines.slice(1)) {
    const memoryMatch = line.match(/^(?:\d+[.)]\s*|-\s*|•\s*)?(?:\*\*)?Memory care:(?:\*\*)?\s*(.+)$/i)
    const whyMatch = line.match(/^(?:\d+[.)]\s*|-\s*|•\s*)?(?:\*\*)?Why:(?:\*\*)?\s*(.+)$/i)
    if (memoryMatch) memoryCare = memoryMatch[1].trim()
    if (whyMatch) why = whyMatch[1].trim()
  }

  if (!memoryCare && !why) {
    const inline = block.match(/^(.*?)\s+-\s+Memory care:\s*(.*?)(?:\s+-\s+Why:\s*(.*))?$/is)
    if (inline) {
      return {
        title: inline[1].trim(),
        memoryCare: inline[2]?.trim(),
        why: inline[3]?.trim(),
      }
    }
    const sentence = block.match(/^(.*?)[.\s]+Memory care:\s*(.*?)(?:[.\s]+Why:\s*(.*))?\.?\s*$/is)
    if (sentence) {
      return {
        title: sentence[1].trim(),
        memoryCare: sentence[2]?.trim(),
        why: sentence[3]?.trim(),
      }
    }
  }

  return { title, memoryCare, why }
}

function parseAssistantMatches(text) {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return null

  const intro = extractAssistantIntro(normalized)
  const body = stripAssistantIntro(normalized)
  const itemStarts = [...body.matchAll(/(?:^|\n)\s*(\d+)\)\s+/g)]
  if (itemStarts.length === 0) return null

  const items = itemStarts.map((match, index) => {
    const contentStart = match.index + match[0].length
    const contentEnd =
      index + 1 < itemStarts.length ? itemStarts[index + 1].index : body.length
    return parseMatchBlock(body.slice(contentStart, contentEnd))
  })

  if (items.length === 0) return null
  return { intro, items }
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

function AssistantText({ text }) {
  const formattedText = normalizeMonthlyBudgetText(text)
  const parsed = parseAssistantMatches(formattedText)
  if (!parsed) {
    return (
      <div className={`${styles.assistantText} ${styles.assistantTextFallback}`}>
        {renderMarkdownText(formattedText)}
      </div>
    )
  }

  const detailItems = (item) =>
    [
      item.memoryCare ? { label: 'Memory care', value: item.memoryCare } : null,
      item.why ? { label: 'Why', value: item.why } : null,
    ].filter(Boolean)

  return (
    <div className={styles.assistantText}>
      {parsed.intro && <p className={styles.resultsIntro}>{parsed.intro}</p>}
      <ol className={styles.resultsList}>
        {parsed.items.map((item, index) => (
          <li key={`${item.title}-${index}`}>
            <strong>{item.title}</strong>
            {detailItems(item).length > 0 && (
              <ol className={styles.detailList}>
                {detailItems(item).map((detail) => (
                  <li key={detail.label}>
                    <strong>{detail.label}:</strong> {detail.value}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function RegistrationPrompt({
  zipCode = '',
  careType = 'assisted',
  location = '',
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
      const res = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: contact.trim(),
          zip: zipCode,
          facilityType: careTypeLabel,
          location,
          authSurface: 'homepage_wizard',
          redirectTo: '/',
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
      <p className={styles.registrationTitle}>Want exclusive data on Massachusetts assisted living facilities?</p>
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
      {emailMagicLink ? (
        <a
          className={styles.registrationInlineLink}
          href={emailMagicLink}
          target="_top"
          rel="noreferrer"
          onClick={() =>
            trackAuthTestLinkClicked({
              auth_surface: 'homepage_wizard',
              form_id: 'homepage_wizard_registration',
              link_kind: 'dev_magic_link',
            })
          }
        >
          Open sign-in link
        </a>
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

export function SaveContinuePrompt({ onDismiss, onSave, wizardState }) {
  const [contact, setContact] = useState('')
  const [status, setStatus] = useState('')
  const [magicLink, setMagicLink] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    const trimmed = contact.trim()
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setStatus('Please enter a valid email address.')
      return
    }

    trackWizardSaveStarted({
      auth_surface: 'homepage_wizard',
      form_id: 'homepage_wizard_save_restore',
    })

    setIsSaving(true)
    setStatus('Saving your progress...')

    // 1. Save locally first so restore works even if API fails
    try {
      setSavedWizardState(wizardState)
    } catch {
      // localStorage may be unavailable; proceed with API save only
    }

    // 2. Persist to server
    try {
      const res = await fetch('/api/wizard/save-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          wizardState,
          authSurface: 'homepage_wizard_save_restore',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = data.error || 'Could not save. Please try again.'
        setStatus(message)
        trackWizardSaveFailed({
          auth_surface: 'homepage_wizard',
          form_id: 'homepage_wizard_save_restore',
          error_message: message,
        })
        return
      }
    } catch {
      setStatus('Could not reach server. Your progress is saved on this device.')
      trackWizardSaveFailed({
        auth_surface: 'homepage_wizard',
        form_id: 'homepage_wizard_save_restore',
        error_message: 'network_error',
      })
      return
    }

    // 3. Request magic link
    try {
      setStatus('Sending your secure link...')
      const linkRes = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          zip: wizardState.zip_code || '',
          facilityType: 'Assisted living',
          location: wizardState.dify_location || '',
          authSurface: 'homepage_wizard_save_restore',
          redirectTo: '/',
        }),
      })
      const linkData = await linkRes.json().catch(() => ({}))
      if (!linkRes.ok) {
        setStatus('Progress saved! Could not send email, but your data is safe.')
        return
      }
      setStatus('Check your inbox for your secure sign-in link.')
      setMagicLink(String(linkData.magicLink || ''))
      trackWizardSaveSuccess({
        auth_surface: 'homepage_wizard',
        form_id: 'homepage_wizard_save_restore',
        email_delivery_sent: Boolean(linkData.sent),
      })
    } catch {
      setStatus('Progress saved! Could not send email, but your data is safe.')
    } finally {
      setIsSaving(false)
    }
  }

  const hasError = Boolean(status) && /could not|valid|required|invalid/i.test(status)

  return (
    <div className={styles.registrationPrompt}>
      <p className={styles.registrationTitle}>Want to continue later?</p>
      <p className={styles.registrationCopy}>
        Enter your email and we&apos;ll send you a link to pick up right where you left off.
      </p>
      <div className={styles.authInputRow}>
        <input
          className={styles.textInput}
          type="email"
          inputMode="email"
          placeholder="Email address"
          value={contact}
          disabled={isSaving}
          onChange={(e) => {
            setContact(e.target.value)
            if (status) setStatus('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSave()
          }}
        />
        <button
          type="button"
          className={styles.registrationButtonPrimary}
          disabled={!contact.trim() || isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {status ? (
        <p className={`${styles.registrationStatus} ${hasError ? styles.registrationError : ''}`}>
          {status}
        </p>
      ) : null}
      {magicLink ? (
        <a
          className={styles.registrationInlineLink}
          href={magicLink}
          target="_top"
          rel="noreferrer"
        >
          Open sign-in link
        </a>
      ) : null}
      <button
        type="button"
        className={styles.ghostBtn}
        disabled={isSaving}
        onClick={onDismiss}
        style={{ marginTop: 8 }}
      >
        No thanks, I&apos;ll continue now
      </button>
    </div>
  )
}

export function AssistedlyWizard({
  prefilledVariables = {},
  homepage_layout = '',
  assistantEngaged = false,
  onEngagedChange,
}) {
  const { trackMessageSent, trackChatCompleted, messagePreview } = useChatAnalytics()
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
  const [selectedScenario, setSelectedScenario] = useState(null)
  const [failureContact, setFailureContact] = useState(() => getStoredContact())
  const [failureContactStatus, setFailureContactStatus] = useState('')
  const [sendingFailureContact, setSendingFailureContact] = useState(false)

  const [conversationId, setConversationId] = useState()
  const [wizardComplete, setWizardComplete] = useState(false)

  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const savePromptShownRef = useRef(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const presetScenarioContext =
    selectedScenario && selectedScenario !== 'Something else...'
      ? presetScenarioContextFromChoice(selectedScenario)
      : null

  /** Wizard scroll container — avoid `scrollIntoView` (it scrolls the window). */
  const mainScrollRef = useRef(null)
  const scrollRafRef = useRef(0)
  const streamAccRef = useRef('')
  const streamFlushRafRef = useRef(0)
  const reportedErrorRef = useRef('')
  const chatPrefetchedRef = useRef(false)
  const budgetTouchedRef = useRef(false)

  /** Drop-off tracking — track when user leaves mid-wizard. */
  const wizardActiveRef = useRef(false)
  const wizardCompletedRef = useRef(false)
  const dropOffStepRef = useRef('urgency')

  /** Track step entry for funnel analysis. */
  const trackStepEntry = useCallback((stepName, pct) => {
    if (typeof window === 'undefined') return
    wizardActiveRef.current = true
    dropOffStepRef.current = stepName

    posthog.capture('wizard_step_entry', {
      step_name: stepName,
      percent_complete: pct,
    })

    trackMessageSent({
      step_id: stepName,
      percent_complete: pct,
      message_preview: stepName,
      funnel_stage: 'step_viewed',
    })
  }, [trackMessageSent])

  /** Track wizard drop-off when user navigates away. */
  const fireDropOff = useCallback(() => {
    if (wizardCompletedRef.current || !wizardActiveRef.current) return
    const step = dropOffStepRef.current
    posthog.capture('wizard_dropped_off', {
      last_step: step,
      had_urgency: Boolean(urgency),
      had_budget: monthlyBudget != null,
      had_zip: zipCode.length === 5,
      had_scenario: Boolean(selectedScenario),
    })
    wizardActiveRef.current = false
  }, [urgency, monthlyBudget, zipCode, selectedScenario])

  // Setup drop-off detection on mount
  useEffect(() => {
    const handleBeforeUnload = () => fireDropOff()
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') fireDropOff()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      fireDropOff()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fireDropOff])

  /** Funnel timing — epoch ms when each step fires. */
  const funnelRef = useRef({ query_start: 0, first_token: 0, facilities_shown: 0 })
  const firstTokenFiredRef = useRef(false)
  const facilitiesShownFiredRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    const el = mainScrollRef.current
    if (!el) return
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current)
      scrollRafRef.current = window.requestAnimationFrame(() => {
        const current = mainScrollRef.current
        if (current) current.scrollTop = current.scrollHeight
      })
      return
    }
    el.scrollTop = el.scrollHeight
  }, [])

  // Scroll to bottom whenever thread or layout state changes.
  useEffect(() => {
    scrollToBottom()
  }, [error, lines, loading, scrollToBottom, step, wizardComplete])

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

  // Restore wizard state from localStorage if available
  useEffect(() => {
    const savedState = getSavedWizardState()
    if (!savedState) return

    trackWizardRestoreAttempted({
      auth_surface: 'homepage_wizard',
      form_id: 'homepage_wizard_save_restore',
      had_urgency: Boolean(savedState.urgency),
      had_budget: savedState.monthly_budget != null,
    })

    scheduleAfterPaint(() => {
      setUrgency(savedState.urgency || null)
      setMonthlyBudgetInput(formatBudgetFieldDisplay(String(savedState.monthly_budget ?? '')))
      setMonthlyBudget(parseBudget(savedState.monthly_budget))
      setZipCode(normalizeZip(savedState.zip_code || ''))
      setCareType(savedState.care_type || 'assisted')
      setDifyLocation(savedState.dify_location || '')
      setSelectedScenario(savedState.scenario_selected || null)
      setStep(savedState.step || 'urgency')

      // Clear saved state after successful restore
      clearSavedWizardState()

      trackWizardRestoreSuccess({
        auth_surface: 'homepage_wizard',
        form_id: 'homepage_wizard_save_restore',
        restored_step: savedState.step || 'urgency',
      })
    })
  }, [])

  // PostHog: mount/open tracking + feature flag exposure
  useEffect(() => {
    posthog.capture('wizard_started')
    trackStepEntry('urgency', 0)
    const variant = posthog.getFeatureFlag(WIZARD_BUDGET_SCENARIOS_EXPERIMENT_FLAG)
    posthog.getFeatureFlag('top-nav-search-box')
    posthog.getFeatureFlag('homepage-headline-experiment')
    posthog.getFeatureFlag('typebot-version-test')
    // Fire variant exposure immediately (captureWizardPathVariantShown is called on urgency)
  }, [trackStepEntry])

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

  useEffect(() => {
    const fields = resolveWizardFields(prefilledVariables)
    budgetTouchedRef.current = false
    scheduleAfterPaint(() => {
      setMonthlyBudgetInput(formatBudgetFieldDisplay(fields.monthly_budget))
      setMonthlyBudget(parseBudget(fields.monthly_budget))
      setZipCode(normalizeZip(fields.zip_code))
      setCareType(fields.care_type)
      if (fields.location) setDifyLocation(fields.location)
    })
  }, [prefilledVariables])

  useEffect(() => {
    if (step !== 'budget' || budgetTouchedRef.current) return
    const normalizedZip = normalizeZip(zipCode)
    if (normalizedZip.length !== 5) return
    if (hasPinnedMonthlyBudget(prefilledVariables)) return

    const suggested = suggestedMonthlyBudget(careType, normalizedZip)
    scheduleAfterPaint(() => {
      setMonthlyBudgetInput(formatBudgetFieldDisplay(String(suggested)))
      setMonthlyBudget(suggested)
    })
  }, [careType, prefilledVariables, step, zipCode])

  const buildDifyInputs = useCallback(
    (extra = {}) => {
      const location =
        (typeof extra?.Location === 'string' && extra.Location.trim()) ||
        difyLocation ||
        (zipCode.length === 5 ? `ZIP ${zipCode}, MA` : '')

      const merged = {
        ...(urgency ? { how_urgent: urgency } : {}),
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
      firstTokenFiredRef.current = false
      facilitiesShownFiredRef.current = false
      funnelRef.current.query_start = Date.now()
      funnelRef.current.first_token = 0
      funnelRef.current.facilities_shown = 0
      const assistantId = uid()
      streamAccRef.current = ''
      setLines((prev) => [...prev, { id: assistantId, type: 'assistant', text: '' }])

      const flushStreamedText = (force = false) => {
        const apply = () => {
          streamFlushRafRef.current = 0
          const text = streamAccRef.current
          setLines((prev) => prev.map((l) => (l.id === assistantId ? { ...l, text } : l)))
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
      let showingOptimisticReply = false
      try {
        const resolvedInputs = inputs ?? buildDifyInputs()
        const optimisticReply = buildCompleteNativeTop3Reply(composedQuery, resolvedInputs)
        const streamResult = await streamDifyChatResponse(
          composedQuery,
          userId,
          conversationId ?? '',
          {
            onStatus: (message) => {
              if (acc || showingOptimisticReply) return
              streamAccRef.current = message
              flushStreamedText(true)
              scrollToBottom()
            },
            onDelta: (d) => {
              acc += d
              if (!showingOptimisticReply) {
               streamAccRef.current = acc
               flushStreamedText()
              }
              // Fire first-token event on first chunk received
              if (!firstTokenFiredRef.current && funnelRef.current.query_start > 0) {
               firstTokenFiredRef.current = true
                funnelRef.current.first_token = Date.now()
                const ms = funnelRef.current.first_token - funnelRef.current.query_start
                posthog.capture('wizard_ai_responded', { duration_ms: ms, query_length: composedQuery.length })
                posthog.capture('chat_stream_first_token_ms', { $duration: ms })
              }
            },
            onFinal: (full) => {
              acc = full
              if (!showingOptimisticReply) {
                streamAccRef.current = full
                flushStreamedText(true)
              }
            },
            onConversationId: (cid) => setConversationId(cid),
            onStreamError: (m) => setError(m),
            onKbFacilities: () => {
              if (!acc && optimisticReply) {
                showingOptimisticReply = true
                streamAccRef.current = optimisticReply
                flushStreamedText(true)
                scrollToBottom()
              }
              // Fire when knowledge-retrieval facility data arrives (from instant or Dify)
              if (!facilitiesShownFiredRef.current) {
                facilitiesShownFiredRef.current = true
                funnelRef.current.facilities_shown = Date.now()
                const ms = funnelRef.current.facilities_shown - funnelRef.current.query_start
                posthog.capture('wizard_facilities_shown', { duration_ms: ms })
              }
            },
          },
          resolvedInputs
        )
        const finalText =
          typeof streamResult === 'string' ? streamResult : streamResult?.answer || ''
        let safeReply = normalizeAssistantHtml(finalText || acc).trim()
        if (!replyIncludesTop3Matches(safeReply)) {
          const rebuilt = buildCompleteNativeTop3Reply(composedQuery, resolvedInputs)
          if (rebuilt) safeReply = rebuilt
        }
        if (!safeReply) {
          safeReply =
            buildLocalFacilityChatFallback(composedQuery, resolvedInputs) ||
            EMPTY_ASSISTANT_FALLBACK
        }
        if (!safeReply.trim()) {
          throw new Error('Facility recommendations did not load. Please try again.')
        }
        setLines((prev) => prev.map((l) => (l.id === assistantId ? { ...l, text: safeReply } : l)))
        wizardCompletedRef.current = true
        wizardActiveRef.current = false
        setWizardComplete(true)
        setStep('idle')
        trackStepEntry('complete', 100)
        // Fire wizard funnel step events: completed
        if (funnelRef.current.query_start > 0) {
          const completedMs = Date.now() - funnelRef.current.query_start
          const firstTokenMs = funnelRef.current.first_token
            ? funnelRef.current.first_token - funnelRef.current.query_start
            : 0
          posthog.capture('wizard_completed', {
            duration_ms: completedMs,
            first_token_ms: firstTokenMs,
            query_length: composedQuery.length,
            fallback_used: !replyIncludesTop3Matches(safeReply),
          })
        }
        trackChatCompleted({
          homepage_layout,
          zip_code: zipCode.length === 5 ? zipCode : undefined,
          care_type:
            CARE_TYPE_OPTIONS.find((option) => option.value === careType)?.label ||
            careType,
        })
        posthog.capture('typebot_completed', {
          zip_code: zipCode.length === 5 ? zipCode : undefined,
          care_type: CARE_TYPE_OPTIONS.find((option) => option.value === careType)?.label || careType,
          monthly_budget: monthlyBudget,
          scenario_selected: selectedScenario,
        })
        posthog.capture('generate_lead')
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg)
        setLines((prev) => prev.filter((l) => l.id !== assistantId))
      } finally {
        setLoading(false)
        scrollToBottom()
      }
    },
    [buildDifyInputs, conversationId, careType, homepage_layout, monthlyBudget, scrollToBottom, selectedScenario, trackChatCompleted, trackStepEntry, userId, zipCode]
  )

  // Track variant exposure once per session
  const wizardPathExposureRef = useRef(false)

  const pickUrgency = useCallback(
    (label) => {
      const activeVariant = readWizardPathVariantFromPostHog()
      const activeScenariosFirst = activeVariant === WIZARD_PATH_VARIANT.SCENARIOS_FIRST

      setUrgency(label)
      engageAssistant()

      // Fire variant exposure once
      if (!wizardPathExposureRef.current) {
        wizardPathExposureRef.current = true
        captureWizardPathVariantShown(activeVariant, { homepage_layout })
      }

      scheduleAfterPaint(() => {
        posthog.capture('typebot_question_answered', {
          step_name: 'urgency',
          percent_complete: 25,
          wizard_path_variant: activeVariant,
        })
        trackMessageSent({
          percent_complete: 25,
          message_preview: label,
          step_id: 'urgency',
          wizard_path_variant: activeVariant,
        })
      })
      trackStepEntry(activeScenariosFirst ? 'scenarios' : 'budget', 25)

      if (activeScenariosFirst) {
        setLines((prev) => [
          ...prev,
          { id: uid(), type: 'user', text: label },
          {
            id: uid(),
            type: 'bot',
            node: <ScenarioIntroBubble />,
          },
        ])
        setStep('scenarios')
      } else {
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
      }
      prefetchChatRoute()
    },
    [engageAssistant, homepage_layout, trackMessageSent, trackStepEntry]
  )

  const submitBudget = useCallback(() => {
    const parsedBudget = parseBudget(monthlyBudgetInput)
    const normalizedZip = normalizeZip(zipCode)
    if (!parsedBudget || normalizedZip.length !== 5 || loading) return
    engageAssistant()
    scheduleAfterPaint(() => {
      posthog.capture('typebot_question_answered', {
        step_name: 'budget_zip_care_type',
        percent_complete: 75,
        zip_code: normalizedZip,
        care_type: careType,
        monthly_budget: parsedBudget,
      })
      trackMessageSent({
        percent_complete: 75,
        message_preview: 'budget_and_zip_submitted',
        step_id: 'budget',
      })
      trackStepEntry('searching', 75)
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
    const scenarioLocation =
      selectedScenario && selectedScenario !== 'Something else...'
        ? locationHintFromPresetScenario(selectedScenario)
        : ''
    const budgetLocationLabel =
      scenarioLocation ||
      ((difyLocation || '').trim() && !String(difyLocation).startsWith('ZIP ')
        ? String(difyLocation).trim()
        : `ZIP ${normalizedZip}`)
    const budgetLine = {
      id: uid(),
      type: 'user',
      text: `${currency.format(parsedBudget)} per month • ${budgetLocationLabel} • ${careLabel}`,
    }

    if (selectedScenario === 'Something else...') {
      const userQ = pendingCustomUserQuestion?.trim()
      const loc = (difyLocation || '').trim() || `ZIP ${normalizedZip}, MA`
      if (!userQ) return
      setLines((prev) => [...prev, budgetLine])
      setPendingCustomUserQuestion(null)
      setStep('idle')
      void runDifyQuery(composeCustomListQuery(userQ, loc, urgency, parsedBudget), buildDifyInputs({
        Location: loc,
        monthly_budget: parsedBudget,
      }))
      return
    }

    if (selectedScenario) {
      const loc = locationHintFromPresetScenario(selectedScenario)
      setDifyLocation(loc)
      setLines((prev) => [...prev, budgetLine])
      setStep('idle')
      void runDifyQuery(composePresetListQuery(selectedScenario, urgency, parsedBudget), buildDifyInputs({
        Location: loc,
        monthly_budget: parsedBudget,
      }))
      return
    }

    setLines((prev) => [
      ...prev,
      budgetLine,
      {
        id: uid(),
        type: 'bot',
        node: <ScenarioIntroBubble />,
      },
    ])
    setStep('scenarios')
    prefetchChatRoute()
  }, [
    buildDifyInputs,
    careType,
    difyLocation,
    engageAssistant,
    loading,
    monthlyBudgetInput,
    pendingCustomUserQuestion,
    runDifyQuery,
    selectedScenario,
    trackMessageSent,
    urgency,
    zipCode,
  ])

  const pickScenario = useCallback(
    (label) => {
      engageAssistant()
      if (!urgency || loading) return
      if (label === 'Something else...') {
        setSelectedScenario(label)
        scheduleAfterPaint(() => {
          posthog.capture('typebot_question_answered', {
            step_name: 'scenario_choices',
            percent_complete: 50,
            scenario_selected: label,
          })
          trackMessageSent({
            percent_complete: 50,
            message_preview: label,
            step_id: 'scenarios',
          })
        })
        setLines((prev) => [...prev, { id: uid(), type: 'user', text: label }])
        setStep('customUser')
        return
      }

      setSelectedScenario(label)
      scheduleAfterPaint(() => {
        posthog.capture('typebot_question_answered', {
          step_name: 'scenario_choices',
          percent_complete: 50,
          scenario_selected: label,
        })
        trackMessageSent({
          percent_complete: 50,
          message_preview: messagePreview(label),
          step_id: 'scenarios',
        })
      })
      trackStepEntry('budget', 50)
      const scenarioContext = presetScenarioContextFromChoice(label)
      setDifyLocation(scenarioContext.location)
      if (scenarioContext.zipCode) setZipCode(scenarioContext.zipCode)
      if (scenarioContext.careType) setCareType(scenarioContext.careType)
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
    [engageAssistant, loading, messagePreview, trackMessageSent, trackStepEntry, urgency]
  )

  const submitCustomUserQuestion = useCallback(() => {
    const t = customUserQuestion.trim()
    if (!t || !urgency || loading) return
    engageAssistant()
    trackStepEntry('customLocation', 60)
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
  }, [customUserQuestion, engageAssistant, loading, scrollToBottom, trackMessageSent, trackStepEntry, urgency])

  const submitCustomSearchLocation = useCallback(() => {
    const loc = customSearchLocation.trim()
    const userQ = pendingCustomUserQuestion?.trim()
    if (!loc || !urgency || loading || !userQ) return

    engageAssistant()
    trackStepEntry('budget', 70)
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
    setLines((prev) => [
      ...prev,
      {
        id: uid(),
        type: 'bot',
        node: <BudgetIntroBubble />,
      },
    ])
    setStep('budget')
    prefetchChatRoute()
  }, [customSearchLocation, engageAssistant, loading, pendingCustomUserQuestion, trackMessageSent, trackStepEntry, urgency])

  const trackWizardLead = useCallback(() => {
    trackStepEntry('lead_captured', 100)
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
  }, [careType, homepage_layout, trackChatCompleted, trackStepEntry, zipCode])

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
    wizardCompletedRef.current = false
    wizardActiveRef.current = true
    dropOffStepRef.current = 'urgency'
    trackStepEntry('urgency', 0)
    setStep('urgency')
    const prefilledUrgency = urgencyFromPrefill(prefilledVariables) || null
    setUrgency(prefilledUrgency)
    const fields = resolveWizardFields(prefilledVariables)
    setMonthlyBudgetInput(formatBudgetFieldDisplay(fields.monthly_budget))
    setMonthlyBudget(parseBudget(fields.monthly_budget))
    setZipCode(normalizeZip(fields.zip_code))
    setCareType(fields.care_type)
    setDifyLocation(fields.location)
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
    setSelectedScenario(null)
    setFailureContact(getStoredContact())
    setFailureContactStatus('')
    setSendingFailureContact(false)
    budgetTouchedRef.current = false
    reportedErrorRef.current = ''
    setConversationId(undefined)
    setWizardComplete(false)
    setError(null)
  }, [onEngagedChange, prefilledVariables, trackStepEntry])

  const parsedBudgetForStep = parseBudget(monthlyBudgetInput)
  const normalizedZipForStep = normalizeZip(zipCode)
  const deferredBudgetChartInput = useDeferredValue(monthlyBudgetInput)
  const handleBudgetChartChange = useCallback((nextBudget) => {
    const bounded = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, Number(nextBudget)))
    if (!Number.isFinite(bounded)) return
    budgetTouchedRef.current = true
    setMonthlyBudgetInput(formatBudgetFieldDisplay(String(bounded)))
    setMonthlyBudget(bounded)
  }, [])
  const canSubmitBudgetStep =
    !loading && parsedBudgetForStep != null && normalizedZipForStep.length === 5

  // Show save prompt after meaningful early input (urgency + budget stage reached)
  useEffect(() => {
    if (step !== 'budget') return
    if (savePromptShownRef.current) return

    // Require urgency + at least partial budget interaction
    if (!urgency) return

    savePromptShownRef.current = true
    queueMicrotask(() => {
      setShowSavePrompt(true)
    })

    trackWizardSavePromptShown({
      auth_surface: 'homepage_wizard',
      step: 'budget',
      had_budget: parsedBudgetForStep != null,
    })
  }, [parsedBudgetForStep, step, urgency])

  useEffect(() => {
    if (step !== 'budget' || !canSubmitBudgetStep || chatPrefetchedRef.current) return
    chatPrefetchedRef.current = true
    prefetchChatRoute()
  }, [canSubmitBudgetStep, step])

  return (
    <div
      className={`${styles.shell} ${assistantEngaged ? styles.shellEngaged : ''}`}
    >
      <main className={styles.main}>
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
                    <AssistantText text={line.text} />
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
            <div className={styles.composer}>
              {showSavePrompt && (
                <SaveContinuePrompt
                  onDismiss={() => setShowSavePrompt(false)}
                  onSave={() => {
                    /* saving handled internally */
                  }}
                  wizardState={{
                    urgency,
                    monthly_budget: monthlyBudget,
                    zip_code: zipCode,
                    care_type: careType,
                    dify_location: difyLocation,
                    scenario_selected: selectedScenario,
                    step,
                  }}
                />
              )}
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
                  }}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '')
                    budgetTouchedRef.current = true
                    setMonthlyBudgetInput(digits ? formatBudgetFieldDisplay(digits) : '')
                  }}
                />
              </label>
              <div className={styles.inputRow}>
                {presetScenarioContext?.location ? (
                  <label className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Location</span>
                    <input
                      className={styles.textInput}
                      value={presetScenarioContext.location}
                      readOnly
                      aria-readonly="true"
                    />
                  </label>
                ) : (
                  <label className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>ZIP code</span>
                    <input
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
                )}
                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Type of care</span>
                  <select
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
              <BudgetRangeChart
                monthlyBudget={deferredBudgetChartInput}
                zipCode={normalizedZipForStep}
                careType={careType}
                onBudgetChange={handleBudgetChartChange}
              />
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

          {step === 'scenarios' && (
            <div className={styles.quickReplies}>
            {SCENARIO_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={styles.choiceBtn}
                disabled={loading}
                onClick={() => void pickScenario(opt)}
              >
                {opt}
              </button>
            ))}
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
            <div className={styles.composer}>
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
            <div className={styles.composer}>
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

          {wizardComplete && (
            <>
              <SaveContinuePrompt
                onDismiss={() => {}}
                onSave={() => {}}
                wizardState={{
                  urgency,
                  monthly_budget: monthlyBudget,
                  zip_code: zipCode,
                  care_type: careType,
                  dify_location: difyLocation,
                  scenario_selected: selectedScenario,
                  step,
                }}
              />
              <RegistrationPrompt
                zipCode={normalizedZipForStep}
                careType={careType}
                location={difyLocation || customSearchLocation}
                onLeadCaptured={trackWizardLead}
              />
              <div className={styles.actionsRow}>
                <button type="button" className={styles.ghostBtn} disabled={loading} onClick={resetAll}>
                  Start over
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}