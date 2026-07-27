import Link from "next/link";
import ConsumerLeadCapture from "./ConsumerLeadCapture";
import growthStyles from "../styles/GrowthMvp.module.css";
import searchStyles from "../styles/Search.module.css";

function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Assistedly.ai",
    url: "https://assistedly.ai",
    description:
      "Consumer intelligence platform for Massachusetts assisted living research, comparison, and AI-assisted transparency.",
  };
}

export default function MassachusettsTownIntentPage({ page }) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Massachusetts",
        item: "https://assistedly.ai/massachusetts",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.townLabel,
        item: `https://assistedly.ai/massachusetts/${page.town}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: page.config.titlePrefix,
        item: `https://assistedly.ai${page.canonicalPath}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
      />
      <div className={searchStyles.searchPage}>
        <section className={searchStyles.searchHeader}>
          <div className="container">
            <h1 style={{ color: "white", marginBottom: "0.75rem" }}>{page.title}</h1>
            <p className={searchStyles.resultsCount}>{page.description}</p>
          </div>
        </section>
        <div className={searchStyles.searchLayout}>
          <aside className={searchStyles.filtersSidebar}>
            <h2 className={searchStyles.filtersTitle}>Research {page.townLabel} with confidence</h2>
            <p className={searchStyles.amenityItem}>{page.config.intro}</p>
            <ConsumerLeadCapture
              page={page.canonicalPath}
              defaultTown={page.townLabel}
              defaultCareNeed={page.pageType === "memory-care" ? "Memory care" : "Assisted living"}
              leadMagnet={page.pageType}
              title={`Get the ${page.townLabel} planning kit`}
              description="Capture the local guide, tour checklist, and comparison prompts by email."
            />
          </aside>
          <section className={searchStyles.resultsArea} aria-label={`${page.townLabel} facility guidance`}>
            {page.faqs.map((faq) => (
              <article key={faq.question} className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>{faq.question}</h2>
                <p className={searchStyles.facilityAddress}>{faq.answer}</p>
              </article>
            ))}
            {page.facilities.map((facility) => (
              <article key={facility.slug} className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>{facility.name}</h2>
                <p className={searchStyles.facilityAddress}>{facility.address}</p>
                <div className={growthStyles.trustGrid} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  <div className={growthStyles.trustMetric}>
                    <span>Pricing</span>
                    <strong>{facility.profile.pricingSummary}</strong>
                    <p>Use this to calibrate budget and add-on fee questions.</p>
                  </div>
                  <div className={growthStyles.trustMetric}>
                    <span>Staffing</span>
                    <strong>{facility.profile.staffingSummary}</strong>
                    <p>Confirm the current team mix directly on tour.</p>
                  </div>
                  <div className={growthStyles.trustMetric}>
                    <span>Compliance</span>
                    <strong>{facility.profile.regulatorySummary}</strong>
                    <p>Ask what changed since the most recent public record.</p>
                  </div>
                </div>
                <div className={searchStyles.cardActions}>
                  <Link href={`/facility/ma/${facility.slug}`} className={searchStyles.viewDetailsBtn}>
                    View facility profile
                  </Link>
                  <Link
                    href={`/compare?facilities=${facility.slug}`}
                    className={searchStyles.viewDetailsBtn}
                    style={{ background: "var(--secondary)" }}
                  >
                    Start comparison
                  </Link>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
