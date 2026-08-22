import Link from 'next/link'
import ConsumerLeadCapture from '../../components/ConsumerLeadCapture'
import styles from '../../styles/ContentGuide.module.css'

const title = 'Massachusetts Assisted Living Financial Help: MassHealth, SCO, PACE, GAFC & Veterans Benefits'
const description =
  'Every state and federal program that lowers assisted living costs in Massachusetts: SCO, PACE, GAFC, SCOPACE, Veterans Aid & Attendance, Section 8, and MRVP. Eligibility, application steps, and how to verify facility approval.'

export const metadata = {
  title,
  description,
  alternates: { canonical: '/massachusetts-assisted-living-financial-help' },
  openGraph: {
    title,
    description,
    url: '/massachusetts-assisted-living-financial-help',
    type: 'article',
  },
}

export default function FinancialHelpPage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://assistedly.ai/' },
      { '@type': 'ListItem', position: 2, name: 'Massachusetts Financial Help', item: 'https://assistedly.ai/massachusetts-assisted-living-financial-help' },
    ],
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: { '@type': 'Organization', name: 'Assistedly.ai', url: 'https://assistedly.ai' },
    publisher: { '@type': 'Organization', name: 'Assistedly.ai', url: 'https://assistedly.ai' },
    datePublished: '2026-08-21',
    dateModified: '2026-08-21',
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://assistedly.ai/massachusetts-assisted-living-financial-help' },
  }

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Apply for MassHealth SCO for Assisted Living',
    step: [
      { '@type': 'HowToStep', name: 'Confirm MassHealth eligibility', text: 'Check income and asset limits at Mass.gov or call MassHealth Customer Service at 1-800-841-2900.' },
      { '@type': 'HowToStep', name: 'Find SCO-approved facilities', text: 'Use Assistedly.ai to filter facilities by SCO acceptance, or check the MassHealth provider directory.' },
      { '@type': 'HowToStep', name: 'Schedule a care assessment', text: 'MassHealth will conduct a needs assessment to determine eligibility for long-term care services.' },
      { '@type': 'HowToStep', name: 'Enroll in a SCO plan', text: 'Choose a SCO plan that contracts with your preferred facility. Complete enrollment paperwork with a MassHealth counselor.' },
      { '@type': 'HowToStep', name: 'Confirm facility billing', text: 'Verify that the facility understands SCO billing and has a current contract with your chosen plan.' },
    ],
  }

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Financial navigation</p>
        <h1>{title}</h1>
        <p className={styles.subtitle}>
          Most families overpay for assisted living because they do not know about programs that can
          cover thousands of dollars per month. Here is every state and federal option available in
          Massachusetts.
        </p>
      </section>

      <div className={styles.container}>
        <div className={styles.splitLayout}>
          <article className={styles.article}>
            <section>
              <h2>Overview: why this matters</h2>
              <p>
                Massachusetts assisted living costs roughly 55% above the national average. A typical
                family spends <strong>$66,000–$102,000 per year</strong> on room, board, and care. For
                middle-income families, that gap is unsustainable without help.
              </p>
              <p>
                The good news: Massachusetts offers several programs that reduce out-of-pocket costs
                for eligible seniors. The bad news: most families never hear about them until they are
                already in crisis. This guide covers every major option, eligibility basics, and how to
                verify that a facility actually accepts the program before you sign a contract.
              </p>
            </section>

            <section>
              <h2>Senior Care Options (SCO)</h2>
              <p>
                <strong>SCO</strong> is a MassHealth program that wraps medical, behavioral, and
                long-term care services into one managed care plan. For eligible seniors, SCO can
                significantly reduce assisted living costs by covering the care portion of monthly
                fees.
              </p>
              <p>
                <strong>Who qualifies:</strong> Massachusetts residents aged 65+ who meet MassHealth
                financial eligibility. Some SCO plans also serve younger adults with disabilities.
              </p>
              <p>
                <strong>What it covers:</strong> Primary care, specialist visits, hospital care,
                prescription drugs, and long-term care services including personal care in assisted
                living. It does not typically cover room and board in full, but the care coverage can
                reduce total out-of-pocket costs by $1,500–$3,500 per month.
              </p>
              <p>
                <strong>How to apply:</strong> Call MassHealth Customer Service at 1-800-841-2900 or
                apply online at Mass.gov. You will need proof of income, assets, residency, and a
                medical needs assessment.
              </p>
              <p>
                <strong>Facility check:</strong> Not every assisted living facility accepts every SCO
                plan. Use our <Link href="/affordable">insurance filter</Link> or ask the facility for
                a current list of approved SCO plans before you tour.
              </p>
            </section>

            <section>
              <h2>PACE</h2>
              <p>
                <strong>PACE</strong> (Program of All-Inclusive Care for the Elderly) provides
                comprehensive medical and social services for seniors who qualify for nursing-home level
                care but want to remain in the community.
              </p>
              <p>
                <strong>Who qualifies:</strong> Massachusetts residents aged 55+ who are certified as
                needing nursing-home level care by a state assessment. You must live in a PACE service
                area.
              </p>
              <p>
                <strong>What it covers:</strong> Adult day health, home care, physician services,
                hospital care, prescription drugs, physical therapy, and facility-based care. Some PACE
                participants live in assisted living while receiving PACE services.
              </p>
              <p>
                <strong>How to apply:</strong> Contact a local PACE organization (e.g., Elder Service
                Plan, Summit ElderCare, or Springwell PACE) for an eligibility screening. The process
                typically takes 2–4 weeks.
              </p>
            </section>

            <section>
              <h2>GAFC — Group Adult Foster Care</h2>
              <p>
                <strong>GAFC</strong> is a MassHealth program that pays for personal care services in
                approved assisted living and adult foster care settings.
              </p>
              <p>
                <strong>Important limitation:</strong> GAFC covers care services only, not room and
                board. However, for eligible residents, the care subsidy can reduce total monthly costs
                by $1,000–$2,000.
              </p>
              <p>
                <strong>Who qualifies:</strong> MassHealth-eligible adults who need help with at least
                one activity of daily living (ADL) and live in an approved GAFC provider.
              </p>
              <p>
                <strong>How to apply:</strong> Ask the facility if they are a GAFC provider. If yes, they
                can help initiate the MassHealth application and needs assessment.
              </p>
            </section>

            <section>
              <h2>SCOPACE for Assisted Living Residences</h2>
              <p>
                <strong>SCOPACE</strong> is a specific MassHealth program for residents of Assisted
                Living Residences (ALRs). It combines the SCO medical wrap with additional support for
                ALR-based personal care.
              </p>
              <p>
                SCOPACE is less well-known than standard SCO, but it can be the best option for families
                whose parent already lives in or is moving to a licensed ALR. Ask the facility
                administrator directly: “Are you a SCOPACE provider, and if so, which plans?”
              </p>
            </section>

            <section>
              <h2>Veterans Aid & Attendance</h2>
              <p>
                This federal pension supplement helps wartime veterans and surviving spouses who need
                assistance with daily activities pay for assisted living, home care, or adult day care.
              </p>
              <p>
                <strong>Benefit amounts (2026 estimates):</strong>
              </p>
              <ul>
                <li>Veteran without dependents: ~$1,400/month</li>
                <li>Veteran with dependents: ~$1,900/month</li>
                <li>Surviving spouse: ~$1,200/month</li>
                <li>Two veterans married to each other: ~$2,800/month</li>
              </ul>
              <p>
                <strong>Who qualifies:</strong> Wartime veterans (90 days active duty, at least one day
                during a wartime period) or their surviving spouses, meeting income and asset limits and
                requiring assistance with at least two ADLs.
              </p>
              <p>
                <strong>How to apply:</strong> Submit VA Form 21-2680 (Examination for Housebound Status
                or Permanent Need for Regular Aid and Attendance) through your county Veterans Service
                Officer or a VA-accredited agent. Processing can take 3–9 months, so apply early.
              </p>
            </section>

            <section>
              <h2>Section 8 and MRVP</h2>
              <p>
                <strong>Section 8</strong> and the <strong>Massachusetts Rental Voucher Program (MRVP)</strong>{' '}
                are housing voucher programs that some assisted living facilities accept for the housing
                portion of monthly fees.
              </p>
              <p>
                <strong>Reality check:</strong> Vouchers are limited and waitlists are often 2–5 years.
                Apply as early as possible through your local housing authority. Not all ALRs accept
                vouchers, so confirm with each facility.
              </p>
            </section>

            <section>
              <h2>Long-term care insurance</h2>
              <p>
                If your parent purchased long-term care insurance years ago, now is the time to review
                the policy. Most policies cover assisted living if the insured needs help with 2–3
                ADLs.
              </p>
              <p>
                <strong>Action step:</strong> Request a benefit summary from the insurer. Confirm:
                elimination period, daily benefit amount, inflation rider status, and whether the
                policy pays the facility directly or reimburses the family.
              </p>
            </section>

            <section>
              <h2>How to verify facility program acceptance</h2>
              <ol>
                <li>Ask the facility administrator for a written list of currently accepted programs.</li>
                <li>
                  Cross-check with the MassHealth provider directory (Mass.gov) for SCO, PACE, and
                  GAFC.
                </li>
                <li>
                  Confirm the specific <em>plan name</em>, not just the program. A facility may accept
                  Summit ElderCare PACE but not Elder Service Plan PACE.
                </li>
                <li>
                  If the facility says they are “working on approval,” treat it as a no until you see
                  a contract.
                </li>
              </ol>
            </section>

            <div className={styles.ctaBox}>
              <h3>Get the financial help checklist</h3>
              <p>
                A printable checklist of every Massachusetts program, eligibility criteria, and
                application deadlines — sent to your email.
              </p>
              <ConsumerLeadCapture
                page="/massachusetts-assisted-living-financial-help"
                leadMagnet="massachusetts-financial-help-checklist"
                title="Get the financial help checklist"
                description="Email yourself the program checklist, eligibility guide, and application deadlines."
              />
            </div>

            <section>
              <h2>Related guides</h2>
              <div className={styles.relatedGrid}>
                <Link href="/massachusetts-assisted-living-costs" className={styles.relatedCard}>
                  <strong>Massachusetts Cost Guide</strong>
                  <span>Price ranges by region and what drives cost differences.</span>
                </Link>
                <Link href="/massachusetts-assisted-living-guide" className={styles.relatedCard}>
                  <strong>Complete Massachusetts Guide</strong>
                  <span>Everything families need to know about assisted living in one place.</span>
                </Link>
                <Link href="/affordable" className={styles.relatedCard}>
                  <strong>Most Affordable Facilities</strong>
                  <span>Interactive dashboard filtered for insurance-accepting, low-cost options.</span>
                </Link>
                <Link href="/how-to-choose-assisted-living-massachusetts" className={styles.relatedCard}>
                  <strong>How to Choose Without Getting Sold To</strong>
                  <span>Red flags, tour questions, and how broker commissions influence rankings.</span>
                </Link>
              </div>
            </section>
          </article>

          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <h4>Find affordable options</h4>
              <p>Filter all licensed Massachusetts facilities by fee and insurance acceptance.</p>
              <Link href="/affordable">Explore affordable</Link>
            </div>
            <div className={styles.sidebarCard}>
              <h4>Cost calculator</h4>
              <p>Model monthly costs by care level, insurance, and location.</p>
              <Link href="/cost-calculator">Calculate costs</Link>
            </div>
            <div className={styles.sidebarCard}>
              <h4>MassHealth info</h4>
              <p>Official MassHealth eligibility and application information.</p>
              <a href="https://www.mass.gov/masshealth" target="_blank" rel="noopener noreferrer">Mass.gov MassHealth →</a>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
