import { useState, useMemo, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import ConsumerLeadCapture from '../components/ConsumerLeadCapture'
import SearchLimitGate from '../components/SearchLimitGate'
import ShortlistButton from '../components/ShortlistButton'
import { useShortlist } from '../hooks/useShortlist'
import { useFacilities } from '../hooks/useFacilities'
import styles from '../styles/Search.module.css'

const complianceBadgeClass = (rating, styles) => {
  if (rating === 'Excellent') return styles.badgeExcellent
  if (rating === 'Good') return styles.badgeGood
  return styles.badgeNeedsImprovement
}

function FacilityCard({ facility }) {
  return (
    <div className={styles.facilityCard}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.facilityName}>{facility.name}</h3>
          <p className={styles.facilityAddress}>📍 {facility.address}</p>
        </div>
        <ShortlistButton
          slug={facility.slug}
          facilityId={facility.id}
          source="search"
          variant="compact"
        />
      </div>

      <div className={styles.careTypesRow}>
        {facility.careTypes.map(type => (
          <span key={type} className={styles.careTypeBadge}>{type}</span>
        ))}
        <span className={`${styles.complianceBadge} ${complianceBadgeClass(facility.complianceRating, styles)}`}>    
          {facility.complianceRating === 'Excellent' ? '✓' : facility.complianceRating === 'Good' ? '~' : '!'} {facility.complianceRating}
        </span>
      </div>

      {facility.crimeRating && (
        <div className={styles.crimeRatingRow}>
          <span className={styles.crimeRatingLabel}>Crime (Facility/Community):</span>
          <span className={styles.crimeRatingValue}>{facility.crimeRating.facility} / {facility.crimeRating.community}</span>
        </div>
      )}

      {facility.culturalAffinity && facility.culturalAffinity.length > 0 && (
        <div className={styles.culturalAffinityRow}>
          <span className={styles.culturalAffinityLabel}>Cultural Affinities:</span>
          <span className={styles.culturalAffinityValue}>{facility.culturalAffinity.join(', ')}</span>
        </div>
      )}

      <div className={styles.costRow}>
        <span className={styles.costLabel}>Monthly Cost:</span>
        <span className={styles.costValue}>{facility.monthlyMin != null && facility.monthlyMax != null ? `$${facility.monthlyMin.toLocaleString()} – ${facility.monthlyMax.toLocaleString()}` : 'Cost data unavailable'}</span>
      </div>

      <ul className={styles.amenitiesList}>
        {facility.amenities.map(a => (
          <li key={a.name} className={styles.amenityItem}>✓ {a.name}</li>
        ))}
      </ul>

      <div className={styles.cardActions}>
        <Link href={`/facility/${facility.slug}/`} className={styles.viewDetailsBtn}>
          View Details
        </Link>
        <Link href={`/compare?facilities=${facility.slug}`} className={styles.viewDetailsBtn}>
          Compare
        </Link>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <section className={styles.resultsArea} aria-label="Loading search results">
      {[1, 2, 3].map(i => (
        <div key={i} className={styles.facilityCard} style={{ opacity: 0.4 }}>
          <div className={styles.cardHeader}>
            <div>
              <div style={{ height: 24, width: '60%', background: '#e0e0e0', borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 18, width: '40%', background: '#e0e0e0', borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ height: 20, width: '80%', background: '#e0e0e0', borderRadius: 4, marginTop: 12 }} />
          <div style={{ height: 20, width: '50%', background: '#e0e0e0', borderRadius: 4, marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {[1, 2, 3].map(j => (
              <div key={j} style={{ height: 16, width: 80, background: '#e0e0e0', borderRadius: 8 }} />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

export default function SearchPage() {
  const [budget, setBudget] = useState(8000)
  const [careLevels, setCareLevels] = useState([])
  const [complianceFilter, setComplianceFilter] = useState('All')
  const [culturalAffinities, setCulturalAffinities] = useState([])
  const [crimeFilter, setCrimeFilter] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchCount, setSearchCount] = useState(0)

  useEffect(() => {
    const count = parseInt(localStorage.getItem('assistedly_search_count') || '0', 10)
    setSearchCount(count)
    localStorage.setItem('assistedly_search_count', String(count + 1))
  }, [])
  const { shortlist } = useShortlist()
  const { facilities, loading, error } = useFacilities()

  const toggleCareLevel = (level) => {
    setCareLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    )
  }

  const toggleCulturalAffinity = (affinity) => {
    setCulturalAffinities(prev =>
      prev.includes(affinity) ? prev.filter(a => a !== affinity) : [...prev, affinity]
    )
  }

  const filteredFacilities = useMemo(() => {
    if (!Array.isArray(facilities)) return []
    return facilities.filter(f => {
      if (budget < 10000 && f.monthlyMin > budget) return false
      if (careLevels.length > 0 && !careLevels.some(l => f.careTypes.includes(l))) return false
      if (complianceFilter !== 'All' && f.complianceRating !== complianceFilter) return false
      if (culturalAffinities.length > 0 && !culturalAffinities.some(a => f.culturalAffinity?.includes(a))) return false
      if (crimeFilter !== 'All') {
        const facilityCrime = f.crimeRating?.facility || 'Unknown'
        if (crimeFilter === 'Low' && facilityCrime !== 'Low' && facilityCrime !== 'Very Low') return false
        if (crimeFilter === 'Very Low' && facilityCrime !== 'Very Low') return false
      }
      return true
    })
  }, [facilities, budget, careLevels, complianceFilter, culturalAffinities, crimeFilter])

  const ITEMS_PER_PAGE = 3
  const totalPages = Math.max(1, Math.ceil(filteredFacilities.length / ITEMS_PER_PAGE))
  const pagedFacilities = filteredFacilities.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const handleUpdate = () => {
    setCurrentPage(1)
    const newCount = searchCount + 1
    setSearchCount(newCount)
    localStorage.setItem('assistedly_search_count', String(newCount))
  }

  return (
    <>
      <Head>
        <title>Search Facilities - AI Assist Living Finder</title>
        <meta name="description" content="Search Massachusetts assisted living facilities" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Preload facilities data so API fetch is instant when mount fires */}
        <link rel="preload" as="fetch" href="/api/facilities" crossOrigin="anonymous" />
      </Head>
      <div className={styles.searchPage}>
        <div className={styles.searchSummaryBar}>
          <div className="container">
            {loading ? (
              <p className={styles.resultsCount}>Loading Massachusetts facilities...</p>
            ) : error ? (
              <p className={styles.resultsCount}>Unable to load facilities. Please try again.</p>
            ) : (
              <p className={styles.resultsCount}>{filteredFacilities.length} facilities found in Massachusetts</p>
            )}
          </div>
        </div>

        <div className={styles.searchLayout}>
          {/* Filters Sidebar */}
          <aside className={styles.filtersSidebar}>
            <h3 className={styles.filtersTitle}>Filter Results</h3>

            <div className={styles.filterGroup}>
              <label className={styles.filterGroupTitle}>Budget Range (per month)</label>
              <input
                type="range"
                min="2000"
                max="10000"
                step="500"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className={styles.rangeInput}
              />
              <div className={styles.budgetDisplay}>
                Up to ${budget >= 10000 ? '10,000+' : budget.toLocaleString()}
              </div>
              <div className={styles.budgetLabels}>
                <span>$2,000</span>
                <span>$10,000+</span>
              </div>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterGroupTitle}>Care Level</label>
              {['Independent Living', 'Assisted Living', 'Memory Care', 'Skilled Nursing'].map(level => (
                <label key={level} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={careLevels.includes(level)}
                    onChange={() => toggleCareLevel(level)}
                  />
                  <span>{level}</span>
                </label>
              ))}
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterGroupTitle}>Compliance Rating</label>
              {['All', 'Excellent', 'Good', 'Needs Improvement'].map(rating => (
                <label key={rating} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="compliance"
                    value={rating}
                    checked={complianceFilter === rating}
                    onChange={() => setComplianceFilter(rating)}
                  />
                  <span>{rating}</span>
                </label>
              ))}
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterGroupTitle}>Cultural / Religious Affinity</label>
              {['Jewish-friendly', 'Greek-speaking staff', 'Spanish-speaking staff', 'Russian-speaking staff'].map(affinity => (
                <label key={affinity} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={culturalAffinities.includes(affinity)}
                    onChange={() => toggleCulturalAffinity(affinity)}
                  />
                  <span>{affinity}</span>
                </label>
              ))}
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterGroupTitle}>Crime Rating (Facility Area)</label>
              {['All', 'Very Low', 'Low', 'Moderate', 'High'].map(rating => (
                <label key={rating} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="crime"
                    value={rating}
                    checked={crimeFilter === rating}
                    onChange={() => setCrimeFilter(rating)}
                  />
                  <span>{rating}</span>
                </label>
              ))}
            </div>

            <button type="button" className={styles.updateBtn} onClick={handleUpdate}>
              Update
            </button>
            <div style={{ marginTop: '1rem' }}>
              {searchCount >= 3 ? (
                <SearchLimitGate authSurface="search_limit_gate" />
              ) : (
                <ConsumerLeadCapture
                  page="/search"
                  leadMagnet="massachusetts-guide"
                  title="Get the Massachusetts planning guide"
                  description="Email yourself the search workbook, town guide, and comparison questions."
                />
              )}
            </div>
          </aside>

          {/* Results */}
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <section className={styles.resultsArea} aria-label="Error">
              <div className={styles.facilityCard}>
                <p style={{ color: '#cc0000', padding: '1rem' }}>
                  ⚠️ Could not load facility data. Please try refreshing.
                </p>
              </div>
            </section>
          ) : (
            <section className={styles.resultsArea} aria-label="Search results">
              {pagedFacilities.map(facility => (
                <FacilityCard key={facility.id} facility={facility} />
              ))}

              {/* Pagination */}
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                >← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`${styles.pageBtn} ${currentPage === page ? styles.pageBtnActive : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >{page}</button>
                ))}
                <button
                  className={styles.pageBtn}
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >Next →</button>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
