import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '../../components/Navbar'
import styles from '../../styles/Facility.module.css'

const facilitiesData = {
  1: {
    id: 1,
    name: 'Sunrise Senior Living of Boston',
    address: '123 Commonwealth Ave, Boston, MA 02115',
    phone: '(617) 555-0101',
    email: 'info@sunriseboston.example.com',
    rating: 4.7,
    complianceRating: 'Excellent',
    careTypes: ['Assisted Living', 'Memory Care'],
    capacity: 120,
    monthlyMin: 4500,
    monthlyMax: 7500,
    about: 'Sunrise Senior Living of Boston has been providing exceptional care for seniors since 1998. Located in the heart of Boston, our community offers a warm, supportive environment with professional 24/7 care staff. We specialize in assisted living and memory care with a person-centered approach.',
    complianceHistory: [
      { date: 'Jan 2024', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
      { date: 'Jun 2023', type: 'Complaint Investigation', findings: 'Unsubstantiated', status: 'Resolved' },
      { date: 'Jan 2023', type: 'Annual Inspection', findings: 'Minor documentation issue', status: 'Corrected' },
      { date: 'Jan 2022', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
      { date: 'Jan 2021', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
    ],
    amenities: [
      { icon: '🍽️', name: 'Restaurant-Style Dining' },
      { icon: '🏋️', name: 'Fitness Center' },
      { icon: '🚌', name: 'Transportation Services' },
      { icon: '💊', name: 'Medication Management' },
      { icon: '🧘', name: 'Yoga & Wellness' },
      { icon: '📚', name: 'Library & Reading Room' },
      { icon: '🎨', name: 'Arts & Crafts Studio' },
      { icon: '🌳', name: 'Garden & Walking Paths' },
      { icon: '💈', name: 'Beauty Salon & Barber' },
      { icon: '🎵', name: 'Music & Entertainment' },
      { icon: '🐾', name: 'Pet-Friendly Community' },
      { icon: '🙏', name: 'Chaplaincy Services' },
    ],
  },
  2: {
    id: 2,
    name: 'Cambridge Care & Rehabilitation',
    address: '456 Massachusetts Ave, Cambridge, MA 02139',
    phone: '(617) 555-0202',
    email: 'admissions@cambridgecare.example.com',
    rating: 4.3,
    complianceRating: 'Good',
    careTypes: ['Skilled Nursing', 'Assisted Living'],
    capacity: 85,
    monthlyMin: 5200,
    monthlyMax: 8500,
    about: 'Cambridge Care & Rehabilitation offers specialized skilled nursing and assisted living services in the vibrant Cambridge community. Our interdisciplinary care team focuses on rehabilitation and long-term care excellence, with close proximity to world-class medical centers.',
    complianceHistory: [
      { date: 'Mar 2024', type: 'Annual Inspection', findings: 'Two minor deficiencies', status: 'Corrected' },
      { date: 'Sep 2023', type: 'Follow-up Inspection', findings: 'Previous findings corrected', status: 'Pass' },
      { date: 'Mar 2023', type: 'Annual Inspection', findings: 'Three deficiencies noted', status: 'Corrected' },
      { date: 'Mar 2022', type: 'Annual Inspection', findings: 'One minor deficiency', status: 'Corrected' },
      { date: 'Mar 2021', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
    ],
    amenities: [
      { icon: '🍽️', name: 'Chef-Prepared Meals' },
      { icon: '🏥', name: 'On-Site Medical Care' },
      { icon: '🚌', name: 'Medical Transportation' },
      { icon: '💊', name: 'Pharmacy Services' },
      { icon: '🧪', name: 'Lab Services On-Site' },
      { icon: '📚', name: 'Patient Library' },
      { icon: '🌳', name: 'Outdoor Courtyard' },
      { icon: '🎵', name: 'Music Therapy' },
      { icon: '💈', name: 'Beauty Services' },
      { icon: '📺', name: 'Private TV in Rooms' },
      { icon: '🙏', name: 'Interfaith Chapel' },
      { icon: '👨‍👩‍👧', name: 'Family Lounge Areas' },
    ],
  },
  3: {
    id: 3,
    name: 'Newton Highlands Senior Community',
    address: '789 Chestnut St, Newton, MA 02461',
    phone: '(617) 555-0303',
    email: 'info@newtonhighlands.example.com',
    rating: 4.9,
    complianceRating: 'Excellent',
    careTypes: ['Independent Living', 'Assisted Living'],
    capacity: 150,
    monthlyMin: 3800,
    monthlyMax: 6200,
    about: "Newton Highlands Senior Community is one of Massachusetts' most highly-rated senior living communities. Our expansive campus offers a full continuum of care from independent to assisted living, with resort-style amenities and a vibrant social calendar.",
    complianceHistory: [
      { date: 'Feb 2024', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
      { date: 'Feb 2023', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
      { date: 'Feb 2022', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
      { date: 'Feb 2021', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
      { date: 'Feb 2020', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
    ],
    amenities: [
      { icon: '🍽️', name: 'Multiple Dining Venues' },
      { icon: '🏋️', name: 'Full Fitness Center' },
      { icon: '🏊', name: 'Heated Indoor Pool' },
      { icon: '🎨', name: 'Art Studio' },
      { icon: '🎭', name: 'Theater & Performance Space' },
      { icon: '🌳', name: 'Scenic Walking Trails' },
      { icon: '🚌', name: 'Scheduled Transportation' },
      { icon: '📚', name: 'Extensive Library' },
      { icon: '💈', name: 'Full-Service Salon' },
      { icon: '🏌️', name: 'Golf Putting Green' },
      { icon: '🐾', name: 'Pet-Friendly' },
      { icon: '💻', name: 'Technology Center' },
    ],
  },
  4: {
    id: 4,
    name: 'Worcester Memory Care Center',
    address: '321 Park Ave, Worcester, MA 01609',
    phone: '(508) 555-0404',
    email: 'info@worcestermemorycare.example.com',
    rating: 4.2,
    complianceRating: 'Good',
    careTypes: ['Memory Care', 'Skilled Nursing'],
    capacity: 65,
    monthlyMin: 4000,
    monthlyMax: 6800,
    about: "Worcester Memory Care Center specializes in providing compassionate, evidence-based care for individuals with Alzheimer's disease and other forms of dementia. Our specially trained staff and secure environment ensure the safety and dignity of every resident.",
    complianceHistory: [
      { date: 'Apr 2024', type: 'Annual Inspection', findings: 'One deficiency noted', status: 'Corrected' },
      { date: 'Oct 2023', type: 'Follow-up', findings: 'Previous deficiency corrected', status: 'Pass' },
      { date: 'Apr 2023', type: 'Annual Inspection', findings: 'Two deficiencies noted', status: 'Corrected' },
      { date: 'Apr 2022', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
      { date: 'Apr 2021', type: 'Annual Inspection', findings: 'One minor deficiency', status: 'Corrected' },
    ],
    amenities: [
      { icon: '🔒', name: 'Secure Memory Unit' },
      { icon: '🎵', name: 'Music Therapy Program' },
      { icon: '🍽️', name: 'Specialized Nutrition' },
      { icon: '🌳', name: 'Secured Outdoor Garden' },
      { icon: '🐾', name: 'Pet Therapy Visits' },
      { icon: '🎨', name: 'Sensory Activities' },
      { icon: '💊', name: 'Medication Management' },
      { icon: '👨‍⚕️', name: 'Dementia Specialist Staff' },
      { icon: '🙏', name: 'Spiritual Care' },
      { icon: '👨‍👩‍👧', name: 'Family Support Group' },
      { icon: '📺', name: 'Reminiscence Therapy' },
      { icon: '🏥', name: 'Hospice Coordination' },
    ],
  },
  5: {
    id: 5,
    name: 'Springfield Elder Care Village',
    address: '654 Main St, Springfield, MA 01103',
    phone: '(413) 555-0505',
    email: 'contact@springfieldeldercare.example.com',
    rating: 3.6,
    complianceRating: 'Needs Improvement',
    careTypes: ['Independent Living', 'Assisted Living', 'Memory Care'],
    capacity: 200,
    monthlyMin: 2800,
    monthlyMax: 5500,
    about: 'Springfield Elder Care Village is a large continuing care community serving western Massachusetts. While we are working to improve our compliance record, we offer a full range of care options at competitive pricing, with a strong commitment to improvement.',
    complianceHistory: [
      { date: 'May 2024', type: 'Annual Inspection', findings: 'Five deficiencies noted', status: 'In Progress' },
      { date: 'Nov 2023', type: 'Follow-up Inspection', findings: 'Partial compliance', status: 'In Progress' },
      { date: 'May 2023', type: 'Annual Inspection', findings: 'Seven deficiencies noted', status: 'Corrected' },
      { date: 'May 2022', type: 'Annual Inspection', findings: 'Three deficiencies noted', status: 'Corrected' },
      { date: 'May 2021', type: 'Annual Inspection', findings: 'Two deficiencies noted', status: 'Corrected' },
    ],
    amenities: [
      { icon: '🍽️', name: 'Cafeteria-Style Dining' },
      { icon: '🏊', name: 'Swimming Pool' },
      { icon: '🎮', name: 'Game Room' },
      { icon: '💈', name: 'Beauty Salon' },
      { icon: '🙏', name: 'Multi-Faith Chapel' },
      { icon: '🚌', name: 'Transportation' },
      { icon: '🌳', name: 'Outdoor Spaces' },
      { icon: '📺', name: 'Common TV Lounges' },
      { icon: '💊', name: 'Medication Assistance' },
      { icon: '🎵', name: 'Entertainment Programs' },
      { icon: '🐾', name: 'Pet-Friendly' },
      { icon: '👨‍👩‍👧', name: 'Family Visiting Areas' },
    ],
  },
  6: {
    id: 6,
    name: 'Brookline Premier Assisted Living',
    address: '987 Beacon St, Brookline, MA 02446',
    phone: '(617) 555-0606',
    email: 'admissions@brooklinepremier.example.com',
    rating: 4.8,
    complianceRating: 'Excellent',
    careTypes: ['Assisted Living', 'Memory Care'],
    capacity: 95,
    monthlyMin: 5500,
    monthlyMax: 9000,
    about: "Brookline Premier Assisted Living offers luxury senior care in one of Boston's most prestigious neighborhoods. Our boutique community combines five-star amenities with personalized, compassionate care — redefining what assisted living can be.",
    complianceHistory: [
      { date: 'Mar 2024', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
      { date: 'Mar 2023', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
      { date: 'Mar 2022', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
      { date: 'Sep 2021', type: 'Complaint Investigation', findings: 'Unsubstantiated', status: 'Resolved' },
      { date: 'Mar 2021', type: 'Annual Inspection', findings: 'No deficiencies found', status: 'Pass' },
    ],
    amenities: [
      { icon: '🍽️', name: 'Fine Dining Restaurant' },
      { icon: '🍷', name: 'Wine & Cocktail Lounge' },
      { icon: '🏋️', name: 'Luxury Fitness Center' },
      { icon: '🧘', name: 'Yoga & Meditation Studio' },
      { icon: '💆', name: 'Spa & Wellness Center' },
      { icon: '🚌', name: 'Concierge Transportation' },
      { icon: '💻', name: 'Technology Programs' },
      { icon: '🎨', name: 'Fine Arts Studio' },
      { icon: '🌳', name: 'Rooftop Garden Terrace' },
      { icon: '💈', name: 'Full-Service Salon & Spa' },
      { icon: '🎭', name: 'Cultural Events & Theater' },
      { icon: '🏥', name: 'On-Call Physician' },
    ],
  },
}

function StarRating({ rating }) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(<span key={i} className={styles.starFull}>★</span>)
    } else if (i - 0.5 <= rating) {
      stars.push(<span key={i} className={styles.starHalf}>★</span>)
    } else {
      stars.push(<span key={i} className={styles.starEmpty}>★</span>)
    }
  }
  return <div className={styles.starRating}>{stars} <span className={styles.ratingNumber}>{rating}/5</span></div>
}

export default function FacilityPage({ facility }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })

  if (!facility) {
    return (
      <>
        <Navbar />
        <div className={styles.notFound}>
          <h1>Facility Not Found</h1>
          <Link href="/search">Back to Search</Link>
        </div>
      </>
    )
  }

  const complianceClass = facility.complianceRating === 'Excellent'
    ? styles.badgeExcellent
    : facility.complianceRating === 'Good'
    ? styles.badgeGood
    : styles.badgeNeedsImprovement

  const statusClass = (status) => {
    if (status === 'Pass' || status === 'Resolved') return styles.statusPass
    if (status === 'Corrected') return styles.statusCorrected
    return styles.statusInProgress
  }

  const handleFormChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    alert('Your message has been sent! The facility will contact you shortly.')
    setFormData({ name: '', email: '', message: '' })
  }

  return (
    <>
      <Head>
        <title>{facility.name} - AI Assist Living Finder</title>
        <meta name="description" content={`View details for ${facility.name} in Massachusetts`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Navbar />

      <div className={styles.facilityPage}>
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <div className="container">
            <Link href="/" className={styles.breadcrumbLink}>Home</Link>
            <span className={styles.breadcrumbSep}> › </span>
            <Link href="/search" className={styles.breadcrumbLink}>Search</Link>
            <span className={styles.breadcrumbSep}> › </span>
            <span className={styles.breadcrumbCurrent}>{facility.name}</span>
          </div>
        </div>

        {/* Facility Header */}
        <div className={styles.facilityHeader}>
          <div className="container">
            <div className={styles.headerContent}>
              <div className={styles.headerInfo}>
                <h1 className={styles.facilityName}>{facility.name}</h1>
                <p className={styles.facilityAddress}>📍 {facility.address}</p>
                <StarRating rating={facility.rating} />
                <span className={`${styles.complianceBadge} ${complianceClass}`}>
                  {facility.complianceRating === 'Excellent' ? '✓' : facility.complianceRating === 'Good' ? '~' : '!'} {facility.complianceRating} Compliance
                </span>
              </div>
              <div className={styles.headerActions}>
                <button className={styles.tourBtn}>📅 Schedule a Tour</button>
                <button className={styles.contactBtn}>📞 Contact Facility</button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabNav}>
          <div className="container">
            <div className={styles.tabs}>
              {['overview', 'compliance', 'amenities', 'contact'].map(tab => (
                <button
                  key={tab}
                  className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'overview' && 'Overview'}
                  {tab === 'compliance' && 'Compliance History'}
                  {tab === 'amenities' && 'Amenities'}
                  {tab === 'contact' && 'Contact'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          <div className="container">

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className={styles.overviewGrid}>
                <div className={styles.overviewMain}>
                  <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>About This Facility</h2>
                    <p className={styles.aboutText}>{facility.about}</p>
                  </div>
                  <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Care Types Offered</h2>
                    <div className={styles.careTypesList}>
                      {facility.careTypes.map(type => (
                        <span key={type} className={styles.careTypeBadge}>{type}</span>
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
                      <span className={styles.infoValue}>${facility.monthlyMin.toLocaleString()} – ${facility.monthlyMax.toLocaleString()}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Compliance</span>
                      <span className={`${styles.complianceBadge} ${complianceClass}`}>{facility.complianceRating}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Rating</span>
                      <span className={styles.infoValue}>{facility.rating}/5.0</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Compliance History Tab */}
            {activeTab === 'compliance' && (
              <div className={styles.complianceSection}>
                <h2 className={styles.sectionTitle}>Compliance History</h2>
                <p className={styles.sectionDesc}>Inspection records sourced from Massachusetts Department of Public Health</p>
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
                      {facility.complianceHistory.map((row, i) => (
                        <tr key={i}>
                          <td>{row.date}</td>
                          <td>{row.type}</td>
                          <td>{row.findings}</td>
                          <td><span className={`${styles.statusBadge} ${statusClass(row.status)}`}>{row.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Amenities Tab */}
            {activeTab === 'amenities' && (
              <div className={styles.amenitiesSection}>
                <h2 className={styles.sectionTitle}>Amenities & Services</h2>
                <div className={styles.amenitiesGrid}>
                  {facility.amenities.map((amenity, i) => (
                    <div key={i} className={styles.amenityCard}>
                      <div className={styles.amenityIcon}>{amenity.icon}</div>
                      <div className={styles.amenityName}>{amenity.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Tab */}
            {activeTab === 'contact' && (
              <div className={styles.contactSection}>
                <div className={styles.contactGrid}>
                  <div className={styles.contactInfo}>
                    <h2 className={styles.sectionTitle}>Contact Information</h2>
                    <div className={styles.contactDetail}>
                      <span className={styles.contactIcon}>📍</span>
                      <span>{facility.address}</span>
                    </div>
                    <div className={styles.contactDetail}>
                      <span className={styles.contactIcon}>📞</span>
                      <span>{facility.phone}</span>
                    </div>
                    <div className={styles.contactDetail}>
                      <span className={styles.contactIcon}>✉️</span>
                      <span>{facility.email}</span>
                    </div>
                  </div>
                  <div className={styles.contactForm}>
                    <h2 className={styles.sectionTitle}>Send a Message</h2>
                    <form onSubmit={handleFormSubmit}>
                      <div className={styles.formGroup}>
                        <label htmlFor="contact-name" className={styles.formLabel}>Your Name</label>
                        <input
                          id="contact-name"
                          type="text"
                          name="name"
                          className={styles.formInput}
                          value={formData.name}
                          onChange={handleFormChange}
                          placeholder="John Smith"
                          required
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label htmlFor="contact-email" className={styles.formLabel}>Email Address</label>
                        <input
                          id="contact-email"
                          type="email"
                          name="email"
                          className={styles.formInput}
                          value={formData.email}
                          onChange={handleFormChange}
                          placeholder="john@example.com"
                          required
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label htmlFor="contact-message" className={styles.formLabel}>Message</label>
                        <textarea
                          id="contact-message"
                          name="message"
                          className={styles.formTextarea}
                          value={formData.message}
                          onChange={handleFormChange}
                          placeholder="I am interested in learning more about care options and pricing..."
                          rows={5}
                          required
                        />
                      </div>
                      <button type="submit" className={styles.submitBtn}>Send Message</button>
                    </form>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}

export async function getStaticPaths() {
  const paths = [1, 2, 3, 4, 5, 6].map(id => ({
    params: { id: String(id) }
  }))
  return { paths, fallback: false }
}

export async function getStaticProps({ params }) {
  const facility = facilitiesData[Number(params.id)] || null
  return { props: { facility } }
}
