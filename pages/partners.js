import Head from "next/head";
import { useState } from "react";
import styles from "../styles/Partners.module.css";
import ConsumerLeadCapture from "../components/ConsumerLeadCapture";

const PARTNER_TYPES = [
  {
    tag: "For Operators",
    title: "Senior Care Operators",
    subtitle: "Turn compliance data into family trust",
    content: (
      <>
        <p>
          Every facility on Assistedly starts with a free, auto-generated profile built from
          public licensing and inspection data. When you claim your profile, every edit is
          time-stamped—so families see both the state record and your corrections side by side.
        </p>
        <h3>What you get</h3>
        <ul>
          <li>Verified profile with editable fields and audit trail</li>
          <li>Benchmarking against peer facilities in your market</li>
          <li>Intake workflow tools to capture family needs before the tour</li>
          <li>Availability data management and wait-list features</li>
        </ul>
        <h3>How it works</h3>
        <p>
          Assistedly does not sell placement leads or ranked recommendations. Instead, families find
          you through transparent quality signals—staffing ratios, inspection histories, move-out
          patterns, and your own verified claims. You pay for workflow tools and intelligence, not
          for preferential placement.
        </p>
      </>
    ),
  },
  {
    tag: "For Innovators",
    title: "AgeTech & Device Makers",
    subtitle: "Bundle with the intelligence layer families already trust",
    content: (
      <>
        <p>
          From fall-detection wearables to in-home sensors, your device creates data that families
          desperately need—but rarely know how to act on. Assistedly is the bridge: when your
          sensor detects a pattern, our platform helps the family choose the right care escalation.
        </p>
        <h3>Integration-ready categories</h3>
        <ul>
          <li><strong>Wearables</strong> — Fall detection, gait monitoring, vital-sign tracking</li>
          <li><strong>In-home sensors</strong> — Activity patterns, sleep quality, environmental safety</li>
          <li><strong>Remote monitoring</strong> — Medication adherence, behavioral signals, care-team dashboards</li>
          <li><strong>Menopause platforms</strong> — Your patient is also someone&apos;s daughter; cross-sell into parent-care planning</li>
        </ul>
        <h3>Bundle opportunities</h3>
        <p>
          Single-vendor solutions rarely cover the full journey. We identify non-obvious partner
          pairings—e.g., fall-detection + environmental sensor + medication reminder as a bundled
          &quot;Aging in Place&quot; package—then channel families into Assistedly when the bundle reaches
          its limit and facility care becomes the safer option.
        </p>
      </>
    ),
  },
  {
    tag: "For Insurers",
    title: "Healthcare & Payor Partners",
    subtitle: "Reduce downstream claims with upstream planning",
    content: (
      <>
        <p>
          Preventable hospital readmissions, emergency placements, and caregiver burnout cost
          payors billions every year. When families plan assisted-living transitions with verified
          data instead of rushed crisis decisions, outcomes improve and total cost of care drops.
        </p>
        <h3>Use cases</h3>
        <ul>
          <li><strong>MA &amp; Medicare Advantage plans</strong> — Embed Assistedly as a covered care-navigation benefit</li>
          <li><strong>Employer benefits</strong> — Offer evidence-based senior-care planning as part of elder-care support programs</li>
          <li><strong>Value-based care networks</strong> — Direct high-risk members to quality facilities with lower readmission rates</li>
        </ul>
        <h3>The ROI case</h3>
        <p>
          Families who use Assistedly spend less time in emergency placement, choose facilities with
          better staffing ratios, and report higher satisfaction scores. That translates to lower
          ER utilization, shorter rehab stays, and better HEDIS / Star Ratings.
        </p>
      </>
    ),
  },
  {
    tag: "For Communities",
    title: "Ecosystem & Referral Partners",
    subtitle: "Generate eligible families without selling their data",
    content: (
      <>
        <p>
          Independent-living communities, caregiver networks, elder-law attorneys, and financial
          advisors all encounter families before the assisted-living decision happens. When you
          refer those families to Assistedly, they get transparent intelligence—and you retain
          the relationship.
        </p>
        <h3>Partner types</h3>
        <ul>
          <li><strong>Independent living communities</strong> — Bridge residents into higher-acuity care when needs change</li>
          <li><strong>Caregiver community platforms</strong> — Add evidence-based facility search to your existing resources</li>
          <li><strong>Elder-law &amp; financial planners</strong> — Give clients the data to align care choices with estate plans</li>
          <li><strong>Hospital discharge planners</strong> — Reduce bounce-backs by matching patients to facilities with proven track records</li>
          <li><strong>Home-care agencies</strong> — Identify the inflection point where facility care becomes safer than home care</li>
        </ul>
        <h3>How referrals work</h3>
        <p>
          We do not buy lead lists. Instead, we provide co-branded intake tools, embeddable search
          widgets, and white-labeled facility reports. Your families stay your families; we simply
          give them better data to make the next decision.
        </p>
      </>
    ),
  },
  {
    tag: "For Researchers",
    title: "Research & Data Partners",
    subtitle: "Build the evidence base for better senior care",
    content: (
      <>
        <p>
          Assistedly&apos;s proprietary dataset links state-reported licensing, staffing, and
          deficiency data with family-stated needs, facility corrections, and longitudinal outcomes.
          Researchers, policy makers, and public-health agencies can access aggregated, de-identified
          insights to advance the field.
        </p>
        <h3>Data products</h3>
        <ul>
          <li><strong>Market intelligence</strong> — Supply, pricing, and quality trends by metro, county, and state</li>
          <li><strong>Compliance benchmarking</strong> — Standardized deficiency scores across operators and geographies</li>
          <li><strong>Family journey analytics</strong> — Search patterns, decision timelines, and conversion signals</li>
          <li><strong>Validated outcomes</strong> — Satisfaction proxies derived from move-out type and facility-switch patterns</li>
        </ul>
        <h3>How we protect privacy</h3>
        <p>
          All research datasets are de-identified, aggregated at the ZIP-code level or higher, and
          reviewed against our editorial policy before release. Individual family data is never
          sold or shared without explicit opt-in.
        </p>
      </>
    ),
  },
];

function AccordionSection({ tag, title, subtitle, content, isOpen, onToggle }) {
  return (
    <div className={styles.accordionItem}>
      <button
        type="button"
        className={styles.accordionTrigger}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`panel-${title}`}
      >
        <div className={styles.triggerContent}>
          <span className={styles.triggerTag}>{tag}</span>
          <h2 className={styles.triggerTitle}>{title}</h2>
          {subtitle && <p className={styles.triggerSubtitle}>{subtitle}</p>}
        </div>
        <svg
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && (
        <div
          id={`panel-${title}`}
          className={styles.accordionPanel}
          role="region"
        >
          {content}
        </div>
      )}
    </div>
  );
}

export default function PartnersPage() {
  const [openIndex, setOpenIndex] = useState(0);

  const handleToggle = (index) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <>
      <Head>
        <title>Partner With Assistedly.ai | Senior Care &amp; AgeTech Partnerships</title>
        <meta
          name="description"
          content="Partner with Assistedly.ai: senior care operators, AgeTech device makers, healthcare payors, ecosystem partners, and research collaborators. Transparent data, no referral fees."
        />
        <link rel="canonical" href="https://assistedly.ai/partners" />
        <meta property="og:title" content="Partner With Assistedly.ai" />
        <meta
          property="og:description"
          content="Join the neutral-intelligence layer for aging care. Partnerships for operators, AgeTech, payors, and ecosystems."
        />
        <meta property="og:url" content="https://assistedly.ai/partners" />
      </Head>

      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>Partnerships</p>
            <h1>Building the Senior-Care Trust Layer Together</h1>
            <p className={styles.subtitle}>
              Assistedly is the neutral-intelligence layer for the aging-care ecosystem.
              We do not sell placements or referral leads. Instead, we help families make
              better decisions with verified data—and we partner with operators, innovators,
              payors, and communities who share that mission.
            </p>
          </div>
        </section>

        <div className={styles.accordionList}>
          {PARTNER_TYPES.map((partner, index) => (
            <AccordionSection
              key={partner.title}
              tag={partner.tag}
              title={partner.title}
              subtitle={partner.subtitle}
              content={partner.content}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </div>

        <section className={styles.ctaSection}>
          <div className={styles.ctaCard}>
            <h2>Ready to explore a partnership?</h2>
            <p>
              Tell us your organization type and goals. We&apos;ll send you the right
              materials—whether you&apos;re an operator looking to claim your profile, an
              AgeTech founder seeking integrations, or a payor building a care-navigation benefit.
            </p>
            <ConsumerLeadCapture
              page="/partners"
              leadMagnet="partner-inquiry"
              title="Get the partnership overview by email"
              description="Receive our partner deck, integration roadmap, and pricing tiers."
            />
          </div>
        </section>
      </main>
    </>
  );
}
