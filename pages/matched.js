// ⚠️ CRITICAL_FEATURE: Matched Results — NEVER REMOVE without !!APPROVED
// Shows ranked facilities after intake. Users must see results BEFORE hard login gate.
import { useState, useEffect, useMemo } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { MASSACHUSETTS_FACILITIES } from '../lib/massachusettsFacilities'
import { buildFacilityProfile } from '../lib/facilityProfiles'
import { readIntakeState, CARE_NEED_OPTIONS, BUDGET_RANGES, LOCATION_OPTIONS, TIMING_OPTIONS } from '../lib/intakeState'
import { rankFacilities } from '../lib/matchingScore'
import { IntakeMatchBadges } from '../components/IntakeMatchBadge'
import { trackMatchedResultClick, trackInquiryFromMatchedFlow } from '../lib/intakeAnalytics'
import { useFeatureFlagVariantKey } from 'posthog-js/react'
import { REGISTRATION_CTA_EXPERIMENT_FLAG } from '../lib/posthogClient'
import ShareResultsCTA from '../components/ShareResultsCTA'
import SaveResultsCTA from '../components/SaveResultsCTA'
import styles from '../styles/Matched.module.css'

const complianceBadgeClass = (rating) => {
  if (rating === 'Excellent') return styles.badgeExcellent
  if (rating === 'Good') return styles.badgeGood
  return styles.badgeNeedsImprovement
}

function labelFor(options, value) {
  const found = options.find((o) => o.value === value)
  return found ? found.label : value
}

function IntakeSummaryBar({ answers, onEdit }) {
  if (!answers) return null
  return (
    <div className={styles.intakeSummaryBar}>
      {answers.care_needs && (
        <span className={styles.intakeCriterion}>
          🏠 {labelFor(CARE_NEED_OPTIONS, answers.care_needs)}
        </span>
      )}
      {answers.budget && (
        <span className={styles.intakeCriterion}>
          💰 {labelFor(BUDGET_RANGES, answers.budget)}
        </span>
      )}
      {answers.location && (
        <span className={styles.intakeCriterion}>
          📍 {labelFor(LOCATION_OPTIONS, answers.location)}
        </span>
      )}
      {answers.timing && (
        <span className={styles.intakeCriterion}>
          ⏱ {labelFor(TIMING_OPTIONS, answers.timing)}
        </span>
      )}
      <Link href="/intake" className={styles.editIntakeLink}>
        Edit preferences
      </Link>
    </div>
  )
}

export default function MatchedPage({ allFacilities }) {
  const [intakeState, setIntakeState] = useState({ intake: null, hydrated: false })

  // Read intake from localStorage after mount using async pattern to satisfy react-hooks/set-state-in-effect
  useEffect(() => {
    let cancelled = false
    async function loadIntake() {
      const saved = readIntakeState()
      if (!cancelled) {
        setIntakeState({ intake: saved, hydrated: true })
      }
    }
    loadIntake()
    return () => { cancelled = true }
  }, [])

  const { intake, hydrated } = intakeState

  const rankedResults = useMemo(() => {
    return rankFacilities(allFacilities, intake)
  }, [allFacilities, intake])

  // Avoid hydration mismatch: render neutral list on first pass
  const displayResults = hydrated ? rankedResults : rankFacilities(allFacilities, null)
  const displayIntake = hydrated ? intake : null
  const ctaVariant = useFeatureFlagVariantKey(REGISTRATION_CTA_EXPERIMENT_FLAG) || 'control'

  return (
    <>
      <Head>
        <title>Your Matched Facilities – Assistedly.ai</title>
        <meta
          name="description"
          content="Personalized Massachusetts assisted living facility matches based on your care needs, budget, location, and priorities."
        />
      </Head>
      <div className={styles.matchedPage}>
        <header className={styles.matchedHeader}>
          <div className="container">
            <h1>Your Matched Facilities</h1>
            <p>
              {displayResults.length > 0
                ? `${displayResults.length} facilit${displayResults.length === 1 ? 'y' : 'ies'} ranked by how well they match your criteria.`
                : 'No results — try adjusting your preferences.'}
            </p>
          </div>
        </header>

        {displayIntake?.answers && <IntakeSummaryBar answers={displayIntake.answers} />}

        <div className={styles.matchedLayout}>
          {hydrated && !displayIntake && (
            <div className={styles.noIntakeBanner}>
              <p>Complete the short intake form to get personalized matches.</p>
              <Link href="/intake" className={styles.btnStartIntake}>
                Start Matching →
              </Link>
            </div>
          )}

          {displayResults.length === 0 && displayIntake && (
            <div className={styles.emptyState}>
              <h2>No exact matches found</h2>
              <p>Try widening your budget or choosing &ldquo;Anywhere in MA&rdquo; for location.</p>
              <Link href="/intake" className={styles.btnStartIntake} style={{ marginTop: '1rem', display: 'inline-block' }}>
                Adjust Preferences
              </Link>
            </div>
          )}

          {displayResults.length > 0 && (
            <p className={styles.resultsCount}>
              Showing {displayResults.length} matched facilit{displayResults.length === 1 ? 'y' : 'ies'}, ranked by fit
            </p>
          )}

          {displayResults.map(({ facility, score, tags, rank }) => (
            <div key={facility.id} className={styles.facilityCard}>
              <div className={styles.cardHeader}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div className={styles.rankBadge}>#{rank}</div>
                  <div>
                    <h2 className={styles.facilityName}>{facility.name}</h2>
                    <p className={styles.facilityAddress}>📍 {facility.address}</p>
                  </div>
                </div>
              </div>

              <IntakeMatchBadges tags={tags} score={score} />

              <div className={styles.careTypesRow}>
                {facility.careTypes.map((type) => (
                  <span key={type} className={styles.careTypeBadge}>{type}</span>
                ))}
                <span className={`${styles.complianceBadge} ${complianceBadgeClass(facility.complianceRating)}`}>
                  {facility.complianceRating === 'Excellent' ? '✓' : facility.complianceRating === 'Good' ? '~' : '!'}{' '}
                  {facility.complianceRating}
                </span>
              </div>

              <div className={styles.costRow}>
                <span>Monthly: </span>
                <span className={styles.costValue}>
                  {facility.monthlyMin != null && facility.monthlyMax != null
                    ? `$${facility.monthlyMin.toLocaleString()} – ${facility.monthlyMax.toLocaleString()}`
                    : 'Cost data unavailable'}
                </span>
              </div>

              <div className={styles.cardActions}>
                <Link
                  href={`/facility/${facility.slug}/`}
                  className={styles.btnView}
                  onClick={() => trackMatchedResultClick(facility.slug, rank, score)}
                >
                  View Details
                </Link>
                <Link
                  href={`/facility/${facility.slug}/?source=matched_flow`}
                  className={styles.btnInquire}
                  onClick={() => trackInquiryFromMatchedFlow(facility.slug, rank)}
                >
                  Get Info
                </Link>
              </div>
            </div>
          ))}

          {hydrated && displayResults.length > 0 && ctaVariant !== 'control' && (
            <div style={{ marginTop: '2rem', padding: '0 0.5rem' }}>
              {ctaVariant === 'share_family' && (
                <ShareResultsCTA facilities={displayResults.map((r) => r.facility)} />
              )}
              {ctaVariant === 'save_results' && (
                <SaveResultsCTA resultSnapshot={displayIntake} redirectTo="/matched" ctaVariant={ctaVariant} />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export async function getServerSideProps() {
  const allFacilities = MASSACHUSETTS_FACILITIES.map(buildFacilityProfile)

  return {
    props: {
      allFacilities,
    },
  }
}
