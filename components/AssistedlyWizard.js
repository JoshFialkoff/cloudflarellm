'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  composeCustomListQuery,
  composeFollowUpQuery,
  composePresetListQuery,
  formatMonthlyBudget,
  locationHintFromPresetScenario,
  urgencyFromPrefill,
} from '../lib/composeAssistedlyQuery'
import { normalizeAssistantHtml, streamDifyChatResponse } from '../lib/streamDifyChat'
import styles from './AssistedlyWizard.module.css'

const USER_STORAGE_KEY = 'assistedly-dify-user-id'

function uid() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
const LOGIN_URL = process.env.NEXT_PUBLIC_ASSISTEDLY_LOGIN_URL || 'https://assistedly.ai/login'
const REGISTER_URL =
  process.env.NEXT_PUBLIC_ASSISTEDLY_REGISTER_URL || 'https://assistedly.ai/register'

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

function parseBudget(value) {
  const digits = String(value || '').replace(/[^\d]/g, '')
  if (!digits) return null
  const parsed = Number.parseInt(digits, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
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

function BudgetRangeChart({ monthlyBudget, zipCode, careType }) {
  const estimate = estimateRange(careType, zipCode)
  const lowPercent = budgetPercent(estimate.low)
  const highPercent = budgetPercent(estimate.high)
  const barWidth = Math.max(3, highPercent - lowPercent)
  const budgetValue = parseBudget(monthlyBudget)
  const budgetMarker = budgetValue != null ? budgetPercent(budgetValue) : null
  return (
    <div className={styles.budgetChart}>
      <div className={styles.budgetChartHeader}>
        <span className={styles.budgetChartLabel}>Estimated {estimate.careLabel} range</span>
        <strong>{currency.format(estimate.low)} – {currency.format(estimate.high)}</strong>
      </div>
      <div className={styles.budgetChartTrack} aria-hidden="true">
        <span className={styles.budgetChartRange} style={{ left: `${lowPercent}%`, width: `${barWidth}%` }} />
        {budgetMarker != null ? <span className={styles.budgetChartMarker} style={{ left: `${budgetMarker}%` }} /> : null}
      </div>
      <div className={styles.budgetChartScale}>
        <span>{currency.format(BUDGET_MIN)}</span>
        <span>{currency.format(BUDGET_MAX)}</span>
      </div>
    </div>
  )
}

function normalizeMonthlyBudgetText(text) {
  return text.replace(/\$(\d[\d,]*)(?:\s*\/\s*month|\s+per\s+month)/gi, (_match, rawAmount) =>
    formatMonthlyBudget(Number(String(rawAmount).replace(/\D/g, '')))
  )
}

function guessLovedOneDisplayName(userQuestion) {
  const t = userQuestion.trim()
  const forMatch = t.match(/\b(?:for|named|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/)
  if (forMatch) return forMatch[1].split(/\s+/)[0]
  const first = t.split(/\s+/)[0] ?? ''
  if (/^[A-Z][a-z]{1,20}$/.test(first)) return first
  return 'your loved one'
}

function parseAssistantMatches(text) {
  const compact = text.replace(/\s+/g, ' ').trim()
  const firstItem = compact.search(/\b1\)\s+/)
  if (firstItem < 0) return null

  const intro = compact
    .slice(0, firstItem)
    .replace(/\s*Top\s+\d+\s+matches:?\s*$/i, '')
    .trim()
  const itemsText = compact.slice(firstItem)
  const matches = [...itemsText.matchAll(/(?:^|\s)(\d+)\)\s+([\s\S]*?)(?=\s+\d+\)\s+|$)/g)]
  if (matches.length === 0) return null

  return {
    intro,
    items: matches.map((match) => {
      const raw = match[2].trim()
      const parts = raw.match(/^(.*?)\s+-\s+Memory care:\s*(.*?)(?:\s+-\s+Why:\s*(.*))?$/i)
      return {
        title: (parts?.[1] ?? raw).trim(),
        memoryCare: parts?.[2]?.trim(),
        why: parts?.[3]?.trim(),
      }
    }),
  }
}

function AssistantText({ text }) {
  const formattedText = normalizeMonthlyBudgetText(text)
  const parsed = parseAssistantMatches(formattedText)
  if (!parsed) {
    return <div className={styles.assistantText}>{formattedText}</div>
  }

  return (
    <div className={styles.assistantText}>
      {parsed.intro && <p>{parsed.intro}</p>}
      <p className={styles.resultsTitle}>Top matches</p>
      <ol className={styles.resultsList}>
        {parsed.items.map((item, index) => (
          <li key={`${item.title}-${index}`}>
            <strong>{item.title}</strong>
            <div className={styles.insightList}>
              {item.memoryCare && (
                <div className={styles.insight}>
                  <span className={styles.insightIcon}>•</span>
                  <span>
                    <strong>Memory care:</strong> {item.memoryCare}
                  </span>
                </div>
              )}
              {item.why && (
                <div className={styles.insight}>
                  <span className={styles.insightIcon}>•</span>
                  <span>
                    <strong>Why:</strong> {item.why}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function buildAuthUrl(intent, method, contact = '') {
  const base = intent === 'register' ? REGISTER_URL : LOGIN_URL
  try {
    const url = new URL(base)
    url.searchParams.set('auth_method', method)
    url.searchParams.set('source', 'assistant-results')
    if (contact.trim()) {
      url.searchParams.set(method === 'sms' ? 'phone' : 'email', contact.trim())
    }
    return url.toString()
  } catch {
    return base
  }
}

function RegistrationPrompt() {
  const [authIntent, setAuthIntent] = useState(null)
  const [linkMethod, setLinkMethod] = useState(null)
  const [contact, setContact] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [emailMagicLink, setEmailMagicLink] = useState('')
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  const begin = (intent) => {
    setAuthIntent(intent)
    setLinkMethod(null)
    setContact('')
    setEmailStatus('')
    setEmailMagicLink('')
    setIsSendingEmail(false)
  }

  const sendLink = async () => {
    if (!authIntent || !linkMethod || !contact.trim()) return

    if (linkMethod === 'sms') {
      const targetWindow = window.top ?? window
      targetWindow.location.href = buildAuthUrl(authIntent, linkMethod, contact)
      return
    }

    setIsSendingEmail(true)
    setEmailStatus('Sending your secure link...')
    setEmailMagicLink('')

    try {
      const res = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: contact.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEmailStatus(data.error || 'Could not send link. Please try again.')
        return
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('assistedly_email', contact.trim())
      }

      setEmailStatus(
        data.sent
          ? 'Check your inbox for your secure sign-in link.'
          : "Email delivery isn't configured yet. Use the direct sign-in link below."
      )
      setEmailMagicLink(String(data.magicLink || ''))
    } catch {
      setEmailStatus('Could not send link. Please try again.')
    } finally {
      setIsSendingEmail(false)
    }
  }

  if (authIntent && linkMethod) {
    const isSms = linkMethod === 'sms'
    const hasEmailError = Boolean(emailStatus) && /could not|valid email|required|invalid/i.test(emailStatus)
    return (
      <div className={styles.registrationPrompt}>
        <p className={styles.registrationTitle}>
          {isSms ? 'What mobile number should we text?' : 'What email should we use?'}
        </p>
        <p className={styles.registrationCopy}>We&apos;ll send a one-click secure access link.</p>
        <div className={styles.authInputRow}>
          <input
            className={styles.textInput}
            type={isSms ? 'tel' : 'email'}
            inputMode={isSms ? 'tel' : 'email'}
            placeholder={isSms ? 'Mobile number' : 'Email address'}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <button
            type="button"
            className={styles.registrationButtonPrimary}
            disabled={!contact.trim() || (!isSms && isSendingEmail)}
            onClick={sendLink}
          >
            {!isSms && isSendingEmail ? 'Sending...' : 'Send link'}
          </button>
        </div>
        {!isSms && emailStatus ? (
          <p className={`${styles.registrationStatus} ${hasEmailError ? styles.registrationError : ''}`}>
            {emailStatus}
          </p>
        ) : null}
        {!isSms && emailMagicLink ? (
          <a className={styles.registrationInlineLink} href={emailMagicLink} target="_top" rel="noreferrer">
            Open sign-in link
          </a>
        ) : null}
        <button type="button" className={styles.registrationBackButton} onClick={() => setLinkMethod(null)}>
          Back
        </button>
      </div>
    )
  }

  if (authIntent) {
    const action = authIntent === 'register' ? 'register' : 'log in'
    return (
      <div className={styles.registrationPrompt}>
        <p className={styles.registrationTitle}>How would you like to {action}?</p>
        <p className={styles.registrationCopy}>Choose the fastest option. No password required.</p>
        <div className={styles.registrationActions}>
          <a className={styles.registrationButtonPrimary} href={buildAuthUrl(authIntent, 'google')} target="_top">
            Continue with Google
          </a>
          <button type="button" className={styles.registrationButtonSecondary} onClick={() => setLinkMethod('email')}>
            Email me a link
          </button>
          <button type="button" className={styles.registrationButtonSecondary} onClick={() => setLinkMethod('sms')}>
            Text me a link
          </button>
        </div>
        <button type="button" className={styles.registrationBackButton} onClick={() => setAuthIntent(null)}>
          Back
        </button>
      </div>
    )
  }

  return (
    <div className={styles.registrationPrompt}>
      <p className={styles.registrationTitle}>Want exclusive data on Massachusetts assisted living facilities?</p>
      <p className={styles.registrationCopy}>Log in or register to unlock deeper facility details.</p>
      <div className={styles.registrationActions}>
        <button type="button" className={styles.registrationButtonPrimary} onClick={() => begin('register')}>
          Register
        </button>
        <button type="button" className={styles.registrationButtonSecondary} onClick={() => begin('login')}>
          Log in
        </button>
      </div>
    </div>
  )
}

export function AssistedlyWizard({
  prefilledVariables = {},
  assistantEngaged = false,
  onEngagedChange,
}) {
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
    String(prefilledVariables?.monthly_budget || '').trim()
  )
  const [monthlyBudget, setMonthlyBudget] = useState(() => parseBudget(prefilledVariables?.monthly_budget))
  const [zipCode, setZipCode] = useState(() => normalizeZip(prefilledVariables?.zip_code))
  const [careType, setCareType] = useState(() =>
    CARE_TYPE_OPTIONS.some((option) => option.value === prefilledVariables?.care_type)
      ? prefilledVariables.care_type
      : 'assisted'
  )
  const [followInput, setFollowInput] = useState('')

  const [conversationId, setConversationId] = useState()
  const [contextBundle, setContextBundle] = useState('')
  const [wizardComplete, setWizardComplete] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /** Wizard scroll container — avoid `scrollIntoView` (it scrolls the window). */
  const mainScrollRef = useRef(null)
  const scrollRafRef = useRef(0)

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
    },
    []
  )

  const engageAssistant = useCallback(() => {
    onEngagedChange?.(true)
  }, [onEngagedChange])

  useEffect(() => {
    onEngagedChange?.(Boolean(urgency))
  }, [urgency, onEngagedChange])

  const buildDifyInputs = useCallback(
    (extra = {}) => {
      const merged = {
        ...(urgency ? { how_urgent: urgency } : {}),
        ...(monthlyBudget != null
          ? {
            monthly_budget: currency.format(monthlyBudget),
            monthly_budget_raw: String(monthlyBudget),
            budget: currency.format(monthlyBudget),
          }
          : {}),
        ...(zipCode ? { zip_code: zipCode } : {}),
        ...(careType ? { care_type: careType } : {}),
        ...extra,
      }
      return Object.fromEntries(
        Object.entries(merged).filter(([, value]) => value != null && String(value).trim() !== '')
      )
    },
    [careType, monthlyBudget, urgency, zipCode]
  )

  const runDifyQuery = useCallback(
    async (composedQuery, inputs) => {
      setLoading(true)
      setError(null)
      const assistantId = uid()
      setLines((prev) => [...prev, { id: assistantId, type: 'assistant', text: '' }])
      let acc = ''
      try {
        await streamDifyChatResponse(
          composedQuery,
          userId,
          conversationId ?? '',
          {
            onDelta: (d) => {
              acc += d
              setLines((prev) => prev.map((l) => (l.id === assistantId ? { ...l, text: acc } : l)))
              scrollToBottom()
            },
            onConversationId: (cid) => setConversationId(cid),
            onStreamError: (m) => setError(m),
          },
          inputs ?? buildDifyInputs()
        )
        const normalized = normalizeAssistantHtml(acc).trim()
        const safeReply = normalized || EMPTY_ASSISTANT_FALLBACK
        setLines((prev) => prev.map((l) => (l.id === assistantId ? { ...l, text: safeReply } : l)))
        setContextBundle(`${composedQuery.trim()}\n\n---\nAssistant:\n${safeReply}`)
        setWizardComplete(true)
        setStep('idle')
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg)
        setLines((prev) => prev.filter((l) => l.id !== assistantId))
      } finally {
        setLoading(false)
        scrollToBottom()
      }
    },
    [buildDifyInputs, conversationId, scrollToBottom, userId]
  )

  const pickUrgency = useCallback(
    (label) => {
      setUrgency(label)
      engageAssistant()
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
      scrollToBottom()
    },
    [engageAssistant, scrollToBottom]
  )

  const submitBudget = useCallback(() => {
    const parsedBudget = parseBudget(monthlyBudgetInput)
    const normalizedZip = normalizeZip(zipCode)
    if (!parsedBudget || normalizedZip.length !== 5 || loading) return
    engageAssistant()
    setMonthlyBudget(parsedBudget)
    setZipCode(normalizedZip)
    const careLabel = CARE_TYPE_OPTIONS.find((option) => option.value === careType)?.label || 'Assisted living'
    setLines((prev) => [
      ...prev,
      {
        id: uid(),
        type: 'user',
        text: `${currency.format(parsedBudget)} per month • ZIP ${normalizedZip} • ${careLabel}`,
      },
      {
        id: uid(),
        type: 'bot',
        node: <p className={styles.scenariosLead}>{COMMON_SCENARIOS_PROMPT}</p>,
      },
    ])
    setStep('scenarios')
    scrollToBottom()
  }, [careType, engageAssistant, loading, monthlyBudgetInput, scrollToBottom, zipCode])

  const pickScenario = useCallback(
    async (label) => {
      engageAssistant()
      if (!urgency || loading) return
      if (label === 'Something else...') {
        setLines((prev) => [...prev, { id: uid(), type: 'user', text: label }])
        setStep('customUser')
        scrollToBottom()
        return
      }

      const scenarioText = (label || '').trim() || 'your selected scenario'
      const budgetText = monthlyBudget != null ? ` and budget ${currency.format(monthlyBudget)} per month` : ''
      const standby = `Got it! I'm going to search my proprietary database for ${scenarioText} (urgency: ${urgency}${budgetText}). This will take a minute or so to analyze all of the data we've gathered on Massachusetts assisted living facilities... Stand by!`
      const loc = locationHintFromPresetScenario(label)
      setLines((prev) => [
        ...prev,
        { id: uid(), type: 'user', text: label },
        { id: uid(), type: 'bot', node: <>{standby}</> },
      ])
      setStep('idle')
      scrollToBottom()
      await runDifyQuery(composePresetListQuery(label, urgency, monthlyBudget), buildDifyInputs({
        Location: loc,
      }))
    },
    [buildDifyInputs, engageAssistant, loading, monthlyBudget, runDifyQuery, scrollToBottom, urgency]
  )

  const submitCustomUserQuestion = useCallback(() => {
    const t = customUserQuestion.trim()
    if (!t || !urgency || loading) return
    engageAssistant()
    setPendingCustomUserQuestion(t)
    setLines((prev) => [...prev, { id: uid(), type: 'user', text: t }])
    setCustomUserQuestion('')
    setStep('customLocation')
    scrollToBottom()
  }, [customUserQuestion, engageAssistant, loading, scrollToBottom, urgency])

  const submitCustomSearchLocation = useCallback(async () => {
    const loc = customSearchLocation.trim()
    const userQ = pendingCustomUserQuestion?.trim()
    if (!loc || !urgency || loading || !userQ) return

    engageAssistant()
    const nickname = guessLovedOneDisplayName(userQ)
    const budgetText = monthlyBudget != null ? ` and budget ${currency.format(monthlyBudget)} per month` : ''
    const standby = `Got it! I'm going to search my proprietary database for ${userQ} in ${loc} for ${nickname} (urgency: ${urgency}${budgetText}). This will take a minute or so to analyze all of the data we've gathered on Massachusetts assisted living facilities... Stand by!`

    setLines((prev) => [
      ...prev,
      { id: uid(), type: 'user', text: loc },
      { id: uid(), type: 'bot', node: <>{standby}</> },
    ])
    setCustomSearchLocation('')
    setPendingCustomUserQuestion(null)
    setStep('idle')
    scrollToBottom()
    await runDifyQuery(composeCustomListQuery(userQ, loc, urgency, monthlyBudget), buildDifyInputs({
      Location: loc,
    }))
  }, [buildDifyInputs, customSearchLocation, engageAssistant, loading, monthlyBudget, pendingCustomUserQuestion, runDifyQuery, scrollToBottom, urgency])

  const sendFollowUp = useCallback(async () => {
    const t = followInput.trim()
    if (!t || loading) return
    engageAssistant()
    setFollowInput('')
    setLines((prev) => [...prev, { id: uid(), type: 'user', text: t }])
    const composed = composeFollowUpQuery(contextBundle, t)
    scrollToBottom()
    await runDifyQuery(composed)
  }, [contextBundle, engageAssistant, followInput, loading, runDifyQuery, scrollToBottom])

  const resetAll = useCallback(() => {
    setStep('urgency')
    const prefilledUrgency = urgencyFromPrefill(prefilledVariables) || null
    setUrgency(prefilledUrgency)
    const prefilledBudget = parseBudget(prefilledVariables?.monthly_budget)
    const prefilledZip = normalizeZip(prefilledVariables?.zip_code)
    const prefilledCareType = CARE_TYPE_OPTIONS.some((option) => option.value === prefilledVariables?.care_type)
      ? prefilledVariables.care_type
      : 'assisted'
    setMonthlyBudgetInput(String(prefilledVariables?.monthly_budget || '').trim())
    setMonthlyBudget(prefilledBudget)
    setZipCode(prefilledZip)
    setCareType(prefilledCareType)
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
    setFollowInput('')
    setConversationId(undefined)
    setContextBundle('')
    setWizardComplete(false)
    setError(null)
  }, [onEngagedChange, prefilledVariables])

  const parsedBudgetForStep = parseBudget(monthlyBudgetInput)
  const normalizedZipForStep = normalizeZip(zipCode)
  const canSubmitBudgetStep =
    !loading && parsedBudgetForStep != null && normalizedZipForStep.length === 5

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
              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Monthly budget</span>
                <input
                  className={styles.textInput}
                  inputMode="numeric"
                  placeholder="$10,000"
                  value={monthlyBudgetInput}
                  disabled={loading}
                  onFocus={engageAssistant}
                  onChange={(e) => setMonthlyBudgetInput(e.target.value)}
                />
              </label>
              <div className={styles.inputRow}>
                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>ZIP code</span>
                  <input
                    className={styles.textInput}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="01801"
                    value={zipCode}
                    disabled={loading}
                    onFocus={engageAssistant}
                    onChange={(e) => setZipCode(normalizeZip(e.target.value))}
                  />
                </label>
                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Type of care</span>
                  <select
                    className={styles.textInput}
                    value={careType}
                    disabled={loading}
                    onFocus={engageAssistant}
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
                monthlyBudget={monthlyBudgetInput}
                zipCode={normalizedZipForStep}
                careType={careType}
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

          {error && <p className={styles.error}>{error}</p>}

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
                  onFocus={engageAssistant}
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
              <RegistrationPrompt />
              <div className={styles.composer}>
                <textarea
                  className={styles.textarea}
                  placeholder="How else can I use our extensive data on Massachusetts assisted living to help you?"
                  value={followInput}
                  disabled={loading}
                  onFocus={engageAssistant}
                  onChange={(e) => setFollowInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendFollowUp()
                    }
                  }}
                />
                <div className={styles.actionsRow}>
                  <button type="button" className={styles.ghostBtn} disabled={loading} onClick={resetAll}>
                    Start over
                  </button>
                  <button
                    type="button"
                    className={styles.sendBtn}
                    disabled={loading || !followInput.trim()}
                    onClick={() => void sendFollowUp()}
                  >
                    {loading ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
