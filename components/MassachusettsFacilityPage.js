'use client'

import Link from 'next/link'
import { useFeatureFlagVariantKey } from 'posthog-js/react'
import { REGISTRATION_CTA_EXPERIMENT_FLAG } from '../lib/posthogClient'
import FacilityVerificationLine from './FacilityVerificationLine'
import FacilityViewGate from './FacilityViewGate'
import FacilityDeepDive from './FacilityDeepDive'
import ShareResultsCTA from './ShareResultsCTA'
import SaveResultsCTA from './SaveResultsCTA'
import styles from '../styles/Facility.module.css'
import growthStyles from '../styles/GrowthMvp.module.css'
import { facilityAiSummary, facilitySafetyScore, facilityTrustMetrics } from '../lib/facilityTrust'
import { buildFacilityProfile } from '../lib/facilityProfiles'
import { facilityHeroImage } from '../lib/facilityHeroImage'
import { absoluteSiteUrl, FACILITY_TABS, facilityTabHref, formatTownLabel } from '../lib/massachusettsRouteUtils'

function StarRating({ rating }) {
  const stars = []

  for (let i = 1; i <= 5; i += 1) {
    if (i <= Math.floor(rating)) {
      stars.push(
        <span key={i} className={styles.starFull}>
          ★
        </span>
      )
    } else if (i - 0.5 <= rating) {
      stars.push(
        <span key={i} className={styles.starHalf}>
          ★
        </span>
      )
    } else {
      stars.push(
        <span key={i} className={styles.starEmpty}>
          ★
        </span>
      )
    }
  }

  return (
    <div className={styles.starRating}>
      {stars} <span className={styles.ratingNumber}>{rating}/5</span>
    </div>
  )
}

export default function MassachusettsFacilityPage({
  facility,
  activeTab = 'overview',
  sourceAttestations = [],
  deepDiveReport = '',
  deepDiveGenerateHref = '',
  authVerified = false,
}) {
  const ctaVariant = useFeatureFlagVariantKey(REGISTRATION_CTA_EXPERIMENT_FLAG) || 'control'
  if (!facility) return null

  const facilityProfile = buildFacilityProfile(facility)

  const canonicalPath = `/massachusetts/${facility.town}/${facility.slug}`
  const canonicalUrl = absoluteSiteUrl(canonicalPath)
  const townLabel = formatTownLabel(facility.town)
  const complianceClass =
    facility.complianceRating === 'Excellent'
      ? styles.badgeExcellent
      : facility.complianceRating === 'Good'
        ? styles.badgeGood
        : styles.badgeNeedsImprovement
  const trustMetrics = facilityTrustMetrics(facility)
  const heroImage = facilityHeroImage(facility)

  const statusClass = (status) => {
    if (status === 'Pass' || status === 'Resolved') return styles.statusPass
    if (status === 'Corrected') return styles.statusCorrected
    return styles.statusInProgress
  }

  const breadcrumbStructuredData = null

  const facilityStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'SeniorLiving',
    name: facility.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: facilityProfile.profile.address,
      addressLocality: facilityProfile.profile.city,
      addressRegion: facilityProfile.profile.state,
      postalCode: facilityProfile.profile.zip,
    },
    telephone: facility.phone,
    email: facility.email,
    url: facilityProfile.website || canonicalUrl,
    areaServed: 'Massachusetts',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: facility.rating,
      bestRating: 5,
      worstRating: 1,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(facilityStructuredData) }}
      />

      <div className={styles.facilityPage}>
        <div className={styles.facilityHeader}>
          <div className="container">
            <div className={styles.headerContent}>
              <div className={styles.headerInfo}>
                <p className={styles.headerEyebrow}>{townLabel}, Massachusetts</p>
                <h1 className={styles.facilityName}>{facility.name}</h1>
                <p className={styles.facilityAddress}>
                  <span className={styles.addressIcon} aria-hidden="true">
                    📍
                  </span>
                  {facility.address}
                </p>
                <div className={styles.headerMetaRow}>
                  <StarRating rating={facility.rating} />
                  <span className={`${styles.complianceBadge} ${complianceClass}`}>
                    {facility.complianceRating === 'Excellent'
                      ? '✓'
                      : facility.complianceRating === 'Good'
                        ? '~'
                        : '!'}{' '}
                    {facility.complianceRating} Compliance
                  </span>
                </div>
                <div className={styles.headerChips}>
                  {facility.careTypes.map((type) => (
                    <span key={type} className={styles.headerChip}>
                      {type}
                    </span>
                  ))}
                  <span className={styles.headerChip}>
                    ${Number(facility.monthlyMin || 0).toLocaleString()}–${Number(facility.monthlyMax || 0).toLocaleString()}/mo
                  </span>
                </div>
                <FacilityVerificationLine
                  lastUpdated={facilityProfile.profile.lastUpdated}
                  sourceAttestations={sourceAttestations}
                  needsClarification={facility.complianceRating === 'Needs Improvement'}
                />
              </div>
              <div className={styles.headerMedia}>
                <div className={styles.headerImageFrame}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroImage.src}
                    alt={heroImage.alt}
                    className={styles.headerImage}
                    style={{ objectPosition: heroImage.objectPosition }}
                    width={640}
                    height={420}
                    loading="eager"
                    decoding="async"
                  />
                  <div className={styles.headerImageBadge}>
                    <span className={styles.headerImageBadgeMark} aria-hidden="true">
                      ♥
                    </span>
                    <span>Assistedly verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.tabNav}>
          <div className="container">
            <div className={styles.tabs}>
              {FACILITY_TABS.map((tab) => (
                <Link
                  key={tab.id}
                  href={facilityTabHref(canonicalPath, tab.id)}
                  scroll={false}
                  className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.tabContent}>
          <div className="container">
            <FacilityViewGate facilitySlug={facility.slug} redirectTo={canonicalPath}>
              {activeTab === 'overview' && (
                <div className={styles.overviewGrid}>
                  <div className={styles.overviewMain}>
                    <div className={styles.section}>
                      <h2 className={styles.sectionTitle}>Safety &amp; Trust Snapshot</h2>
                      <div className={growthStyles.aiSummary}>
                        <strong>AI summary</strong>
                        <p>{facilityAiSummary(facility)}</p>
                      </div>
                      <div className={growthStyles.trustGrid}>
                        {trustMetrics.map((metric) => (
                          <div key={metric.label} className={growthStyles.trustMetric}>
                            <span>{metric.label}</span>
                            <strong>{metric.value}</strong>
                            <p>{metric.why}</p>
                          </div>
                        ))}
                      </div>
                      <p className={styles.sectionDesc}>
                        Why this matters: families often compare communities by brochure photos and
                        price. Safety-focused metrics help you ask better questions about staffing,
                        occupancy, transfers, and inspection history before you tour.
                      </p>
                    </div>
                    <div className={styles.section}>
                      <h2 className={styles.sectionTitle}>About This Facility</h2>
                      <p className={styles.aboutText}>{facility.about}</p>
                    </div>
                    <div className={styles.section}>
                      <h2 className={styles.sectionTitle}>Structured profile</h2>
                      <div className={growthStyles.trustGrid}>
                        <div className={growthStyles.trustMetric}>
                          <span>Facility type</span>
                          <strong>{facilityProfile.profile.facilityType}</strong>
                          <p>{facilityProfile.profile.careIntensity}</p>
                        </div>
                        <div className={growthStyles.trustMetric}>
                          <span>Memory care</span>
                          <strong>{facilityProfile.profile.memoryCare}</strong>
                          <p>{facilityProfile.profile.pricingSummary}</p>
                        </div>
                        <div className={growthStyles.trustMetric}>
                          <span>Staffing summary</span>
                          <strong>{facilityProfile.profile.staffingSummary}</strong>
                          <p>{facilityProfile.profile.regulatorySummary}</p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.section}>
                      <h2 className={styles.sectionTitle}>Care Types Offered</h2>
                      <div className={styles.careTypesList}>
                        {facility.careTypes.map((type) => (
                          <span key={type} className={styles.careTypeBadge}>
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={styles.overviewSidebar}>
                    <div className={styles.infoCard}>
                      <h3 className={styles.infoCardTitle}>Quick Info</h3>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Capacity</span>
                        <span className={styles.infoValue}>{facility.capacity} residents</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Monthly Cost</span>
                        <span className={styles.infoValue}>
                          ${Number(facility.monthlyMin || 0).toLocaleString()} - $
                          {Number(facility.monthlyMax || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Compliance</span>
                        <span className={`${styles.complianceBadge} ${complianceClass}`}>
                          {facility.complianceRating}
                        </span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Website</span>
                        <span className={styles.infoValue}>
                          {facilityProfile.website ? (
                            <a href={facilityProfile.website} target="_blank" rel="noopener noreferrer">
                              Visit site
                            </a>
                          ) : (
                            'Request website'
                          )}
                        </span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Rating</span>
                        <span className={styles.infoValue}>{facility.rating}/5.0</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Safety score</span>
                        <span className={styles.infoValue}>
                          {facilitySafetyScore(facility)}/100
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.section} style={{ marginTop: '1.5rem' }}>
                    {ctaVariant === 'share_family' && (
                      <ShareResultsCTA facilities={[facility]} />
                    )}
                    {ctaVariant === 'save_results' && (
                      <SaveResultsCTA
                        resultSnapshot={{ facility: facility.slug, name: facility.name }}
                        redirectTo={canonicalPath}
                        ctaVariant={ctaVariant}
                      />
                    )}
                    {ctaVariant === 'control' && (
                      <div className={growthStyles.aiSummary}>
                        <strong>Want to share or save this facility?</strong>
                        <p>Save this page to compare with other facilities or share with family.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'compliance' && (
                <div className={styles.complianceSection}>
                  <h2 className={styles.sectionTitle}>Compliance History</h2>
                  <p className={styles.sectionDesc}>
                    Inspection records sourced from Massachusetts Department of Public Health
                  </p>
                  <div className={styles.tableWrapper}>
                    <table className={styles.complianceTable}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Inspection Type</th>
                          <th>Findings</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facility.complianceHistory.map((row, index) => (
                          <tr key={index}>
                            <td>{row.date}</td>
                            <td>{row.type}</td>
                            <td>{row.findings}</td>
                            <td>
                              <span className={`${styles.statusBadge} ${statusClass(row.status)}`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'amenities' && (
                <div className={styles.amenitiesSection}>
                  <h2 className={styles.sectionTitle}>Amenities &amp; Services</h2>
                  <div className={styles.amenitiesGrid}>
                    {facility.amenities.map((amenity, index) => (
                      <div key={index} className={styles.amenityCard}>
                        <div className={styles.amenityIcon}>{amenity.icon}</div>
                        <div className={styles.amenityName}>{amenity.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'full-report' && (
                <FacilityDeepDive
                  key={`deep-dive-${deepDiveReport ? 'generated' : 'idle'}-${authVerified ? 'authed' : 'guest'}`}
                  facility={facility}
                  redirectTo={canonicalPath}
                  initialReport={deepDiveReport}
                  generateHref={deepDiveGenerateHref}
                  authVerified={authVerified}
                />
              )}
            </FacilityViewGate>
          </div>
        </div>
      </div>
    </>
  )
}
