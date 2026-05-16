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

  const begin = (intent) => {
    setAuthIntent(intent)
    setLinkMethod(null)
    setContact('')
  }

  const sendLink = () => {
    if (!authIntent || !linkMethod || !contact.trim()) return
    const targetWindow = window.top ?? window
    targetWindow.location.href = buildAuthUrl(authIntent, linkMethod, contact)
  }

  if (authIntent && linkMethod) {
    const isSms = linkMethod === 'sms'
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
            disabled={!contact.trim()}
            onClick={sendLink}
          >
            Send link
          </button>
        </div>
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
  const [followInput, setFollowInput] = useState('')

  const [conversationId, setConversationId] = useState()
  const [contextBundle, setContextBundle] = useState('')
  const [wizardComplete, setWizardComplete] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /** Wizard scroll container — avoid `scrollIntoView` (it scrolls the window). */
  const mainScrollRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = mainScrollRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  useEffect(() => {
    onEngagedChange?.(Boolean(urgency))
  }, [urgency, onEngagedChange])

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
          inputs ?? (urgency ? { how_urgent: urgency } : undefined)
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
    [conversationId, scrollToBottom, urgency, userId]
  )

  const pickUrgency = useCallback(
    (label) => {
      setUrgency(label)
      onEngagedChange?.(true)
      setLines((prev) => [
        ...prev,
        { id: uid(), type: 'user', text: label },
        {
          id: uid(),
          type: 'bot',
          node: <p className={styles.scenariosLead}>{COMMON_SCENARIOS_PROMPT}</p>,
        },
      ])
      setStep('scenarios')
      scrollToBottom()
    },
    [onEngagedChange, scrollToBottom]
  )

  const pickScenario = useCallback(
    async (label) => {
      if (!urgency || loading) return
      if (label === 'Something else...') {
        setLines((prev) => [...prev, { id: uid(), type: 'user', text: label }])
        setStep('customUser')
        scrollToBottom()
        return
      }

      const scenarioText = (label || '').trim() || 'your selected scenario'
      const standby = `Got it! I'm going to search my proprietary database for ${scenarioText} (urgency: ${urgency}). This will take a minute or so to analyze all of the data we've gathered on Massachusetts assisted living facilities... Stand by!`
      const loc = locationHintFromPresetScenario(label)
      setLines((prev) => [
        ...prev,
        { id: uid(), type: 'user', text: label },
        { id: uid(), type: 'bot', node: <>{standby}</> },
      ])
      setStep('idle')
      scrollToBottom()
      await runDifyQuery(composePresetListQuery(label, urgency), {
        how_urgent: urgency,
        Location: loc,
      })
    },
    [loading, runDifyQuery, scrollToBottom, urgency]
  )

  const submitCustomUserQuestion = useCallback(() => {
    const t = customUserQuestion.trim()
    if (!t || !urgency || loading) return
    setPendingCustomUserQuestion(t)
    setLines((prev) => [...prev, { id: uid(), type: 'user', text: t }])
    setCustomUserQuestion('')
    setStep('customLocation')
    scrollToBottom()
  }, [customUserQuestion, loading, scrollToBottom, urgency])

  const submitCustomSearchLocation = useCallback(async () => {
    const loc = customSearchLocation.trim()
    const userQ = pendingCustomUserQuestion?.trim()
    if (!loc || !urgency || loading || !userQ) return

    const nickname = guessLovedOneDisplayName(userQ)
    const standby = `Got it! I'm going to search my proprietary database for ${userQ} in ${loc} for ${nickname} (urgency: ${urgency}). This will take a minute or so to analyze all of the data we've gathered on Massachusetts assisted living facilities... Stand by!`

    setLines((prev) => [
      ...prev,
      { id: uid(), type: 'user', text: loc },
      { id: uid(), type: 'bot', node: <>{standby}</> },
    ])
    setCustomSearchLocation('')
    setPendingCustomUserQuestion(null)
    setStep('idle')
    scrollToBottom()
    await runDifyQuery(composeCustomListQuery(userQ, loc), {
      how_urgent: urgency,
      Location: loc,
    })
  }, [customSearchLocation, loading, pendingCustomUserQuestion, runDifyQuery, scrollToBottom, urgency])

  const sendFollowUp = useCallback(async () => {
    const t = followInput.trim()
    if (!t || loading) return
    setFollowInput('')
    setLines((prev) => [...prev, { id: uid(), type: 'user', text: t }])
    const composed = composeFollowUpQuery(contextBundle, t)
    scrollToBottom()
    await runDifyQuery(composed)
  }, [contextBundle, followInput, loading, runDifyQuery, scrollToBottom])

  const resetAll = useCallback(() => {
    setStep('urgency')
    const prefilledUrgency = urgencyFromPrefill(prefilledVariables) || null
    setUrgency(prefilledUrgency)
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
        </div>

        <div className={styles.bottomBar}>
          {error && <p className={styles.error}>{error}</p>}

          {step === 'customUser' && (
            <div className={styles.composer}>
              <textarea
                className={styles.textarea}
                placeholder={CUSTOM_USER_PLACEHOLDER}
                value={customUserQuestion}
                disabled={loading}
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
