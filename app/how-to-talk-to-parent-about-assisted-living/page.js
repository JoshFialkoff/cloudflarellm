import Link from 'next/link'
import ConsumerLeadCapture from '../../components/ConsumerLeadCapture'
import styles from '../../styles/ContentGuide.module.css'

const title = 'How to Talk to a Parent About Assisted Living'
const description =
  'Conversation scripts, timing tips, and sibling-alignment strategies for families starting the assisted living conversation with an aging parent in Massachusetts.'

export const metadata = {
  title,
  description,
  alternates: { canonical: '/how-to-talk-to-parent-about-assisted-living' },
  openGraph: {
    title,
    description,
    url: '/how-to-talk-to-parent-about-assisted-living',
    type: 'article',
  },
}

export default function TalkToParentPage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://assistedly.ai/' },
      { '@type': 'ListItem', position: 2, name: 'Talking to a Parent', item: 'https://assistedly.ai/how-to-talk-to-parent-about-assisted-living' },
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://assistedly.ai/how-to-talk-to-parent-about-assisted-living' },
  }

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Family conversation guide</p>
        <h1>{title}</h1>
        <p className={styles.subtitle}>
          The hardest part of the assisted living journey is often the conversation. Here is how to start
          it, keep it productive, and help your parent feel heard instead of managed.
        </p>
      </section>

      <div className={styles.container}>
        <div className={styles.splitLayout}>
          <article className={styles.article}>
            <section>
              <h2>Why this conversation is so hard</h2>
              <p>
                For adult children, the conversation feels like a reversal of roles. You are asking the
                person who raised you to accept help. For the parent, it can feel like the beginning of
                losing autonomy — the home they worked for, the independence they value, the identity
                they have built over decades.
              </p>
              <p>
                Add guilt, sibling disagreement, and financial stress, and it is no wonder families delay
                this conversation until a crisis forces it. But starting early — before an emergency —
                gives everyone more options, more time, and more dignity.
              </p>
            </section>

            <section>
              <h2>When to start the conversation</h2>
              <p>
                The best time is <strong>before a crisis</strong>. Look for these early signals:
              </p>
              <ul>
                <li>
                  <strong>Physical:</strong> Frequent falls, missed medications, difficulty with stairs,
                  or unpaid bills piling up.
                </li>
                <li>
                  <strong>Social:</strong> Withdrawal from friends and activities, loneliness, or
                  forgetting to return calls.
                </li>
                <li>
                  <strong>Cognitive:</strong> Getting lost in familiar places, repeating questions, or
                  confusion about time and appointments.
                </li>
                <li>
                  <strong>Household:</strong> Spoiled food, declining cleanliness, or the car showing
                  unexplained dents.
                </li>
              </ul>
              <p>
                If you notice one or two of these, it is time to open the conversation gently. If you
                notice four or more, it is time to act with urgency while still including your parent in
                the decision.
              </p>
            </section>

            <section>
              <h2>What to say — and what not to say</h2>
              <h3>Do say:</h3>
              <ul>
                <li>“I want you to be safe and happy. I am not trying to take anything away from you.”</li>
                <li>“Let us look at this together, not as a done decision.”</li>
                <li>“What matters most to you in a place to live? Let us find options that match that.”</li>
                <li>“I worry when you are alone at home. Can we talk about what would help both of us feel better?”</li>
              </ul>
              <h3>Do not say:</h3>
              <ul>
                <li>“You cannot take care of yourself anymore.”</li>
                <li>“The doctor says you have to move.”</li>
                <li>“This house is too much for you. It is time to sell.”</li>
                <li>“You are being stubborn.”</li>
              </ul>
              <p>
                The difference is framing. Focus on <em>adding</em> support and safety, not subtracting
                independence.
              </p>
            </section>

            <section>
              <h2>A sample conversation script</h2>
              <p>
                This script is designed for a first conversation. Adapt it to your family’s tone and
                history.
              </p>
              <p>
                <em>
                  “Mom, I have been thinking about how much work this house is, and how quiet it gets
                  during the week. I know you love it here, and I am not suggesting we sell it
                  tomorrow. But I want us to look at what life could look like if you had help with
                  meals, someone to check in on you, and more people around. Would you be open to
                  touring one place with me — just to see — so we know what is out there?”
                </em>
              </p>
              <p>
                The goal of the first conversation is not agreement. It is planting a seed and showing
                that you are on their side.
              </p>
            </section>

            <section>
              <h2>If your parent resists</h2>
              <p>Resistance is normal. Here is how to respond to common objections:</p>
              <ul>
                <li>
                  <strong>“I am not ready.”</strong> → “I understand. We do not have to decide today.
                  Let us just gather information so when you are ready, we know our options.”
                </li>
                <li>
                  <strong>“I do not want to leave my home.”</strong> → “I know. That is why we are
                  looking at this early, not in an emergency. What if we found a place that felt like
                  home?”
                </li>
                <li>
                  <strong>“Your sibling said I should stay here.”</strong> → “I want all of us on the
                  same page. Let us schedule a family call so everyone can share concerns and we can
                  make a plan together.”
                </li>
                <li>
                  <strong>“I cannot afford it.”</strong> → “There are programs that lower the cost
                  significantly. Let us talk to a financial advisor or Medicaid planner before we rule
                  it out.”
                </li>
              </ul>
            </section>

            <section>
              <h2>Getting siblings aligned</h2>
              <p>
                Sibling disagreement is one of the biggest obstacles to a smooth transition. One sibling
                may live nearby and see the daily decline; another may live far away and see only holiday
                visits. One may favor assisted living; another may push for in-home care.
              </p>
              <p>Here is how to align before talking to your parent:</p>
              <ol>
                <li>
                  <strong>Share observations, not conclusions.</strong> “I noticed Mom missed three
                  medication doses last month” is different from “Mom needs assisted living now.”
                </li>
                <li>
                  <strong>Assign roles.</strong> One sibling researches facilities, another handles
                  finances, another manages medical records. This prevents anyone from feeling
                  steamrolled or excluded.
                </li>
                <li>
                  <strong>Use data.</strong> Share safety scores, cost estimates, and program eligibility
                  from Assistedly.ai so decisions are grounded in facts, not opinions.
                </li>
                <li>
                  <strong>Set a timeline.</strong> Agree on a decision date. Open-ended conversations
                  drift and create anxiety.
                </li>
              </ol>
            </section>

            <section>
              <h2>Next steps after the conversation</h2>
              <ol>
                <li>
                  Schedule one tour at a time. Do not overwhelm your parent with five back-to-back
                  visits.
                </li>
                <li>
                  Visit at different times of day — not just during the polished 10 AM tour.
                </li>
                <li>
                  Use our <Link href="/how-to-choose-assisted-living-massachusetts">choosing guide</Link>{' '}
                  and <Link href="/massachusetts-assisted-living-costs">cost guide</Link> to prepare
                  questions and budget scenarios before each tour.
                </li>
                <li>
                  Involve your parent’s doctor if memory or medical concerns are central to the decision.
                </li>
                <li>
                  Revisit the conversation regularly. Preferences change, and continued dialogue builds
                  trust.
                </li>
              </ol>
            </section>

            <div className={styles.ctaBox}>
              <h3>Get the family conversation toolkit</h3>
              <p>
                Includes a full conversation script, sibling-alignment worksheet, and a guide for
                handling resistance — sent to your email.
              </p>
              <ConsumerLeadCapture
                page="/how-to-talk-to-parent-about-assisted-living"
                leadMagnet="family-conversation-toolkit"
                title="Get the family conversation toolkit"
                description="Email yourself the conversation script, sibling worksheet, and resistance guide."
              />
            </div>

            <section>
              <h2>Related guides</h2>
              <div className={styles.relatedGrid}>
                <Link href="/massachusetts-assisted-living-guide" className={styles.relatedCard}>
                  <strong>Complete Massachusetts Guide</strong>
                  <span>Costs, payment options, safety scores, and next steps.</span>
                </Link>
                <Link href="/how-to-choose-assisted-living-massachusetts" className={styles.relatedCard}>
                  <strong>How to Choose Without Getting Sold To</strong>
                  <span>Red flags, tour questions, and the broker problem.</span>
                </Link>
                <Link href="/massachusetts-assisted-living-costs" className={styles.relatedCard}>
                  <strong>Massachusetts Cost Guide</strong>
                  <span>Price ranges and programs that lower monthly fees.</span>
                </Link>
                <Link href="/memory-care-vs-assisted-living-massachusetts" className={styles.relatedCard}>
                  <strong>Memory Care vs Assisted Living</strong>
                  <span>When memory care is the better choice for a parent with dementia.</span>
                </Link>
              </div>
            </section>
          </article>

          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <h4>Start your free match</h4>
              <p>Answer 8 questions and get a personalized shortlist in under 2 minutes.</p>
              <Link href="/">Start matching</Link>
            </div>
            <div className={styles.sidebarCard}>
              <h4>Tour checklist</h4>
              <p>20 questions to ask on every assisted living tour.</p>
              <Link href="/how-to-choose-assisted-living-massachusetts">View checklist</Link>
            </div>
            <div className={styles.sidebarCard}>
              <h4>Cost calculator</h4>
              <p>Model monthly costs by care level and insurance.</p>
              <Link href="/cost-calculator">Calculate costs</Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
