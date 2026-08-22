import Link from 'next/link'
import ConsumerLeadCapture from '../../components/ConsumerLeadCapture'
import styles from '../../styles/ContentGuide.module.css'

const title = 'How to Choose Assisted Living in Massachusetts Without Getting Sold To'
const description =
  'The insider guide to choosing assisted living in Massachusetts: how the broker model works, what red flags to spot on tours, and the 20 questions every family should ask before signing.'

export const metadata = {
  title,
  description,
  alternates: { canonical: '/how-to-choose-assisted-living-massachusetts' },
  openGraph: {
    title,
    description,
    url: '/how-to-choose-assisted-living-massachusetts',
    type: 'article',
  },
}

export default function HowToChoosePage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://assistedly.ai/' },
      { '@type': 'ListItem', position: 2, name: 'How to Choose', item: 'https://assistedly.ai/how-to-choose-assisted-living-massachusetts' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://assistedly.ai/how-to-choose-assisted-living-massachusetts' },
  }

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Unbiased guidance</p>
        <h1>{title}</h1>
        <p className={styles.subtitle}>
          Most assisted living directories make money by steering families toward facilities that pay
          the highest referral fees. Here is how to cut through the sales pitch and find the right
          match for your family.
        </p>
      </section>

      <div className={styles.container}>
        <div className={styles.splitLayout}>
          <article className={styles.article}>
            <section>
              <h2>The broker problem</h2>
              <p>
                When you call a traditional assisted living placement service, the advisor you speak with
                is often paid by the facility — not by you. The typical commission ranges from{' '}
                <strong>50% to 150% of one month’s rent</strong>. That creates a powerful incentive to
                recommend the highest-paying partner, not the best fit.
              </p>
              <p>
                Many families do not realize this. The advisor seems helpful, the process feels free, and
                the recommended communities look professional. But the list is filtered by commission
                rates, not by quality, location, or your parent’s specific needs.
              </p>
              <p>
                At Assistedly.ai, we do not take facility commissions. Our only revenue comes from optional
                decision-support services you choose to purchase. That means our rankings are driven by{' '}
                <Link href="/methodology">public data and your inputs</Link>, not by back-room
                agreements.
              </p>
            </section>

            <section>
              <h2>What to look for in a Massachusetts assisted living facility</h2>
              <h3>1. Safety trend over time</h3>
              <p>
                A single inspection report is a snapshot. What matters more is the <em>trend</em>: Are
                deficiencies increasing or decreasing? Are repeat issues resolved quickly?{' '}
                <Link href="/top-rated">Compare safety trends</Link> across facilities before you tour.
              </p>
              <h3>2. Staffing ratios by shift</h3>
              <p>
                Ask for the staff-to-resident ratio for <strong>each shift</strong>, including overnight.
                Massachusetts requires minimum staffing, but the best facilities exceed it. High
                turnover is a red flag — ask how long the average caregiver has worked there.
              </p>
              <h3>3. Program acceptance</h3>
              <p>
                If your parent may qualify for SCO, PACE, or GAFC, confirm the facility is{' '}
                <em>currently</em> approved — not just &quot;working on it.&quot; Program approval can reduce
                monthly costs by thousands of dollars.
              </p>
              <h3>4. Fee transparency</h3>
              <p>
                Request a written rate sheet that includes: base rate, care-level fees, second-occupant
                charges, annual increase caps, and move-out notice requirements. Verbal quotes are not
                contracts.
              </p>
              <h3>5. Resident life and culture</h3>
              <p>
                Visit during an activity, not just during a scheduled sales tour. Are residents engaged?
                Do staff know residents by name? Is the environment clean but not sterile? Trust your
                instincts.
              </p>
            </section>

            <section>
              <h2>Red flags during a tour</h2>
              <ul>
                <li>
                  The sales director pushes for a deposit before you have toured other options.
                </li>
                <li>
                  You are not allowed to speak with current residents or their families without
                  supervision.
                </li>
                <li>
                  Staffing ratios are &quot;proprietary information&quot; or cannot be shared in writing.
                </li>
                <li>
                  The facility is newly licensed with no inspection history and makes big promises about
                  &quot;luxury&quot; care.
                </li>
                <li>
                  Contract terms include large annual increases, short move-out notice periods, or
                  non-refundable deposits with vague conditions.
                </li>
                <li>
                  The facility claims to accept your insurance program but cannot produce a current
                  approval letter.
                </li>
              </ul>
            </section>

            <section>
              <h2>20 questions to ask on every tour</h2>
              <ol>
                <li>What is the staff-to-resident ratio for each shift, including overnight?</li>
                <li>What is the annual staff turnover rate?</li>
                <li>Can I see the most recent EOEA inspection summary?</li>
                <li>What is included in the base monthly fee?</li>
                <li>What care levels exist, and how is the care level assessed?</li>
                <li>How much does each care level add to the monthly bill?</li>
                <li>What is the annual fee increase history over the last five years?</li>
                <li>What is the move-out policy and notice period?</li>
                <li>Is there a waitlist? How long is it?</li>
                <li>Do you accept SCO, PACE, GAFC, or Veterans Aid & Attendance?</li>
                <li>Is there a dedicated memory care unit with SCR certification?</li>
                <li>What happens if my parent’s care needs exceed what the facility can provide?</li>
                <li>How do you handle medical emergencies?</li>
                <li>What is the policy on hospital readmission and bed holds?</li>
                <li>Can residents keep their own doctor, or must they use yours?</li>
                <li>What meals are provided, and can dietary restrictions be accommodated?</li>
                <li>What activities and social programming are available?</li>
                <li>Is transportation provided for medical appointments?</li>
                <li>What is the policy on pets and personal furniture?</li>
                <li>Can I speak with a current resident or family member off-site?</li>
              </ol>
            </section>

            <section>
              <h2>The Assistedly difference</h2>
              <p>
                We built Assistedly.ai because we watched our own family struggle with opaque pricing,
                high-pressure sales tactics, and conflicting information from brokers who were paid by
                the facilities they recommended.
              </p>
              <p>
                Our platform gives you the same data we wish we had: transparent safety scores,
                filterable cost ranges, insurance acceptance flags, and plain-English explanations of
                dense regulatory reports. You can use it entirely for free, and if you want extra help, our
                paid decision-support services are priced upfront with no hidden facility referral fees.
              </p>
              <p>
                Read more about <Link href="/why-we-dont-take-commissions">why we don&apos;t take commissions</Link>{' '}
                and <Link href="/how-we-make-money">how we make money</Link>.
              </p>
            </section>

            <div className={styles.ctaBox}>
              <h3>Download the unbiased choosing guide</h3>
              <p>
                Get a printable tour checklist, red-flag list, and cost comparison worksheet by email.
              </p>
              <ConsumerLeadCapture
                page="/how-to-choose-assisted-living-massachusetts"
                leadMagnet="how-to-choose-guide"
                title="Download the unbiased choosing guide"
                description="Email yourself the tour checklist, red flags, and cost worksheet."
              />
            </div>

            <section>
              <h2>Related guides</h2>
              <div className={styles.relatedGrid}>
                <Link href="/massachusetts-assisted-living-guide" className={styles.relatedCard}>
                  <strong>Complete Massachusetts Guide</strong>
                  <span>Costs, payment options, safety scores, and conversation starters.</span>
                </Link>
                <Link href="/massachusetts-assisted-living-costs" className={styles.relatedCard}>
                  <strong>Massachusetts Cost Guide</strong>
                  <span>Price ranges by region and programs that lower monthly fees.</span>
                </Link>
                <Link href="/why-we-dont-take-commissions" className={styles.relatedCard}>
                  <strong>Why We Don&apos;t Take Commissions</strong>
                  <span>How the referral-fee model works and why we rejected it.</span>
                </Link>
                <Link href="/how-to-talk-to-parent-about-assisted-living" className={styles.relatedCard}>
                  <strong>How to Talk to a Parent About AL</strong>
                  <span>Conversation scripts and sibling-alignment worksheets.</span>
                </Link>
              </div>
            </section>
          </article>

          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <h4>Compare facilities</h4>
              <p>Side-by-side table of pricing, safety scores, and care features.</p>
              <Link href="/compare">Start comparing</Link>
            </div>
            <div className={styles.sidebarCard}>
              <h4>Safety scores</h4>
              <p>Explore every licensed Massachusetts facility ranked by inspection trend.</p>
              <Link href="/top-rated">View safety rankings</Link>
            </div>
            <div className={styles.sidebarCard}>
              <h4>Why trust us?</h4>
              <p>No facility commissions. Transparent methodology. Open-source privacy code.</p>
              <Link href="/how-we-make-money">How we make money</Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
