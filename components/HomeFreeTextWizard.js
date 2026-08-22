'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { streamDifyChatResponse } from '../lib/streamDifyChat'
import { composeCustomListQuery } from '../lib/composeAssistedlyQuery'
import { trackChatStarted, trackMessageSent, messagePreview } from '../lib/chatAnalytics'
import { pushConversionDataLayer } from '../lib/conversionDataLayer'
import posthog from '../lib/posthogClient'
import styles from './HomeFreeTextWizard.module.css'

const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CARE_TYPE_OPTIONS = [
  { value: 'assisted', label: 'Assisted living', keywords: ['assisted living', 'assisted', 'independent living', 'senior living'] },
  { value: 'memory', label: 'Memory care', keywords: ['memory care', 'memory', 'dementia', 'alzheimer'] },
  { value: 'skilled', label: 'Skilled nursing', keywords: ['skilled nursing', 'nursing home', 'rehab', 'snf'] },
]

const ROTATING_PLACEHOLDERS = [
  'My 82-year-old dad needs memory care in Lexington, MA',
  'I\'m looking for assisted living near Winchester for my mom',
  'Help me find options for a wheelchair-user in Amherst',
]

function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const arr = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr)
  else { for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256) }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getOrCreateUserId() {
  if (typeof window === 'undefined') return 'anonymous'
  try {
    const key = 'assistedly-dify-user-id'
    let id = window.sessionStorage.getItem(key)
    if (!id) { id = uid(); window.sessionStorage.setItem(key, id) }
    return id
  } catch { return 'u-' + Date.now() }
}

function extractFields(text) {
  const zipMatch = text.match(/\b(\d{5})\b/)
  const budgetMatch = text.match(/\$\s*([\d,]+)|(?:monthly|per month|a month)\s+(?:budget\s+)?(?:of\s+)?\$?([\d,]+)/i)
  const budget = budgetMatch ? Number((budgetMatch[1] || budgetMatch[2]).replace(/,/g, '')) : null

  let careType = 'assisted'
  for (const option of CARE_TYPE_OPTIONS) {
    if (option.keywords.some((k) => text.toLowerCase().includes(k))) {
      careType = option.value
      break
    }
  }

  const locationMatch = text.match(/(?:in|near|around)\s+([A-Za-z\s]+?)(?:,\s*MA|\bMA\b|$)/i)
  const location = locationMatch ? locationMatch[1].trim() + ', MA' : ''

  return {
    zip: zipMatch ? zipMatch[1] : '',
    budget: Number.isFinite(budget) && budget > 0 ? budget : null,
    careType,
    location,
    rawText: text,
  }
}

function parseAssistantMatches(text) {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return null

  const introMatch = normalized.match(/^(.*?)\n\n(?=\d+\))/s)
  const intro = introMatch ? introMatch[1].trim() : ''
  const body = introMatch ? normalized.slice(introMatch[0].length) : normalized

  const itemStarts = [...body.matchAll(/(?:^|\n)\s*(\d+)\)\s+/g)]
  if (itemStarts.length === 0) return null

  const items = itemStarts.map((match, index) => {
    const contentStart = match.index + match[0].length
    const contentEnd = index + 1 < itemStarts.length ? itemStarts[index + 1].index : body.length
    const block = body.slice(contentStart, contentEnd).trim()
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const title = (lines[0] ?? block).trim()
    let memoryCare
    let why
    for (const line of lines.slice(1)) {
      const m1 = line.match(/^(?:\d+[.)]\s*|-\s*|•\s*)?(?:\*\*)?Memory care:(?:\*\*)?\s*(.+)$/i)
      const m2 = line.match(/^(?:\d+[.)]\s*|-\s*|•\s*)?(?:\*\*)?Why:(?:\*\*)?\s*(.+)$/i)
      if (m1) memoryCare = m1[1].trim()
      if (m2) why = m2[1].trim()
    }
    if (!memoryCare && !why) {
      const inline = block.match(/^(.*?)\s+-\s+Memory care:\s*(.*?)(?:\s+-\s+Why:\s*(.*))?$/is)
      if (inline) return { title: inline[1].trim(), memoryCare: inline[2]?.trim(), why: inline[3]?.trim() }
      const sentence = block.match(/^(.*?)[.\s]+Memory care:\s*(.*?)(?:[.\s]+Why:\s*(.*))?\.?\s*$/is)
      if (sentence) return { title: sentence[1].trim(), memoryCare: sentence[2]?.trim(), why: sentence[3]?.trim() }
    }
    return { title, memoryCare, why }
  })

  if (items.length === 0) return null
  return { intro, items }
}

function renderMarkdownText(text) {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
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
  const parsed = parseAssistantMatches(text)
  if (!parsed) {
    return <div className={styles.assistantText}>{renderMarkdownText(text)}</div>
  }
  const detailItems = (item) => [
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

export default function HomeFreeTextWizard({ homepage_layout = '', onEngagedChange }) {
  const userIdRef = useRef(getOrCreateUserId())
  const chatThreadRef = useRef(null)
  const chatStartedTracked = useRef(false)

  const [phase, setPhase] = useState('landing')
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [rotatingPlaceholder, setRotatingPlaceholder] = useState(ROTATING_PLACEHOLDERS[0])

  const [extracted, setExtracted] = useState({ zip: '', budget: null, careType: 'assisted', location: '', rawText: '' })
  const [budgetInput, setBudgetInput] = useState('')
  const [zipInput, setZipInput] = useState('')
  const [careTypeInput, setCareTypeInput] = useState('assisted')

  const [results, setResults] = useState(null)
  const [resultsLoading, setResultsLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [captureStatus, setCaptureStatus] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    let idx = 0
    let cancelled = false
    const cycle = async () => {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 4000))
        if (cancelled) break
        idx = (idx + 1) % ROTATING_PLACEHOLDERS.length
        setRotatingPlaceholder(ROTATING_PLACEHOLDERS[idx])
      }
    }
    cycle()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (chatThreadRef.current) {
      chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight
    }
  }, [messages, isStreaming, statusMsg])

  const trackStep = useCallback((stepName, extra = {}) => {
    posthog.capture('wizard_step_entry', { step_name: stepName, ...extra })
  }, [])

  const handleSend = useCallback(async () => {
    const text = inputValue.trim() || rotatingPlaceholder
    if (isStreaming) return
    if (!text) return

    setInputValue('')
    setIsStreaming(true)
    setStatusMsg('Thinking…')
    setPhase('chat')
    onEngagedChange?.(true)

    const fields = extractFields(text)
    setExtracted(fields)
    setZipInput(fields.zip)
    setCareTypeInput(fields.careType)
    if (fields.budget) setBudgetInput(String(fields.budget))

    if (!chatStartedTracked.current) {
      chatStartedTracked.current = true
      trackChatStarted({
        bot_surface: 'homepage_free_text_wizard',
        assistant_mode: 'dify_inline',
        lead_source: 'homepage_free_text',
        homepage_layout,
      })
    }

    trackMessageSent({
      message_index: messages.filter((m) => m.role === 'user').length,
      message_preview: messagePreview(text),
      bot_surface: 'homepage_free_text_wizard',
      assistant_mode: 'dify_inline',
    })
    trackStep('free_text_intro', { had_zip: Boolean(fields.zip), had_budget: Boolean(fields.budget) })

    setMessages((prev) => [...prev, { role: 'user', content: text }])

    let assistantContent = ''
    try {
      await streamDifyChatResponse(
        text,
        userIdRef.current,
        conversationId,
        {
          onDelta: (delta) => {
            assistantContent += delta
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, content: assistantContent, streaming: true }
              } else {
                next.push({ role: 'assistant', content: assistantContent, streaming: true })
              }
              return next
            })
          },
          onStatus: (msg) => setStatusMsg(msg),
          onConversationId: (id) => setConversationId(id),
          onStreamError: () => {
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              const errorText = 'Sorry, something went wrong. Please try again or scroll down to search manually.'
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, content: errorText, streaming: false }
              } else {
                next.push({ role: 'assistant', content: errorText, streaming: false })
              }
              return next
            })
            setIsStreaming(false)
            setStatusMsg('')
          },
          onFinal: (answer) => {
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, content: answer, streaming: false }
              } else {
                next.push({ role: 'assistant', content: answer, streaming: false })
              }
              return next
            })
            setIsStreaming(false)
            setStatusMsg('')
            trackStep('free_text_chat_complete', { conversation_id: conversationId })
          },
        }
      )
    } catch {
      setIsStreaming(false)
      setStatusMsg('')
    }
  }, [inputValue, rotatingPlaceholder, isStreaming, conversationId, messages, trackStep, homepage_layout, onEngagedChange])

  const handleDetailsSubmit = useCallback(async () => {
    const parsedBudget = Number(budgetInput.replace(/[^\d]/g, ''))
    const normalizedZip = zipInput.replace(/\D/g, '').slice(0, 5)
    if (!parsedBudget || normalizedZip.length !== 5) return

    setResultsLoading(true)
    setPhase('results')
    trackStep('budget_details_submitted', {
      monthly_budget: parsedBudget,
      zip_code: normalizedZip,
      care_type: careTypeInput,
      homepage_layout,
    })

    const location = extracted.location || `ZIP ${normalizedZip}, MA`
    const composed = composeCustomListQuery(extracted.rawText || 'Find assisted living options', location, null, parsedBudget)

    const inputs = {
      monthly_budget: parsedBudget,
      zip_code: normalizedZip,
      care_type: careTypeInput,
      Location: location,
    }

    let assistantContent = ''
    try {
      await streamDifyChatResponse(
        composed,
        userIdRef.current,
        conversationId,
        {
          onDelta: (delta) => {
            assistantContent += delta
            setResults({ text: assistantContent, streaming: true })
          },
          onStatus: (msg) => setStatusMsg(msg),
          onConversationId: (id) => setConversationId(id),
          onStreamError: () => {
            setResults({ text: 'Sorry, no results came back. Please try again.', streaming: false })
            setResultsLoading(false)
            setStatusMsg('')
          },
          onFinal: (answer) => {
            setResults({ text: answer, streaming: false })
            setResultsLoading(false)
            setStatusMsg('')
            posthog.capture('wizard_completed', {
              wizard_variant: 'free_text',
              homepage_layout,
            })
            pushConversionDataLayer({
              event: 'wizard_completed',
              wizard_variant: 'free_text',
              homepage_layout,
            })
          },
        },
        inputs
      )
    } catch {
      setResults({ text: 'Sorry, something went wrong while searching.', streaming: false })
      setResultsLoading(false)
      setStatusMsg('')
    }
  }, [budgetInput, zipInput, careTypeInput, extracted, conversationId, trackStep, homepage_layout])

  const handleCapture = useCallback(async () => {
    const trimmed = email.trim()
    if (!trimmed) {
      setCaptureStatus('No problem — your results are shown above.')
      return
    }
    if (!EMAIL_RE.test(trimmed)) {
      setCaptureStatus('Please enter a valid email address.')
      return
    }
    setIsCapturing(true)
    setCaptureStatus('Sending…')
    try {
      const res = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          zip: zipInput || extracted.zip,
          facilityType: CARE_TYPE_OPTIONS.find((c) => c.value === careTypeInput)?.label || 'Assisted living',
          location: extracted.location || '',
          authSurface: 'homepage_free_text_wizard',
          redirectTo: '/',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setCaptureStatus('Check your email for a secure sign-in link.')
        posthog.capture('generate_lead', {
          lead_source: 'homepage_free_text_wizard',
          homepage_layout,
          wizard_variant: 'free_text',
        })
        pushConversionDataLayer({
          event: 'generate_lead',
          lead_source: 'homepage_free_text_wizard',
          wizard_variant: 'free_text',
          homepage_layout,
        })
      } else {
        setCaptureStatus(data.error || 'Could not send. Please try again.')
      }
    } catch {
      setCaptureStatus('Network error. Please try again.')
    } finally {
      setIsCapturing(false)
    }
  }, [email, zipInput, extracted, careTypeInput, homepage_layout])

  const canShowDetails = phase === 'chat' && !isStreaming && messages.some((m) => m.role === 'assistant' && !m.streaming)
  const showResults = phase === 'results' || phase === 'capture'
  const showCapture = phase === 'capture' || (phase === 'results' && results && !results.streaming && !resultsLoading)
  const isExpanded = phase === 'chat' || phase === 'results' || phase === 'capture'

  const chatContent = (
    <>
      {messages.map((m, i) => (
        <div key={i} className={m.role === 'user' ? styles.userBubble : styles.botLine}>
          {m.role !== 'user' && <div className={styles.avatar} aria-hidden><svg className={styles.avatarSvg} viewBox="0 0 24 24" width="20" height="20" focusable="false"><path fill="currentColor" d={HEART_PATH} /></svg></div>}
          {m.role !== 'user' ? (
            <div className={styles.botBubble}>
              <AssistantText text={m.content} />
              {m.streaming && <span style={{ opacity: 0.5 }}>▌</span>}
            </div>
          ) : (
            <div className={styles.userBubble}>{m.content}</div>
          )}
        </div>
      ))}

      {isStreaming && messages[messages.length - 1]?.role === 'user' && (
        <div className={styles.botLine}>
          <div className={styles.avatar} aria-hidden><svg className={styles.avatarSvg} viewBox="0 0 24 24" width="20" height="20" focusable="false"><path fill="currentColor" d={HEART_PATH} /></svg></div>
          <div className={styles.botBubble}>
            <span style={{ opacity: 0.5 }}>Thinking…</span>
          </div>
        </div>
      )}

      {showResults && results && (
        <div className={styles.wideBotLine}>
          <div className={styles.avatar} aria-hidden><svg className={styles.avatarSvg} viewBox="0 0 24 24" width="20" height="20" focusable="false"><path fill="currentColor" d={HEART_PATH} /></svg></div>
          <div className={`${styles.botBubble} ${styles.resultBubble}`}>
            <AssistantText text={results.text} />
            {results.streaming && <span style={{ opacity: 0.5 }}>▌</span>}
          </div>
        </div>
      )}
    </>
  )

  const toolsPanel = (
    <div className={styles.toolsPanel}>
      {canShowDetails && (
        <div className={styles.detailsForm}>
          <p style={{ margin: '0 0 0.3rem', fontSize: '0.88rem', color: '#333', fontWeight: 600 }}>
            To show matching facilities, I need:
          </p>
          <label>
            Monthly budget
            <input
              inputMode="numeric"
              placeholder="$8,000"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
            />
          </label>
          <div className={styles.row}>
            <label>
              ZIP code
              <input
                inputMode="numeric"
                maxLength={5}
                placeholder="01801"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
              />
            </label>
            <label>
              Type of care
              <select value={careTypeInput} onChange={(e) => setCareTypeInput(e.target.value)}>
                {CARE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className={styles.ctaBtn}
            disabled={!budgetInput || zipInput.length !== 5 || resultsLoading}
            onClick={() => void handleDetailsSubmit()}
          >
            {resultsLoading ? 'Searching…' : 'Show matching facilities'}
          </button>
        </div>
      )}

      {showCapture && (
        <div className={styles.captureSection}>
          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#1f1f1f' }}>
            Want to save these results?
          </p>
          <label>
            Email address (optional)
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCapture()
              }}
            />
          </label>
          <button
            type="button"
            className={styles.ctaBtn}
            disabled={isCapturing}
            onClick={() => void handleCapture()}
          >
            {isCapturing ? 'Sending…' : email.trim() ? 'Send me my matches' : 'Continue without saving'}
          </button>
          {captureStatus ? <p className={styles.captureStatus}>{captureStatus}</p> : null}
        </div>
      )}
    </div>
  )

  return (
    <div className={`${styles.wizardFrame} ${isExpanded ? styles.wizardFrameExpanded : ''}`}>
      {phase === 'landing' && (
        <div ref={chatThreadRef} className={styles.chatThread}>
          <div className={styles.landingPrompt}>
            <p className={styles.landingTitle}>How can private and unbiased AI help your family?</p>
            <p className={styles.landingHint}>
              Tell us who you're looking for, where, and any budget — we'll narrow the best options.
            </p>
            <p style={{ fontSize: "0.78rem", color: "#888", margin: "-0.2rem 0 0.3rem" }}>
              Press enter to ask this question or write your own.
            </p>
            <textarea
              className={styles.textArea}
              autoFocus
              placeholder={rotatingPlaceholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
            />
            <button
              type="button"
              className={styles.sendBtn}
              disabled={isStreaming}
              onClick={() => void handleSend()}
            >
              Ask
            </button>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className={styles.twoColumnLayout}>
          <div className={styles.leftColumn}>
            <div ref={chatThreadRef} className={styles.chatThread}>
              {chatContent}
            </div>
            <div className={styles.bottomBar}>
              <div className={styles.bottomInputRow}>
                <input
                  type="text"
                  placeholder={isStreaming ? 'Thinking…' : 'Ask a follow-up…'}
                  value={inputValue}
                  disabled={isStreaming}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSend()
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.sendBtn}
                  disabled={isStreaming || !inputValue.trim()}
                  onClick={() => void handleSend()}
                >
                  Send
                </button>
              </div>
              <div className={styles.statusMsg}>{statusMsg}</div>
            </div>
          </div>
          <div className={styles.rightColumn}>
            {toolsPanel}
          </div>
        </div>
      )}
    </div>
  )
}
