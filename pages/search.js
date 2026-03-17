import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '../components/Navbar'
import styles from '../styles/Search.module.css'

const mockFacilities = [
  {
    id: 1,
    name: 'Sunrise Senior Living of Boston',
    address: '123 Commonwealth Ave, Boston, MA 02115',
    city: 'Boston',
    careTypes: ['Assisted Living', 'Memory Care'],
    complianceRating: 'Excellent',
    monthlyMin: 4500,
    monthlyMax: 7500,
    amenities: ['24/7 Nursing Staff', 'Chef-Prepared Meals', 'Physical Therapy', 'Transportation Services'],
    saved: false,
  },
  {
    id: 2,
    name: 'Cambridge Care & Rehabilitation',
    address: '456 Massachusetts Ave, Cambridge, MA 02139',
    city: 'Cambridge',
    careTypes: ['Skilled Nursing', 'Assisted Living'],
    complianceRating: 'Good',
    monthlyMin: 5200,
    monthlyMax: 8500,
    amenities: ['Private Rooms', 'Garden & Walking Paths', 'Occupational Therapy', 'Cultural Programs'],
    saved: false,
  },
  {
    id: 3,
    name: 'Newton Highlands Senior Community',
    address: '789 Chestnut St, Newton, MA 02461',
    city: 'Newton',
    careTypes: ['Independent Living', 'Assisted Living'],
    complianceRating: 'Excellent',
    monthlyMin: 3800,
    monthlyMax: 6200,
    amenities: ['Fitness Center', 'Arts & Crafts Studio', 'Library', 'Scheduled Outings'],
    saved: false,
  },
  {
    id: 4,
    name: 'Worcester Memory Care Center',
    address: '321 Park Ave, Worcester, MA 01609',
    city: 'Worcester',
    careTypes: ['Memory Care', 'Skilled Nursing'],
    complianceRating: 'Good',
    monthlyMin: 4000,
    monthlyMax: 6800,
    amenities: ['Secure Memory Unit', 'Music Therapy', 'Pet-Friendly', 'Hospice Services'],
    saved: false,
  },
  {
    id: 5,
    name: 'Springfield Elder Care Village',
    address: '654 Main St, Springfield, MA 01103',
    city: 'Springfield',
    careTypes: ['Independent Living', 'Assisted Living', 'Memory Care'],
    complianceRating: 'Needs Improvement',
    monthlyMin: 2800,
    monthlyMax: 5500,
    amenities: ['Swimming Pool', 'Religious Services', 'Beauty Salon', 'Game Room'],
    saved: false,
  },
  {
    id: 6,
    name: 'Brookline Premier Assisted Living',
    address: '987 Beacon St, Brookline, MA 02446',
    city: 'Brookline',
    careTypes: ['Assisted Living', 'Memory Care'],
    complianceRating: 'Excellent',
    monthlyMin: 5500,
    monthlyMax: 9000,
    amenities: ['Concierge Services', 'Fine Dining', 'Yoga & Meditation', 'Technology Programs'],
    saved: false,
  },
]

const complianceBadgeClass = (rating, styles) => {
  if (rating === 'Excellent') return styles.badgeExcellent
  if (rating === 'Good') return styles.badgeGood
  return styles.badgeNeedsImprovement
}

export default function SearchPage() {
  const router = useRouter()
  const { q } = router.query
  const [searchQuery, setSearchQuery] = useState(q || '')
  const [budget, setBudget] = useState(8000)
  const [careLevels, setCareLevels] = useState([])
  const [complianceFilter, setComplianceFilter] = useState('All')
  const [savedFacilities, setSavedFacilities] = useState({})
  const [currentPage, setCurrentPage] = useState(1)

  const handleSearch = (e) => {
    e.preventDefault()
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
  }

  const toggleCareLevel = (level) => {
    setCareLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    )
  }

  const toggleSave = (id) => {
    setSavedFacilities(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredFacilities = mockFacilities.filter(f => {
    if (budget < 8000 && f.monthlyMin > budget) return false
    if (careLevels.length > 0 && !careLevels.some(l => f.careTypes.includes(l))) return false
    if (complianceFilter !== 'All' && f.complianceRating !== complianceFilter) return false
    return true
  })

  return (
    <>
      <Head>
        <title>Search Facilities - AI Assist Living Finder</title>
        <meta name="description" content="Search Massachusetts assisted living facilities" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Navbar />
      <div className={styles.searchPage}>
        {/* Search Header */}
        <div className={styles.searchHeader}>
          <div className="container">
            <form className={styles.searchBarForm} onSubmit={handleSearch}>
              <input
                type="text"
                className={styles.searchBarInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by city or zip code..."
              />
              <button type="submit" className={styles.searchBarBtn}>Search</button>
            </form>
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
                <span>$8,000+</span>
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
          </aside>

          {/* Results */}
          <main className={styles.resultsArea}>
            {filteredFacilities.map(facility => (
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
                    <li key={a} className={styles.amenityItem}>✓ {a}</li>
                  ))}
                </ul>

                <div className={styles.cardActions}>
                  <Link href={`/facility/${facility.id}`} className={styles.viewDetailsBtn}>
                    View Details
                  </Link>
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className={styles.pagination}>
              <button
                className={`${styles.pageBtn} ${currentPage === 1 ? styles.pageBtnActive : ''}`}
                onClick={() => setCurrentPage(1)}
              >1</button>
              <button
                className={`${styles.pageBtn} ${currentPage === 2 ? styles.pageBtnActive : ''}`}
                onClick={() => setCurrentPage(2)}
              >2</button>
              <button
                className={`${styles.pageBtn} ${currentPage === 3 ? styles.pageBtnActive : ''}`}
                onClick={() => setCurrentPage(3)}
              >3</button>
              <button className={styles.pageBtn} onClick={() => setCurrentPage(p => Math.min(p + 1, 3))}>Next →</button>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
