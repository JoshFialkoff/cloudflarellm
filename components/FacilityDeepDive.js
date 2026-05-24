import { useState, useEffect } from 'react'
import AuthCapture from './AuthCapture'
import styles from '../styles/FacilityDeepDive.module.css'

const STRIPE_UPGRADE_URL =
  process.env.NEXT_PUBLIC_STRIPE_UPGRADE_URL ||
  'https://buy.stripe.com/fZubJ02Gd3eKeyV5lm6Ri00'

const LS_EMAIL_KEY = 'assistedly_email'

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

export default function FacilityDeepDive({ facility }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [result, setResult] = useState(null) // { locked, teaser?, content? }
  const [email, setEmail] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  // Restore email from localStorage or session on mount
  useEffect(() => {
    const stored = typeof window !== 'undefined'
      ? window.localStorage.getItem(LS_EMAIL_KEY)
      : null
    if (stored) {
      setEmail(stored)
      return
    }
    fetch('/api/auth/me')
      .then((r) => r.json())
      .catch(() => ({}))
      .then((data) => {
        if (data.authenticated && data.email) setEmail(data.email)
      })
  }, [])

  const fetchDeepDive = async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/facility-deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facility }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setResult({ errorMsg: data.error || 'Something went wrong.' })
        return
      }
      setResult(data)
      setStatus('done')
    } catch {
      setStatus('error')
      setResult({ errorMsg: 'Could not load the AI report. Please try again.' })
    }
  }

  // After email capture, re-fetch to get full content via session
  // (the magic link will authenticate; until then show the teaser + thank-you)
  const handleAuthSuccess = (capturedEmail) => {
    setEmail(capturedEmail)
    // If the report is already loaded as locked, we can't yet unlock server-side
    // (user hasn't clicked their magic link). Show the upgrade path immediately.
  }

  // Re-fetch with authentication once user has a valid session
  const handleUnlockAfterAuth = async () => {
    setUnlocking(true)
    try {
      const res = await fetch('/api/facility-deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facility }),
      })
      const data = await res.json()
      if (res.ok) setResult(data)
    } finally {
      setUnlocking(false)
    }
  }

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
        <button type="button" className={styles.generateBtn} onClick={fetchDeepDive}>
          Generate AI Report
        </button>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={styles.idleCard}>
        <div className={styles.spinner} aria-label="Generating report…" />
        <p className={styles.loadingText}>
          Analysing {facility.name} data&hellip; this takes 10–20 seconds.
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.idleCard}>
        <p className={styles.errorText}>{result?.errorMsg}</p>
        <button type="button" className={styles.generateBtn} onClick={fetchDeepDive}>
          Try Again
        </button>
      </div>
    )
  }

  // ── status === 'done' ──────────────────────────────────────────────────────

  const isLocked = result?.locked && !email

  if (isLocked) {
    return (
      <div className={styles.reportCard}>
        <h2 className={styles.reportTitle}>AI Deep-Dive Report</h2>
        <div className={styles.teaserBlock}>
          <p className={styles.teaserText}>{result.teaser}</p>
          <div className={styles.teaserFade} />
        </div>
        <div className={styles.gateBox}>
          <p className={styles.gateHeading}>
            📊 Sign in free to read the full AI report
          </p>
          <p className={styles.gateSubtext}>
            Includes safety analysis, compliance insights, value assessment, and
            personalised tour questions for {facility.name}.
          </p>
          <AuthCapture
            reason=""
            onSuccess={handleAuthSuccess}
          />
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
      </div>
    )
  }

  // User has provided email (not yet clicked magic link, or is fully authenticated)
  const showTeaser = result?.locked && email
  const content = showTeaser ? result.teaser : result?.content

  return (
    <div className={styles.reportCard}>
      <h2 className={styles.reportTitle}>AI Deep-Dive Report</h2>

      {showTeaser && (
        <div className={styles.magicLinkNotice}>
          <strong>📧 Check your inbox</strong> — we sent a sign-in link to{' '}
          <em>{email}</em>. After signing in, come back to this page and click{' '}
          <button
            type="button"
            className={styles.inlineLink}
            onClick={handleUnlockAfterAuth}
            disabled={unlocking}
          >
            {unlocking ? 'loading…' : 'load full report'}
          </button>
          .
        </div>
      )}

      <div className={styles.reportContent}>
        {(content || '').split('\n').map((line, i) => {
          const trimmed = line.trim()
          if (!trimmed) return <br key={i} />
          // Bold numbered headings like "1. Safety & Quality Overview"
          if (/^\d+\.\s/.test(trimmed)) {
            return (
              <h3 key={i} className={styles.reportSection}>
                {trimmed}
              </h3>
            )
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

      {!showTeaser && <UpgradeBanner />}
    </div>
  )
}
