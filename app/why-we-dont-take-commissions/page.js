import Link from 'next/link'
import ConsumerLeadCapture from '../../components/ConsumerLeadCapture'
import styles from '../../styles/ContentGuide.module.css'

const title = 'Why Assistedly.ai Does Not Take Facility Commissions'
const description =
  'How the traditional assisted living referral-fee model works, why it creates conflicts of interest, and how Assistedly.ai stays independent so families get unbiased recommendations.'

export const metadata = {
  title,
  description,
  alternates: { canonical: '/why-we-dont-take-commissions' },
  openGraph: {
    title,
    description,
    url: '/why-we-dont-take-commissions',
    type: 'article',
  },
}

export default function WhyNoCommissionsPage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://assistedly.ai/' },
      { '@type': 'ListItem', position: 2, name: 'Why We Do Not Take Commissions', item: 'https://assistedly.ai/why-we-dont-take-commissions' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://assistedly.ai/why-we-dont-take-commissions' },
  }

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Radical transparency</p>
        <h1>{title}</h1>
        <p className={styles.subtitle}>
          The assisted living industry is built on hidden referral fees. We think families deserve to
          know how the system works — and why we chose a different path.
        </p>
      </section>

      <div className={styles.container}>
        <div className={styles.splitLayout}>
          <article className={styles.article}>
            <section>
              <h2>The industry standard: how referral fees work</h2>
              <p>
                When most families search for assisted living, they encounter one of two models:
              </p>
              <ul>
                <li>
                  <strong>Placement agencies</strong> that provide a &quot;free&quot; advisor service. The advisor
                  tours facilities with you, recommends options, and handles paperwork.
                </li>
                <li>
                  <strong>Online directories</strong> that rank facilities, display photos, and collect
                  your contact information for &quot;more information.&quot;
                </li>
              </ul>
              <p>
                Both models are funded by <strong>facility referral fees</strong>. When a family moves
                into a recommended facility, the facility pays the broker a commission. That commission
                typically ranges from <strong>50% to 150% of one month’s rent</strong> — often
                $4,000–$12,000 per placement.
              </p>
              <p>
                The broker wins when you pick a partner facility. The facility wins because the broker
                steers families their way. The only person who does not win is the family, who may
                never see the facility that was actually the best fit.
              </p>
            </section>

            <section>
              <h2>Why referral fees create bad outcomes</h2>
              <p>
                Referral fees do not have to be illegal to be harmful. Here is how they distort the
                market:
              </p>
              <ul>
                <li>
                  <strong>Ranking bias.</strong> Directory sites often rank higher-paying facilities
                  above better-quality ones. A facility with a mediocre inspection record but a generous
                  commission rate can outrank a top-rated nonprofit.
                </li>
                <li>
                  <strong>Limited inventory.</strong> Placement advisors typically show you 3–5 options.
                  Those options are not the best in your area — they are the facilities that have
                  signed referral agreements with the advisor’s company.
                </li>
                <li>
                  <strong>Urgency pressure.</strong> Because brokers are paid only on placement, they
                  have an incentive to close quickly. Families feel rushed to sign before they have
                  toured enough options or reviewed contracts carefully.
                </li>
                <li>
                  <strong>Hidden costs.</strong> The &quot;free&quot; service is not free. The commission is baked
                  into facility pricing. In competitive markets, facilities with high broker dependency
                  may raise base rates to cover referral costs.
                </li>
              </ul>
            </section>

            <section>
              <h2>How we are different</h2>
              <p>
                Assistedly.ai was founded after our own family experienced the broker model firsthand.
                We watched a well-meaning advisor push us toward a facility that paid the highest
                commission — not the one closest to our mother’s doctor, not the one with the best
                inspection record, and not the one that accepted her MassHealth plan.
              </p>
              <p>
                We built something different. Our rankings are generated from{' '}
                <Link href="/methodology">public data and your inputs</Link>. No facility can pay to
                improve its position. No advisor earns a commission on your decision. Our revenue comes
                from optional services you choose to buy, not from the facility you choose to move
                into.
              </p>
              <p>
                That means:
              </p>
              <ul>
                <li>
                  We show you <strong>every licensed facility</strong> in Massachusetts, not just the
                  ones with referral contracts.
                </li>
                <li>
                  Our <Link href="/methodology">scoring algorithm</Link> uses inspection trends,
                  staffing ratios, and program breadth — not commission rates.
                </li>
                <li>
                  You can use the platform <strong>entirely for free</strong> without ever speaking to
                  a salesperson.
                </li>
                <li>
                  If no facility on our platform feels right, we will tell you that directly and help
                  you understand why.
                </li>
              </ul>
            </section>

            <section>
              <h2>What we charge for — and why</h2>
              <p>
                Our free tier includes search, filter, compare, and save. If you want more help, we
                offer:
              </p>
              <ul>
                <li>
                  <strong>Detailed facility reports</strong> — deep-dive PDFs with inspection trends,
                  staffing context, and cost projections.
                </li>
                <li>
                  <strong>Guided decision-support sessions</strong> — phone or video calls with a
                  Massachusetts-focused advisor to narrow options and prepare for tours.
                </li>
                <li>
                  <strong>Move-planning tools</strong> — checklists, timeline templates, and family
                  coordination worksheets.
                </li>
              </ul>
              <p>
                These services are priced upfront. There are no hidden fees, subscription traps, or
                facility kickbacks.{' '}
                <Link href="/how-we-make-money">Read our full revenue model</Link>.
              </p>
            </section>

            <section>
              <h2>Our pledge to families</h2>
              <ol>
                <li>We will never accept a placement commission from a facility.</li>
                <li>We will never sell your contact information as a &quot;lead.&quot;</li>
                <li>We will never let a commercial relationship influence a facility’s ranking.</li>
                <li>We will publish our methodology, data sources, and limitations openly.</li>
                <li>If our revenue model changes, we will notify you 30 days in advance.</li>
              </ol>
            </section>

            <section>
              <h2>How to verify our claims</h2>
              <p>
                We publish our <Link href="/methodology">methodology</Link>,{' '}
                <Link href="/data-sources">data sources</Link>, and{' '}
                <Link href="/editorial-policy">editorial policy</Link> on this site. Our privacy and
                security code is open-source on{' '}
                <a href="https://github.com/JoshFialkoff/Assistedly.ai/" target="_blank" rel="noopener noreferrer">GitHub</a>.
              </p>
              <p>
                If you ever believe we have violated these principles, contact us at{' '}
                <a href="mailto:trust@assistedly.ai">trust@assistedly.ai</a>. We investigate every
                report and publish significant corrections within 48 hours.
              </p>
            </section>

            <div className={styles.ctaBox}>
              <h3>Join the transparency newsletter</h3>
              <p>
                Get quarterly updates on our data refreshes, methodology changes, and independent audits
                — with no sales pitches.
              </p>
              <ConsumerLeadCapture
                page="/why-we-dont-take-commissions"
                leadMagnet="transparency-newsletter"
                title="Join the transparency newsletter"
                description="Email yourself quarterly trust updates and methodology reports."
              />
            </div>

            <section>
              <h2>Related trust pages</h2>
              <div className={styles.relatedGrid}>
                <Link href="/how-we-make-money" className={styles.relatedCard}>
                  <strong>How We Make Money</strong>
                  <span>Our full revenue model: what we charge for and what we refuse to sell.</span>
                </Link>
                <Link href="/methodology" className={styles.relatedCard}>
                  <strong>Methodology</strong>
                  <span>How safety scores, care-depth scores, and rankings are calculated.</span>
                </Link>
                <Link href="/how-to-choose-assisted-living-massachusetts" className={styles.relatedCard}>
                  <strong>How to Choose Without Getting Sold To</strong>
                  <span>Red flags during tours and the 20 questions every family should ask.</span>
                </Link>
                <Link href="/editorial-policy" className={styles.relatedCard}>
                  <strong>Editorial Policy</strong>
                  <span>How we write, review, and correct content.</span>
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
              <h4>Trust Center</h4>
              <p>How we work, our data sources, and our privacy practices.</p>
              <Link href="/how-we-work">How we work</Link>
            </div>
            <div className={styles.sidebarCard}>
              <h4>Our commitment</h4>
              <p>Open-source privacy code, transparent methodology, and independent rankings.</p>
              <Link href="/data-sources">Data sources</Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
