/**
 * Privacy-first analytics helpers for Assistedly.ai
 * Wraps existing PostHog / GA4 / GTM instrumentation with a consent gate.
 *
 * Usage:
 *   import { trackEvent } from '@/lib/seo/privacyAnalytics'
 *   trackEvent('hero_cta_click', { location: 'homepage_top' })
 */

const CONSENT_KEY = 'assistedly_consent'

/**
 * Consent levels:
 *   'granted'   – full analytics (GA4 + PostHog)
 *   'minimal'   – PostHog only, no GA4 / no PII
 *   'denied'    – no cookies / no tracking (except essential server logs)
 */
export function getConsent() {
  if (typeof window === 'undefined') return 'denied'
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY)
    if (raw === 'granted' || raw === 'minimal' || raw === 'denied') return raw
    return null
  } catch {
    return 'denied'
  }
}

export function setConsent(level) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_KEY, level)
    window.dispatchEvent(new CustomEvent('assistedly:consentchange', { detail: level }))
  } catch {
    // storage unavailable
  }
}

/**
 * trackEvent
 * Pushes events to GTM dataLayer and/or PostHog based on consent.
 */
export function trackEvent(eventName, properties = {}) {
  const consent = getConsent()
  if (consent === 'denied') return

  const payload = {
    event: eventName,
    ...properties,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
  }

  // GTM dataLayer (GA4) – only if granted
  if (consent === 'granted' && typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push(payload)
  }

  // PostHog – minimal + granted (avoid PII in minimal)
  if (typeof window !== 'undefined' && window.posthog) {
    const safeProps = consent === 'minimal'
      ? sanitizeForMinimal(properties)
      : properties
    window.posthog.capture(eventName, safeProps)
  }
}

function sanitizeForMinimal(props) {
  const clone = { ...props }
  // strip potential PII
  const piiKeys = ['email', 'phone', 'name', 'firstName', 'lastName', 'address']
  piiKeys.forEach((k) => delete clone[k])
  return clone
}

/**
 * Specific event wrappers used across the site.
 */
export function trackHeroCtaClick(props = {}) {
  trackEvent('hero_cta_click', { category: 'conversion', ...props })
}

export function trackCostCalculatorComplete(props = {}) {
  trackEvent('cost_calculator_complete', { category: 'engagement', ...props })
}

export function trackSessionStart(props = {}) {
  trackEvent('session_start', { category: 'session', ...props })
}

export function trackEmailSubmission(props = {}) {
  trackEvent('email_submission', { category: 'lead', ...props })
}

export function trackPhoneSubmission(props = {}) {
  trackEvent('phone_submission', { category: 'lead', ...props })
}

export function trackBusinessModelPageView(props = {}) {
  trackEvent('business_model_page_view', { category: 'page', ...props })
}
