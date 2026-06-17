import Link from 'next/link'
import styles from '../styles/Facility.module.css'

export default function FacilityVerificationLine({
  lastUpdated,
  sourceAttestations = [],
  needsClarification = false,
}) {
  if (needsClarification) {
    return (
      <p className={styles.sectionDesc}>
        Needs updated operator clarification. Last updated: {lastUpdated || 'Recently updated'}.
      </p>
    )
  }

  return (
    <p className={styles.sectionDesc}>
      Reviewed against Massachusetts public data and on-site profile inputs
      {sourceAttestations.length > 0 ? (
        <>
          {' '}
          (
          {sourceAttestations.map((source, index) => (
            <span key={source.id}>
              {index > 0 ? '; ' : ''}
              <Link
                href={source.tokenPath}
                className={styles.sourceAttestationLink}
                rel="nofollow noopener"
              >
                {source.label}
              </Link>
            </span>
          ))}
          )
        </>
      ) : null}
      . Last updated: {lastUpdated || 'Recently updated'}.
    </p>
  )
}
