import { useState, useEffect, useRef } from 'react'
import AuthCapture from './AuthCapture'
import styles from '../styles/FacilityDeepDive.module.css'
import { captureWithExperiment } from '../lib/posthogClient'

const STRIPE_UPGRADE_URL =
  process.env.NEXT_PUBLIC_STRIPE_UPGRADE_URL ||
  'https://buy.stripe.com/fZubJ02Gd3eKeyV5lm6Ri00'

const LS_EMAIL_KEY = 'assistedly_email'
const LS_DEEP_DIVE_METRICS_KEY = 'assistedly_deep_dive_metrics_v1'
const HEAVY_USER_LOCK_HITS = 2
const HEAVY_USER_STARTS = 3

function readDeepDiveMetrics() {
  if (typeof window === 'undefined') {
    return { reportStarts: 0, lockHits: 0, authReturns: 0, stripeClicks: 0 }
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LS_DEEP_DIVE_METRICS_KEY) || '{}')
    return {
      reportStarts: Number(parsed.reportStarts || 0),
      lockHits: Number(parsed.lockHits || 0),
      authReturns: Number(parsed.authReturns || 0),
      stripeClicks: Number(parsed.stripeClicks || 0),
    }
  } catch {
    return { reportStarts: 0, lockHits: 0, authReturns: 0, stripeClicks: 0 }
  }
}

function writeDeepDiveMetrics(next) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_DEEP_DIVE_METRICS_KEY, JSON.stringify(next))
}

function bumpDeepDiveMetric(key) {
  const current = readDeepDiveMetrics()
  const next = { ...current, [key]: Number(current[key] || 0) + 1 }
  writeDeepDiveMetrics(next)
  return next
}

function trackDeepDiveEvent(event, properties = {}) {
  if (typeof window === 'undefined') return
  captureWithExperiment(event, properties)
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event, ...properties })
}

// ── SSE line parser ──────────────────────────────────────────────────────────
function parseSseLine(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed.startsWith('data:')) return null
  const raw = trimmed.slice(5).trim()
  if (!raw || raw === '[DONE]') return null
  try { return JSON.parse(raw) } catch { return null }
}

// ── Upgrade banner shown to authenticated users after full report ────────────
function UpgradeBanner({ onCtaClick }) {
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
          onClick={onCtaClick}
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

function FreeInsights({ facility }) {
  const latestCompliance = Array.isArray(facility.complianceHistory)
    ? facility.complianceHistory.slice(0, 2)
    : []
  const costRange = `$${Number(facility.monthlyMin || 0).toLocaleString()} - $${Number(
    facility.monthlyMax || 0
  ).toLocaleString()}/mo`

  const cards = [
    {
      title: 'Safety snapshot',
      value: `${facility.rating}/5 rating · ${facility.complianceRating} compliance`,
      detail: `${facility.capacity} licensed resident capacity`,
    },
    {
      title: 'Compliance highlights',
      value:
        latestCompliance.length > 0
          ? latestCompliance.map((row) => `${row.date}: ${row.status}`).join(' · ')
          : 'No recent records available',
      detail: 'Pulled from Massachusetts inspection records',
    },
    {
      title: 'Pricing context',
      value: costRange,
      detail: `Care types: ${Array.isArray(facility.careTypes) ? facility.careTypes.join(', ') : 'N/A'}`,
    },
    {
      title: 'Best-fit summary',
      value: Array.isArray(facility.careTypes) && facility.careTypes[0]
        ? `Likely fit for residents needing ${facility.careTypes[0]}`
        : 'Fit depends on care needs and staffing profile',
      detail: 'Unlock full AI reasoning and tailored tour questions',
    },
  ]

  return (
    <div className={styles.freeInsightsGrid}>
      {cards.map((card) => (
        <article key={card.title} className={styles.freeInsightCard}>
          <h3>{card.title}</h3>
          <p className={styles.freeInsightValue}>{card.value}</p>
          <p className={styles.freeInsightDetail}>{card.detail}</p>
        </article>
      ))}
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
  const [deepDiveMetrics, setDeepDiveMetrics] = useState({
    reportStarts: 0,
    lockHits: 0,
    authReturns: 0,
    stripeClicks: 0,
  })
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
    setDeepDiveMetrics(readDeepDiveMetrics())
  }, [])

  // Abort any in-flight stream when unmounting
  useEffect(() => () => abortRef.current?.abort(), [])

  // ── Stream reader ──────────────────────────────────────────────────────────
  async function startStream() {
    const nextMetrics = bumpDeepDiveMetric('reportStarts')
    setDeepDiveMetrics(nextMetrics)
    trackDeepDiveEvent('facility_deep_dive_viewed', {
      facility_slug: facility.slug,
      is_authenticated: Boolean(email),
      report_starts: nextMetrics.reportStarts,
      lock_hits: nextMetrics.lockHits,
    })

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
            const updated = bumpDeepDiveMetric('lockHits')
            setDeepDiveMetrics(updated)
            trackDeepDiveEvent('facility_deep_dive_locked', {
              facility_slug: facility.slug,
              report_starts: updated.reportStarts,
              lock_hits: updated.lockHits,
            })
            reader.cancel()
            return
          } else if (event.type === 'done') {
            setStatus('done')
            trackDeepDiveEvent('facility_deep_dive_completed', {
              facility_slug: facility.slug,
              is_authenticated: Boolean(email),
            })
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
    trackDeepDiveEvent('facility_deep_dive_auth_return_attempted', {
      facility_slug: facility.slug,
    })
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
            const updated = bumpDeepDiveMetric('authReturns')
            setDeepDiveMetrics(updated)
            trackDeepDiveEvent('facility_deep_dive_auth_returned', {
              facility_slug: facility.slug,
              auth_returns: updated.authReturns,
            })
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

  const shouldElevateUpgrade =
    deepDiveMetrics.lockHits >= HEAVY_USER_LOCK_HITS || deepDiveMetrics.reportStarts >= HEAVY_USER_STARTS

  const handleStripeClick = (placement) => {
    const updated = bumpDeepDiveMetric('stripeClicks')
    setDeepDiveMetrics(updated)
    trackDeepDiveEvent('facility_deep_dive_stripe_clicked', {
      facility_slug: facility.slug,
      placement,
      stripe_clicks: updated.stripeClicks,
      lock_hits: updated.lockHits,
      report_starts: updated.reportStarts,
    })
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
        <p className={styles.freePreviewNote}>
          Free preview includes structured safety, compliance, pricing, and fit insights.
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

        <FreeInsights facility={facility} />

        {email ? (
          // Email captured — waiting for magic-link click
          <div className={styles.gateBox}>
            <p className={styles.gateHeading}>📧 Check your inbox for free unlock</p>
            <p className={styles.gateSubtext}>
              We sent a sign-in link to <em>{email}</em>. After clicking it,
              return here and load your full AI deep-dive report at no cost.
            </p>
            <button
              type="button"
              className={styles.generateBtn}
              onClick={handleUnlockAfterAuth}
              disabled={unlocking}
            >
              {unlocking ? 'Loading…' : 'Load full report'}
            </button>
            {shouldElevateUpgrade ? (
              <>
                <p className={styles.gateOr}>— need instant access now? —</p>
                <a
                  href={STRIPE_UPGRADE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.upgradeBtn}
                  onClick={() => handleStripeClick('locked_after_email')}
                >
                  Upgrade to Premium for instant access
                </a>
              </>
            ) : null}
          </div>
        ) : (
          // No email yet — show free unlock first
          <div className={styles.gateBox}>
            <p className={styles.gateHeading}>
              📊 Sign in free to read the full AI report
            </p>
            <p className={styles.gateSubtext}>
              Free unlock gives you the full safety analysis, compliance insights,
              value assessment, and personalised tour questions for {facility.name}.
            </p>
            <AuthCapture
              reason="Enter your email to unlock this report for free."
              submitLabel="Unlock full report free"
              successMessage="Check your email for your free unlock link."
              fallbackMessage="Test mode: use the unlock link below."
              onSuccess={handleAuthSuccess}
              onSubmitStart={() =>
                trackDeepDiveEvent('facility_deep_dive_email_submit_started', {
                  facility_slug: facility.slug,
                })
              }
              onSubmitResult={(result) =>
                trackDeepDiveEvent('facility_deep_dive_email_submit_result', {
                  facility_slug: facility.slug,
                  ok: Boolean(result?.ok),
                  provider_sent: Boolean(result?.sent),
                })
              }
            />
            {shouldElevateUpgrade ? (
              <>
                <p className={styles.gateOr}>— or get instant premium unlock —</p>
                <a
                  href={STRIPE_UPGRADE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.upgradeBtn}
                  onClick={() => handleStripeClick('locked_before_email')}
                >
                  Upgrade to Premium now
                </a>
              </>
            ) : null}
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
      <UpgradeBanner onCtaClick={() => handleStripeClick('post_full_report')} />
    </div>
  )
}
