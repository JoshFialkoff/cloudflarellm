import React, { useState, useEffect } from 'react'
import { getConsent, setConsent } from '../../lib/seo/privacyAnalytics'

/**
 * ConsentManager
 * Lightweight GDPR/CCPA-compliant consent banner.
 * Place this in your root layout or _app.js so it renders on every page.
 *
 * No external cookies are dropped until the user interacts with this banner.
 */
export default function ConsentManager() {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const c = getConsent()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (c === null) setVisible(true)
  }, [])

  const acceptAll = () => {
    setConsent('granted')
    setVisible(false)
    // If GA4 is present, update consent mode
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'granted',
        analytics_storage: 'granted',
        functionality_storage: 'granted',
        personalization_storage: 'granted',
        security_storage: 'granted',
      })
    }
  }

  const acceptMinimal = () => {
    setConsent('minimal')
    setVisible(false)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        functionality_storage: 'granted',
        personalization_storage: 'denied',
        security_storage: 'granted',
      })
    }
  }

  const denyAll = () => {
    setConsent('denied')
    setVisible(false)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        functionality_storage: 'denied',
        personalization_storage: 'denied',
        security_storage: 'granted',
      })
    }
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Privacy consent banner"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#0f172a',
        color: '#f8fafc',
        padding: '16px 24px',
        fontSize: 14,
        lineHeight: 1.5,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0 }}>
            Your privacy is our top priority. We use <strong>privacy-first analytics</strong> to improve Assistedly.ai.
            We do not sell your data.
            {' '}
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                color: '#93c5fd',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {expanded ? 'Hide details' : 'Learn more'}
            </button>
          </p>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={denyAll} style={buttonStyle('#334155')}>Necessary only</button>
            <button onClick={acceptMinimal} style={buttonStyle('#475569')}>Minimal analytics</button>
            <button onClick={acceptAll} style={buttonStyle('#2563eb')}>Accept all</button>
          </div>
        </div>
        {expanded && (
          <div style={{ marginTop: 12, borderTop: '1px solid #334155', paddingTop: 12 }}>
            <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
              <li><strong>Necessary only:</strong> No cookies. Site functions normally; no analytics sent.</li>
              <li><strong>Minimal analytics:</strong> Privacy-first analytics (PostHog, no PII) to understand feature usage.</li>
              <li><strong>Accept all:</strong> Includes Google Analytics 4 and conversion tracking to optimize matching quality.</li>
            </ul>
            <p style={{ margin: 0 }}>
              Read our <a href="/privacy" style={{ color: '#93c5fd' }}>Privacy Policy</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function buttonStyle(bg) {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    lineHeight: 1,
  }
}
