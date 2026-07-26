import Link from 'next/link'
import { AssistedlyWizard } from '../../components/AssistedlyWizard'
import styles from './page.module.css'
import {
  MASSACHUSETTS_CONTENT_ENGINE_OVERVIEW,
  MASSACHUSETTS_FEATURED_FACILITIES,
  MASSACHUSETTS_TOWN_ENGINE_PAGES,
} from '../../lib/massachusettsContentEngine'

const title = 'Massachusetts Assisted Living Guides'
const description =
  'Browse Massachusetts assisted living guides, town-specific luxury landing pages, and featured facility profiles.'

export const metadata = {
  title,
  description,
  alternates: {
    canonical: '/massachusetts',
  },
  openGraph: {
    title,
    description,
    url: '/massachusetts',
    type: 'website',
  },
}

export default function MassachusettsContentEnginePage() {
  const itemListStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Massachusetts assisted living town guides',
    itemListElement: MASSACHUSETTS_TOWN_ENGINE_PAGES.map((page, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: page.h1,
      url: `/massachusetts/${page.town}/luxury-assisted-living`,
    })),
  }

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListStructuredData) }}
      />

      <section className={styles.hero}>
        <div className="container">
          <p className={styles.eyebrow}>Massachusetts content engine</p>
          <h1 className={styles.title}>Massachusetts assisted living city and facility guides</h1>
          <p className={styles.subtitle}>
            This hub links the live Massachusetts landing pages and facility profiles already published
            across the site, so search engines and families can reach the canonical pages directly.
          </p>
          <div className={styles.actions}>
            <a href="#assistant" className="btn-primary">
              Start your free match
            </a>
            <Link href="/search" className="btn-primary">
              Search facilities
            </Link>
            <Link href="/find-safest" className="btn-secondary">
              Compare safest options
            </Link>
          </div>
          <dl className={styles.stats}>
            <div className={styles.statCard}>
              <dt>Town guides</dt>
              <dd>{MASSACHUSETTS_CONTENT_ENGINE_OVERVIEW.townCount}</dd>
            </div>
            <div className={styles.statCard}>
              <dt>Facility profiles</dt>
              <dd>{MASSACHUSETTS_CONTENT_ENGINE_OVERVIEW.facilityCount}</dd>
            </div>
            <div className={styles.statCard}>
              <dt>Coverage</dt>
              <dd>Massachusetts</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className={styles.botSection} id="assistant" aria-labelledby="massachusetts-bot-heading">
        <div className="container">
          <div className={styles.botLayout}>
            <div className={styles.botIntro}>
              <p className={styles.botEyebrow}>AI matching assistant</p>
              <h2 id="massachusetts-bot-heading">Get Massachusetts assisted living matches on this page</h2>
              <p>
                Answer a few questions about care needs, budget, urgency, and location to get a
                guided match without leaving the Massachusetts hub.
              </p>
              <ul className={styles.botBullets}>
                <li>No account required to start</li>
                <li>Massachusetts-focused recommendations</li>
                <li>Budget and urgency prompts included</li>
              </ul>
            </div>
            <div className={styles.botCard}>
              <AssistedlyWizard />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2>View by City/Town</h2>
            <p>
              See ratings for each assisted-living facility sorted by city or town.
            </p>
          </div>
          <div className={styles.townGrid}>
            {MASSACHUSETTS_TOWN_ENGINE_PAGES.map((page) => (
              <article key={page.town} className={styles.card}>
                <p className={styles.cardEyebrow}>{page.townLabel}, MA</p>
                <h3>{page.h1}</h3>
                <p>{page.meta_description}</p>
                <div className={styles.cardMeta}>
                  <span>{page.facilityCount} linked facility profile{page.facilityCount === 1 ? '' : 's'}</span>
                </div>
                <Link
                  href={`/massachusetts/${page.town}/luxury-assisted-living`}
                  className={styles.cardLink}
                >
                  View {page.townLabel} guide
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2>Featured facility pages</h2>
            <p>These profiles are the canonical facility pages already linked from search and trust tools.</p>
          </div>
          <div className={styles.facilityGrid}>
            {MASSACHUSETTS_FEATURED_FACILITIES.map((facility) => (
              <article key={facility.slug} className={styles.card}>
                <p className={styles.cardEyebrow}>{facility.townLabel}, MA</p>
                <h3>{facility.name}</h3>
                <p>{facility.about}</p>
                <div className={styles.cardMeta}>
                  <span>{facility.careTypes.join(' • ')}</span>
                  <span>
                    ${Number(facility.monthlyMin || 0).toLocaleString()} - ${Number(facility.monthlyMax || 0).toLocaleString()}/mo
                  </span>
                </div>
                <Link
                  href={`/massachusetts/${facility.town}/${facility.slug}`}
                  className={styles.cardLink}
                >
                  View facility profile
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2>More Massachusetts planning tools</h2>
            <p>Families can move from research into comparison, pricing, and advisor help without leaving the site.</p>
          </div>
          <div className={styles.toolGrid}>
            <Link href="/tools/cost-calculator" className={styles.toolCard}>
              <strong>Cost calculator</strong>
              <span>Estimate Massachusetts assisted living and memory care monthly costs.</span>
            </Link>
            <Link href="/find-safest" className={styles.toolCard}>
              <strong>Safest places</strong>
              <span>Compare safety-focused trust metrics before contacting facilities.</span>
            </Link>
            <Link href="/partner-introductions" className={styles.toolCard}>
              <strong>Partner introductions</strong>
              <span>Request introductions to agencies, advisors, or Medicaid planners.</span>
            </Link>
            <Link href="/concierge" className={styles.toolCard}>
              <strong>Concierge shortlist</strong>
              <span>Start the paid shortlist workflow for higher-touch family support.</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
