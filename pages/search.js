import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import ConsumerLeadCapture from '../components/ConsumerLeadCapture'
import { MASSACHUSETTS_FACILITIES } from '../lib/massachusettsFacilities'
import { buildFacilityProfile } from '../lib/facilityProfiles'
import styles from '../styles/Search.module.css'

const complianceBadgeClass = (rating, styles) => {
  if (rating === 'Excellent') return styles.badgeExcellent
  if (rating === 'Good') return styles.badgeGood
  return styles.badgeNeedsImprovement
}

export default function SearchPage() {
  const [budget, setBudget] = useState(8000)
  const [careLevels, setCareLevels] = useState([])
  const [complianceFilter, setComplianceFilter] = useState('All')
  const [savedFacilities, setSavedFacilities] = useState({})
  const [currentPage, setCurrentPage] = useState(1)

  const toggleCareLevel = (level) => {
    setCareLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    )
  }

  const toggleSave = (id) => {
    setSavedFacilities(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredFacilities = MASSACHUSETTS_FACILITIES.map(buildFacilityProfile).filter(f => {
    if (budget < 10000 && f.monthlyMin > budget) return false
    if (careLevels.length > 0 && !careLevels.some(l => f.careTypes.includes(l))) return false
    if (complianceFilter !== 'All' && f.complianceRating !== complianceFilter) return false
    return true
  })

  const ITEMS_PER_PAGE = 3
  const totalPages = Math.max(1, Math.ceil(filteredFacilities.length / ITEMS_PER_PAGE))
  const pagedFacilities = filteredFacilities.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const handleUpdate = () => {
    setCurrentPage(1)
  }

  return (
    <>
      <Head>
        <title>Search Facilities - AI Assist Living Finder</title>
        <meta name="description" content="Search Massachusetts assisted living facilities" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.searchPage}>
        <div className={styles.searchSummaryBar}>
          <div className="container">
            <p className={styles.resultsCount}>{filteredFacilities.length} facilities found in Massachusetts</p>
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

            <button type="button" className={styles.updateBtn} onClick={handleUpdate}>
              Update
            </button>
            <div style={{ marginTop: '1rem' }}>
              <ConsumerLeadCapture
                page="/search"
                leadMagnet="massachusetts-guide"
                title="Get the Massachusetts planning guide"
                description="Email yourself the search workbook, town guide, and comparison questions."
              />
            </div>
          </aside>

          {/* Results (document <main> is in _app.js) */}
          <section className={styles.resultsArea} aria-label="Search results">
            {pagedFacilities.map(facility => (
              <div key={facility.id} className={styles.facilityCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.facilityName}>{facility.name}</h3>
                    <p className={styles.facilityAddress}>📍 {facility.address}</p>
                  </div>
                  <button
                    className={`${styles.saveBtn} ${savedFacilities[facility.id] ? styles.saveBtnActive : ''}`}
                    onClick={() => toggleSave(facility.id)}
                    aria-label="Save facility"
                  >
                    {savedFacilities[facility.id] ? '❤️' : '🤍'}
                  </button>
                </div>

                <div className={styles.careTypesRow}>
                  {facility.careTypes.map(type => (
                    <span key={type} className={styles.careTypeBadge}>{type}</span>
                  ))}
                  <span className={`${styles.complianceBadge} ${complianceBadgeClass(facility.complianceRating, styles)}`}>    
                    {facility.complianceRating === 'Excellent' ? '✓' : facility.complianceRating === 'Good' ? '~' : '!'} {facility.complianceRating}
                  </span>
                </div>

                <div className={styles.costRow}>
                  <span className={styles.costLabel}>Monthly Cost:</span>
                  <span className={styles.costValue}>${facility.monthlyMin.toLocaleString()} – ${facility.monthlyMax.toLocaleString()}</span>
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
        </div>
      </div>
    </>
  )
}