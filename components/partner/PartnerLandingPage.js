'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from './PartnerLandingPage.module.css'
import PartnerConsentModal from './PartnerConsentModal'
import { pushGevent } from '../../lib/gtag'

/**
 * Co-branded partner landing page.
 * Requirements: dual branding, consent modal, no hard gate, family-controlled.
 */
export default function PartnerLandingPage({ partner }) {
  const router = useRouter()
  const [consentGiven, setConsentGiven] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [hasAttribution, setHasAttribution] = useState(false)

  // Parse attribution from URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const search = new URLSearchParams(window.location.search)
    const ref = search.get('ref')
    const utmSource = search.get('utm_source')
    const utmCampaign = search.get('utm_campaign')

    // Validate attribution matches partner
    if (ref === partner.attributionParam || utmSource === partner.slug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasAttribution(true)
      // Log partner landing click
      if (window.posthog) {
        window.posthog.capture('partner_landing_click', {
          partner_slug: partner.slug,
          partner_name: partner.name,
          ref,
          utm_source: utmSource,
          utm_campaign: utmCampaign,
          channel: search.get('channel') || 'unknown',
        })
      }
      pushGevent('partner_landing_click', {
        partner_slug: partner.slug,
        partner_name: partner.name,
      })
    }
  }, [partner])

  const handleStartAssessment = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleConsentGiven = useCallback(() => {
    setConsentGiven(true)
    setShowModal(false)

    // Log consent
    if (window.posthog) {
      window.posthog.capture('partner_consent_given', {
        partner_slug: partner.slug,
        partner_name: partner.name,
        timestamp: new Date().toISOString(),
      })
    }
    pushGevent('partner_consent_given', {
      partner_slug: partner.slug,
    })

    // Navigate to assessment
    router.push(`/partner/${partner.slug}/assessment`)
  }, [partner, router])

  const handleConsentDeclined = useCallback(() => {
    setShowModal(false)
    // Still allow browsing edu content, just no assessment
    if (window.posthog) {
      window.posthog.capture('partner_consent_denied', {
        partner_slug: partner.slug,
        partner_name: partner.name,
      })
    }
  }, [partner])

  return (
    <div className={styles.page}>
      {/* Hero Section */}
      <section
        className={styles.hero}
        style={{ '--partner-accent': partner.brandColor }}
      >
        <div className={styles.heroInner}>
          {/* Dual branding */}
          <div className={styles.brandBar}>
            <div className={styles.partnerLogo} style={{ color: partner.brandColor }}>
              {partner.shortName}
            </div>
            <span className={styles.brandSeparator}>×</span>
            <div className={styles.assistedlyLogo}>Assistedly.ai</div>
          </div>

          <h1 className={styles.heroTitle}>
            When staying at home is getting harder, understanding your options shouldn&apos;t be.
          </h1>

          <p className={styles.heroSubtitle}>
            {partner.name} helps families support independent living. When care needs change,
            Assistedly gives you an <strong>independent way</strong> to understand what comes next —
            with transparent, state-verified data.
          </p>

          <div className={styles.trustBadge}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>
              Assistedly does not rank or select facilities on behalf of {partner.shortName}.
              Our recommendations are independent.
            </span>
          </div>

          <button
            className={styles.ctaButton}
            onClick={handleStartAssessment}
            style={{ backgroundColor: partner.brandColor }}
          >
            Start your free care snapshot
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>

          {!hasAttribution && (
            <p className={styles.attributionNotice}>
              <em>
                This page may not have been reached through a verified partner link.
                You can still explore, but attribution cannot be confirmed.
              </em>
            </p>
          )}
        </div>
      </section>

      {/* What to Expect */}
      <section className={styles.expectSection}>
        <h2 className={styles.sectionTitle}>What to expect</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <h3>A short, independent assessment</h3>
            <p>5–8 questions about current living situation, care needs, and location. No medical diagnosis.</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <h3>Your personalized care snapshot</h3>
            <p>A source-linked summary with context, not a sales pitch. See where the information comes from.</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <h3>You decide what&apos;s next</h3>
            <p>Browse care options on your own, save your snapshot, or ask Assistedly to help connect you. Your choice.</p>
          </div>
        </div>
      </section>

      {/* Independence Promise */}
      <section className={styles.promiseSection}>
        <div className={styles.promiseInner}>
          <h2>Our independence promise</h2>
          <ul className={styles.promiseList}>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {partner.shortName} does not choose or rank the care options you see
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Assistedly does not sell your personal information to facilities
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Any fee Assistedly earns comes from participating communities only if you choose to move in
            </li>
            <li>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              You control whether to share any information with {partner.shortName}
            </li>
          </ul>
        </div>
      </section>

      {/* Disclosure Footer */}
      <footer className={styles.disclosureFooter}>
        <div className={styles.disclosureInner}>
          <p dangerouslySetInnerHTML={{ __html: partner.disclosureHtml }} />
          <p className={styles.legalLinks}>
            <a href={partner.termsUrl} target="_blank" rel="noopener noreferrer">Partner Terms</a>
            {' · '}
            <a href={partner.privacyUrl} target="_blank" rel="noopener noreferrer">Partner Privacy</a>
            {' · '}
            <a href="https://assistedly.ai/how-we-make-money">How Assistedly Makes Money</a>
          </p>
        </div>
      </footer>

      {/* Consent Modal */}
      {showModal && (
        <PartnerConsentModal
          partner={partner}
          onConsentGiven={handleConsentGiven}
          onConsentDeclined={handleConsentDeclined}
        />
      )}
    </div>
  )
}
