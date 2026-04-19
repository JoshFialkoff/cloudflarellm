import Head from "next/head";
import Link from "next/link";
import LandingBanner from "./LandingBanner";
import styles from "../styles/LuxuryLandingPage.module.css";
import { useTypebotStandardLoader } from "../hooks/useTypebotStandardLoader";
import { TYPEBOT_DEFAULT_VIEWER_HOST } from "../lib/typebotEnv";
import { useTypebotAnalytics } from "../hooks/useTypebotAnalytics";
import { HOMEPAGE_LAYOUT } from "../lib/landingAnalytics";

export default function LuxuryLandingPage({ page }) {
  const typebotAnalytics = useTypebotAnalytics({
    homepage_layout: HOMEPAGE_LAYOUT.luxury_landing,
  });
  const { typebotSectionRef, TypebotStandard } = useTypebotStandardLoader();
  const TYPEBOT_PUBLIC_ID =
    process.env.NEXT_PUBLIC_TYPEBOT_ID || "1-31-26-working-thio-ass-living-k3253lu";
  const TYPEBOT_API_HOST = process.env.NEXT_PUBLIC_TYPEBOT_API_HOST || TYPEBOT_DEFAULT_VIEWER_HOST;

  const handleTypebotInit = () => {
    typebotAnalytics.onInit?.();
  };

  const handleTypebotNewInputBlock = (input) => {
    typebotAnalytics.onNewInputBlock?.(input);
  };

  const {
    title_tag,
    meta_description,
    h1,
    hero_subtitle,
    body_intro,
    sections,
    town,
    hero_cta_text,
    hero_cta_url,
  } = page;

  const townLabel = town ? town.charAt(0).toUpperCase() + town.slice(1) : "";
  const heroTitle = townLabel ? `Luxury Assisted Living near ${townLabel}` : h1;
  const ctaTitle = townLabel
    ? `Find Luxury Care near ${townLabel}`
    : sections.cta.title;

  const trustCards = [
    {
      icon: "🔍",
      title: "Compliance Tracking",
      body: sections.trust.body,
    },
    {
      icon: "🤖",
      title: "AI-Powered Matching",
      body: "Our matching engine compares care needs, pricing, and amenities to narrow the best luxury options.",
    },
    {
      icon: "📊",
      title: "Transparent Data",
      body: "Compare communities side-by-side with clear pricing context and local Massachusetts insights.",
    },
    {
      icon: "📍",
      title: "Town-Specific Guidance",
      body: `Focused support for families searching near ${townLabel || "your town"}.`,
    },
  ];

  return (
    <>
      <Head>
        <title>{title_tag}</title>
        <meta name="description" content={meta_description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content={title_tag} />
        <meta property="og:description" content={meta_description} />
        <meta property="og:type" content="website" />
      </Head>

      <LandingBanner />

      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroContent}>
              <p className={styles.eyebrow}>Massachusetts Assisted Living Search</p>
              <h1 className={styles.heroTitle}>{heroTitle}</h1>
              <p className={styles.heroSubtitle}>{hero_subtitle}</p>
              <p className={styles.intro}>{body_intro}</p>
              <div className={styles.heroCtas}>
                <a href="#assistant" className={styles.heroPrimaryCta}>
                  Start your free match
                </a>
                {hero_cta_url ? (
                  <Link href={hero_cta_url} className={styles.heroSecondaryCta}>
                    {hero_cta_text || "Browse options"}
                  </Link>
                ) : null}
              </div>
              <ul className={styles.heroBullets} aria-label="Why families use this page">
                <li>No account required</li>
                <li>Massachusetts licensing and compliance context</li>
                <li>About two minutes to complete</li>
              </ul>
            </div>

            <aside className={styles.heroVisualCard} aria-label="Luxury care highlights">
              <p className={styles.typebotCardLabel}>Guided questions — personalized matches</p>
              <section
                ref={typebotSectionRef}
                className={styles.heroKeywords}
                id="assistant"
                aria-label="AI assistant chat"
              >
                <div className={styles.heroTypebotFrame}>
                  {TypebotStandard ? (
                    <div className={styles.typebotFill}>
                      <TypebotStandard
                        typebot={TYPEBOT_PUBLIC_ID}
                        apiHost={TYPEBOT_API_HOST}
                        style={{ display: "block", width: "100%", height: "100%", border: 0 }}
                        onInit={handleTypebotInit}
                        onNewInputBlock={handleTypebotNewInputBlock}
                        onAnswer={typebotAnalytics.onAnswer}
                      />
                    </div>
                  ) : (
                    <div className={styles.typebotLoadingRoot} role="status" aria-live="polite">
                      <span className={styles.typebotLoadingSpinner} aria-hidden />
                      Loading assistant...
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </section>

        <section className={styles.section} id="how-it-works">
          <div className="container">
            <h2 className={styles.sectionTitle}>How It Works</h2>
            <p className={styles.sectionSubtitle}>
              Finding luxury assisted living in Massachusetts is faster with a
              focused local process.
            </p>
            <div className={styles.stepsGrid}>
              <article className={styles.stepCard}>
                <div className={styles.stepIcon}>📋</div>
                <h3 className={styles.stepTitle}>Tell Us Your Needs</h3>
                <p className={styles.stepDesc}>{sections.how_it_works.body}</p>
              </article>
              <article className={styles.stepCard}>
                <div className={styles.stepIcon}>🤖</div>
                <h3 className={styles.stepTitle}>AI-Powered Matching</h3>
                <p className={styles.stepDesc}>
                  We identify luxury communities that fit your location, care
                  level, and budget preferences.
                </p>
              </article>
              <article className={styles.stepCard}>
                <div className={styles.stepIcon}>✅</div>
                <h3 className={styles.stepTitle}>Choose Confidently</h3>
                <p className={styles.stepDesc}>
                  Compare options with transparent context before contacting
                  your top choices.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.sectionAlt}>
          <div className="container">
            <h2 className={styles.sectionTitle}>{sections.trust.title}</h2>
            <p className={styles.sectionSubtitle}>
              We provide Massachusetts-focused insights families can trust.
            </p>
            <div className={styles.trustGrid}>
              {trustCards.map((card) => (
                <article key={card.title} className={styles.trustCard}>
                  <div className={styles.trustCardIcon}>{card.icon}</div>
                  <h3 className={styles.trustCardTitle}>{card.title}</h3>
                  <p className={styles.trustCardDesc}>{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.statsBar} aria-label="Page highlights">
          {sections.stats.map((stat) => (
            <article key={`${stat.label}-${stat.value}`} className={styles.statItem}>
              <p className={styles.statValue}>{stat.value}</p>
              <p className={styles.statLabel}>{stat.label}</p>
            </article>
          ))}
        </section>

        <section className={styles.ctaSection} aria-labelledby="luxury-cta-heading">
          <div className={styles.ctaInner}>
            <h2 id="luxury-cta-heading" className={styles.ctaTitle}>
              {ctaTitle}
            </h2>
            <p className={styles.ctaSubtitle}>{sections.cta.subtitle}</p>
            <div className={styles.ctaActions}>
              <a href="#assistant" className={styles.ctaPrimaryBtn}>
                Start your free match
              </a>
              {sections.cta.button_url ? (
                <Link href={sections.cta.button_url} className={styles.ctaSecondaryBtn}>
                  {sections.cta.button_text || "Explore options"}
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <nav className={styles.stickyMatchBar} aria-label="Start match">
          <a href="#assistant" className={styles.stickyMatchBtn}>
            Start free match
          </a>
        </nav>
      </div>
    </>
  );
}
