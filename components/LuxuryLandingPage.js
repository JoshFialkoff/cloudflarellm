import Head from "next/head";
import Link from "next/link";
import styles from "../styles/LuxuryLandingPage.module.css";

export default function LuxuryLandingPage({ page }) {
  const {
    title_tag,
    meta_description,
    h1,
    hero_subtitle,
    hero_cta_text,
    hero_cta_url,
    body_intro,
    sections,
    primary_keyword,
    secondary_keywords = [],
    content_theme,
  } = page;

  return (
    <>
      <Head>
        <title>{title_tag}</title>
        <meta name="description" content={meta_description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        <header className={styles.navbar}>
          <div className="container">
            <nav className={styles.navInner} aria-label="Main">
              <Link href="/" className={styles.brand}>
                AI Assist Living Finder
              </Link>
              <Link href={hero_cta_url} className={styles.navCta}>
                Compare Facilities
              </Link>
            </nav>
          </div>
        </header>

        <section className={styles.hero}>
          <div className="container">
            <p className={styles.eyebrow}>Massachusetts Assisted Living Search</p>
            <h1 className={styles.heroTitle}>{h1}</h1>
            <p className={styles.heroSubtitle}>{hero_subtitle}</p>
            <p className={styles.intro}>{body_intro}</p>
            <Link href={hero_cta_url} className={styles.primaryButton}>
              {hero_cta_text}
            </Link>
          </div>
        </section>

        <section className={styles.section}>
          <div className="container">
            <h2 className={styles.sectionTitle}>{sections.how_it_works.title}</h2>
            <p className={styles.sectionBody}>{sections.how_it_works.body}</p>
          </div>
        </section>

        <section className={styles.sectionAlt}>
          <div className="container">
            <h2 className={styles.sectionTitle}>{sections.trust.title}</h2>
            <p className={styles.sectionBody}>{sections.trust.body}</p>
            <p className={styles.seoText}>
              We help daughters and families compare local care options with
              Massachusetts-focused insights, so they can make a confident choice.
            </p>
          </div>
        </section>

        <section className={styles.statsBar} aria-label="Page highlights">
          <div className="container">
            <div className={styles.statsGrid}>
              {sections.stats.map((stat) => (
                <article key={`${stat.label}-${stat.value}`} className={styles.statCard}>
                  <p className={styles.statValue}>{stat.value}</p>
                  <p className={styles.statLabel}>{stat.label}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <div className="container">
            <h2 className={styles.sectionTitle}>{sections.cta.title}</h2>
            <p className={styles.sectionBody}>{sections.cta.subtitle}</p>
            <Link href={sections.cta.button_url} className={styles.primaryButton}>
              {sections.cta.button_text}
            </Link>
          </div>
        </section>

        <footer className={styles.footer}>
          <div className="container">
            <p className={styles.footerText}>
              Primary focus: <strong>{primary_keyword}</strong>
            </p>
            <p className={styles.footerText}>
              Related terms: {secondary_keywords.join(", ")}
            </p>
            <p className={styles.footerTheme}>{content_theme}</p>
          </div>
        </footer>
      </div>
    </>
  );
}
