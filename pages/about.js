import Head from 'next/head'
import styles from '../styles/Home.module.css'

export default function About() {
  return (
    <>
      <Head>
        <title>About - AI Assist Living Finder</title>
        <meta
          name="description"
          content="AI Assist Living Finder helps Massachusetts families compare assisted living options with transparent data and AI-assisted matching."
        />
      </Head>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>About AI Assist Living Finder</h1>
          <p className={styles.heroSubtitle}>
            We are building a Massachusetts-first assisted living search experience with clear,
            practical information for families and caregivers.
          </p>
        </div>
      </section>

      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>Our Approach</h2>
        <p className={styles.sectionSubtitle}>
          We focus on transparent comparisons, better filtering, and faster decisions.
        </p>
        <div className={styles.stepsGrid}>
          <div className={styles.stepCard}>
            <div className={styles.stepIcon}>Data</div>
            <h3 className={styles.stepTitle}>Structured Facility Data</h3>
            <p className={styles.stepDesc}>
              We organize facility information into clear, comparable fields so families can
              evaluate options quickly.
            </p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepIcon}>Match</div>
            <h3 className={styles.stepTitle}>AI-Assisted Discovery</h3>
            <p className={styles.stepDesc}>
              Search and recommendation flows are designed to surface relevant communities based on
              care needs, location, and priorities.
            </p>
          </div>
          <div className={styles.stepCard}>
            <div className={styles.stepIcon}>Trust</div>
            <h3 className={styles.stepTitle}>Decision Confidence</h3>
            <p className={styles.stepDesc}>
              We aim to reduce confusion and help families choose facilities with confidence.
            </p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBottom}>
          <p className={styles.footerCopyright}>© {new Date().getFullYear()} AI Assist Living Finder</p>
        </div>
      </footer>
    </>
  )
}
