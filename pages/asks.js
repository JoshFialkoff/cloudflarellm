import { useState } from 'react'
import Head from 'next/head'
import styles from '../styles/Home.module.css'
import HomeFreeTextWizard from '../components/HomeFreeTextWizard'

export default function AsksPage() {
  const [engaged, setEngaged] = useState(true)

  return (
    <>
      <Head>
        <title>Assistedly — Ask Our AI About Assisted Living</title>
        <meta name="description" content="Ask our private, unbiased AI anything about assisted living and memory care in Massachusetts." />
      </Head>
      <section className={`${styles.hero} ${styles.heroAssistantEngaged}`} style={{ minHeight: 'calc(100dvh - 80px)' }}>
        <div className={styles.heroInner} style={{ gridTemplateColumns: '1fr', gridTemplateAreas: '"heroVideo"' }}>
          <div className={styles.heroVideoSlot} style={{ justifySelf: 'stretch', maxWidth: 'none' }}>
            <section
              className={`${styles.typebotEmbed} ${styles.heroTypebotAside}`}
              aria-label="AI assistant chat"
              data-homepage-layout="asks_page"
              data-variant="free_text_entry"
            >
              <div className={styles.heroTypebotFrame}>
                <HomeFreeTextWizard
                  homepage_layout="asks_page"
                  onEngagedChange={setEngaged}
                />
              </div>
            </section>
          </div>
        </div>
      </section>
    </>
  )
}
