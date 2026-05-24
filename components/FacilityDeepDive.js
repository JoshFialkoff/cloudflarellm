import { useState, useEffect, useRef } from 'react'
import AuthCapture from './AuthCapture'
import styles from '../styles/FacilityDeepDive.module.css'

const STRIPE_UPGRADE_URL =
  process.env.NEXT_PUBLIC_STRIPE_UPGRADE_URL ||
  'https://buy.stripe.com/fZubJ02Gd3eKeyV5lm6Ri00'

const LS_EMAIL_KEY = 'assistedly_email'

// ── SSE line parser ──────────────────────────────────────────────────────────
function parseSseLine(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed.startsWith('data:')) return null
  const raw = trimmed.slice(5).trim()
  if (!raw || raw === '[DONE]') return null
  try { return JSON.parse(raw) } catch { return null }
}

// ── Upgrade banner shown to authenticated users after full report ────────────
function UpgradeBanner() {
  return (
    <div className={styles.upgradeBanner}>
      <div className={styles.upgradeBannerInner}>
        <div className={styles.upgradeBannerText}>
          <strong>🚀 You&apos;re on the free plan</strong>
          <p>
            Upgrade to Premium for unlimited AI facility reports, saved
            comparisons, personalised matching, and priority advisor access.
          </p>
        </div>
        <a
          href={STRIPE_UPGRADE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.upgradeBtn}
        >
          Upgrade to Premium
        </a>
      </div>
    </div>
  )
}

// ── Rendered report body ─────────────────────────────────────────────────────
function ReportBody({ text }) {
  return (
    <div className={styles.reportContent}>
      {String(text || '').split('\n').map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <br key={i} />
        if (/^\d+\.\s/.test(trimmed)) {
          return <h3 key={i} className={styles.reportSection}>{trimmed}</h3>
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          return (
            <li key={i} className={styles.reportListItem}>
              {trimmed.replace(/^[-•]\s*/, '')}
            </li>
          )
        }
        return <p key={i} className={styles.reportPara}>{trimmed}</p>
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function FacilityDeepDive({ facility }) {
  // status: idle | streaming | locked | done | error
  const [status, setStatus] = useState('idle')
  const [streamedText, setStreamedText] = useState('')
  const [teaserText, setTeaserText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [email, setEmail] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const abortRef = useRef(null)

  // Restore email from localStorage or existing session on mount
  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(LS_EMAIL_KEY)
        : null
    if (stored) { setEmail(stored); return }
    fetch('/api/auth/me')
      .then((r) => r.json())
      .catch(() => ({}))
      .then((data) => { if (data.authenticated && data.email) setEmail(data.email) })
  }, [])

  // Abort any in-flight stream when unmounting
  useEffect(() => () => abortRef.current?.abort(), [])

  // ── Stream reader ──────────────────────────────────────────────────────────
  async function startStream() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStreamedText('')
    setTeaserText('')
    setErrorMsg('')
    setStatus('streaming')

    let res
    try {
      res = await fetch('/api/facility-deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facility }),
        signal: controller.signal,
      })
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMsg('Could not connect. Please try again.')
        setStatus('error')
      }
      return
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErrorMsg(data.error || `Request failed (${res.status}).`)
      setStatus('error')
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let lineBuffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop() ?? ''

        for (const line of lines) {
          const event = parseSseLine(line)
          if (!event) continue

          if (event.type === 'token') {
            setStreamedText((prev) => prev + event.text)
          } else if (event.type === 'locked') {
            setTeaserText(event.teaser || '')
            setStatus('locked')
            reader.cancel()
            return
          } else if (event.type === 'done') {
            setStatus('done')
            reader.cancel()
            return
          } else if (event.type === 'error') {
            setErrorMsg(event.message || 'Stream error.')
            setStatus('error')
            reader.cancel()
            return
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMsg('Stream interrupted. Please try again.')
        setStatus('error')
      }
      return
    } finally {
      try { reader.cancel() } catch { /* ignore */ }
    }

    // Stream closed without an explicit terminal event — treat as done
    if (status === 'streaming') setStatus('done')
  }

  // ── Re-fetch after magic-link auth to get full content ────────────────────
  async function handleUnlockAfterAuth() {
    setUnlocking(true)
    setStreamedText('')
    setTeaserText('')
    setErrorMsg('')
    setStatus('streaming')

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let res
    try {
      res = await fetch('/api/facility-deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facility }),
        signal: controller.signal,
      })
    } catch {
      setStatus('locked')
      setUnlocking(false)
      return
    }

    if (!res.ok) {
      setStatus('locked')
      setUnlocking(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let lineBuffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop() ?? ''

        for (const line of lines) {
          const event = parseSseLine(line)
          if (!event) continue
          if (event.type === 'token') {
            setStreamedText((prev) => prev + event.text)
          } else if (event.type === 'done') {
            setStatus('done')
            reader.cancel()
            setUnlocking(false)
            return
          } else if (event.type === 'locked') {
            // Still not authenticated — keep locked state, show what we got
            setTeaserText(event.teaser || streamedText)
            setStatus('locked')
            reader.cancel()
            setUnlocking(false)
            return
          } else if (event.type === 'error') {
            setStatus('locked')
            reader.cancel()
            setUnlocking(false)
            return
          }
        }
      }
    } catch {
      // ignore
    } finally {
      try { reader.cancel() } catch { /* ignore */ }
      setUnlocking(false)
    }

    if (status === 'streaming') setStatus('done')
  }

  const handleAuthSuccess = (capturedEmail) => {
    setEmail(capturedEmail)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (status === 'idle') {
    return (
      <div className={styles.idleCard}>
        <div className={styles.idleIcon}>🤖</div>
        <h2 className={styles.idleTitle}>AI Deep-Dive Report</h2>
        <p className={styles.idleDesc}>
          Get an expert AI analysis of <strong>{facility.name}</strong>: safety
          signals, compliance insights, value assessment, and the key questions
          to ask on tour.
        </p>
        <button type="button" className={styles.generateBtn} onClick={startStream}>
          Generate AI Report
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.idleCard}>
        <p className={styles.errorText}>{errorMsg}</p>
        <button type="button" className={styles.generateBtn} onClick={startStream}>
          Try Again
        </button>
      </div>
    )
  }

  // ── Streaming: show tokens as they arrive ──────────────────────────────────
  if (status === 'streaming') {
    return (
      <div className={styles.reportCard}>
        <h2 className={styles.reportTitle}>AI Deep-Dive Report</h2>
        <div className={styles.streamingBadge}>
          <span className={styles.streamingDot} />
          Generating…
        </div>
        <ReportBody text={streamedText} />
      </div>
    )
  }

  // ── Locked: teaser + email gate + Stripe CTA ───────────────────────────────
  if (status === 'locked') {
    const displayText = teaserText || streamedText
    return (
      <div className={styles.reportCard}>
        <h2 className={styles.reportTitle}>AI Deep-Dive Report</h2>

        {/* Partial streamed text fading out */}
        <div className={styles.teaserBlock}>
          <ReportBody text={displayText} />
          <div className={styles.teaserFade} />
        </div>

        {email ? (
          // Email captured — waiting for magic-link click
          <div className={styles.gateBox}>
            <p className={styles.gateHeading}>📧 Check your inbox</p>
            <p className={styles.gateSubtext}>
              We sent a sign-in link to <em>{email}</em>. After clicking it,
              return here and load the full report.
            </p>
            <button
              type="button"
              className={styles.generateBtn}
              onClick={handleUnlockAfterAuth}
              disabled={unlocking}
            >
              {unlocking ? 'Loading…' : 'Load full report'}
            </button>
            <p className={styles.gateOr}>— or skip the wait —</p>
            <a
              href={STRIPE_UPGRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.upgradeBtn}
            >
              Upgrade to Premium for instant access
            </a>
          </div>
        ) : (
          // No email yet — show capture form + Stripe option
          <div className={styles.gateBox}>
            <p className={styles.gateHeading}>
              📊 Sign in free to read the full AI report
            </p>
            <p className={styles.gateSubtext}>
              Includes safety analysis, compliance insights, value assessment,
              and personalised tour questions for {facility.name}.
            </p>
            <AuthCapture reason="" onSuccess={handleAuthSuccess} />
            <p className={styles.gateOr}>— or —</p>
            <a
              href={STRIPE_UPGRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.upgradeBtn}
            >
              Upgrade to Premium for instant access
            </a>
          </div>
        )}
      </div>
    )
  }

  // ── Done: full report + Stripe upgrade banner ──────────────────────────────
  return (
    <div className={styles.reportCard}>
      <h2 className={styles.reportTitle}>AI Deep-Dive Report</h2>
      <ReportBody text={streamedText} />
      <UpgradeBanner />
    </div>
  )
}
