import Head from "next/head";
import LandingBanner from "./LandingBanner";
import styles from "../styles/LuxuryLandingPage.module.css";
import { useTypebotStandardLoader } from "../hooks/useTypebotStandardLoader";
import { TYPEBOT_DEFAULT_VIEWER_HOST } from "../lib/typebotEnv";
import { useTypebotAnalytics } from "../hooks/useTypebotAnalytics";

export default function LuxuryLandingPage({ page }) {
  const typebotAnalytics = useTypebotAnalytics();
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
              <p className={styles.heroProof}>
                Built for families comparing premium care in Massachusetts.
              </p>
            </div>

            <aside className={styles.heroVisualCard} aria-label="Luxury care highlights">
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

        <section className={styles.ctaSection}>
          <div className={styles.ctaInner}>
            <h2 className={styles.ctaTitle}>{ctaTitle}</h2>
            <p className={styles.ctaSubtitle}>{sections.cta.subtitle}</p>
          </div>
        </section>
      </div>
    </>
  );
}
