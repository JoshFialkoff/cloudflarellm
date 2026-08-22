'use client'

import { useState } from 'react'
import styles from './PartnerConsentModal.module.css'

/**
 * Explicit customer consent modal — MUST be acknowledged before any data collection.
 * Displays plain-language consent with checkbox. Timestamped.
 */
export default function PartnerConsentModal({ partner, onConsentGiven, onConsentDeclined }) {
  const [checked, setChecked] = useState(false)

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className={styles.modal}>
        <h2 id="consent-title" className={styles.title}>
          Before we begin
        </h2>

        <div className={styles.content}>
          <p className={styles.lead}>
            Assistedly is <strong>independent</strong> from {partner.name}.
          </p>

          <ul className={styles.bullets}>
            <li>
              {partner.shortName} does not choose or rank the care options you will see.
            </li>
            <li>
              We do not share your personal health information with {partner.shortName} unless you separately authorize it.
            </li>
            <li>
              Assistedly may earn a fee from participating communities only if you choose to move in.
            </li>
            <li>
              You can stop at any time. Your snapshot belongs to you.
            </li>
          </ul>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className={styles.checkbox}
            />
            <span className={styles.checkboxText}>
              I understand how this works and agree to proceed. I know I can stop at any time.
            </span>
          </label>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.primaryButton}
            disabled={!checked}
            onClick={onConsentGiven}
            style={{ '--partner-color': partner.brandColor }}
          >
            Continue to assessment
          </button>
          <button
            className={styles.secondaryButton}
            onClick={onConsentDeclined}
          >
            Not now, browse resources
          </button>
        </div>

        <p className={styles.footerNote}>
          This consent is timestamped and recorded for your protection.
          {' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Read our full privacy policy
          </a>.
        </p>
      </div>
    </div>
  )
}
