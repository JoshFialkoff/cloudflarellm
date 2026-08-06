import { useEffect, useCallback } from "react";
import Head from "next/head";
import styles from "../styles/B2BLandingPage.module.css";

function capturePostHog(event, props = {}) {
  try {
    const { posthog } = require("../lib/posthogClient");
    if (posthog?.capture) posthog.capture(event, props);
  } catch {
    /* analytics non-blocking */
  }
}

export default function CompaniesLandingPage() {
  useEffect(() => {
    capturePostHog("b2b_companies_page_viewed", {
      page: "/companies",
      source: window?.location?.search || "direct",
    });
  }, []);

  const handleCtaClick = useCallback(() => {
    capturePostHog("b2b_companies_cta_clicked", {
      cta: "call_6175003450",
      location: "cta_section",
    });
  }, []);

  const handleDataSourceClick = useCallback((sourceName) => {
    capturePostHog("b2b_companies_data_source_clicked", {
      source: sourceName,
    });
  }, []);

  return (
    <>
      <Head>
        <title>Assistedly for Companies | Data-Driven Insights for Assisted Living Communities</title>
        <meta
          name="description"
          content="Stop selling hope. Start proving value. Assistedly provides verified facility intelligence and AI-powered matching to help your community fill empty beds and reduce churn."
        />
      </Head>

      <div className={styles.page}>
        {/* Header */}
        <header className={styles.header}></header>

        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <h1 className={styles.heroTitle}>
              Stop Selling Hope. <br />
              Start Proving Value.
            </h1>
            <p className={styles.heroSubtitle}>
              Capture and convert more qualified move-ins. Assistedly uses verified data and AI to match your community with families who actually fit—before they even call.
            </p>
          </div>
        </section>

        {/* Opportunity Section */}
        <section className={styles.opportunity}>
          <div className={styles.opportunityInner}>
            <h2 className={styles.opportunityTitle}>The Occupancy Gap Is Costing You</h2>
            <div className={styles.opportunityTable}>
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Industry Average</th>
                    <th>Your Opportunity</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Occupancy Rate</td>
                    <td>68-72%</td>
                    <td>+13-17% potential</td>
                  </tr>
                  <tr>
                    <td>Empty Beds</td>
                    <td>~30% of typical 50-bed community</td>
                    <td>+$135K-220K monthly revenue</td>
                  </tr>
                  <tr>
                    <td>Gen X Research</td>
                    <td>61% online before tour</td>
                    <td>Become trusted resource</td>
                  </tr>
                  <tr>
                    <td>Turnover Rate</td>
                    <td>30% average</td>
                    <td>40% longer stays possible</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className={styles.statHighlight}>
              <strong className={styles.statHighlightTitle}>Every empty bed costs $4,500-5,500/month</strong>
              <p>12 empty beds = $197K/month lost revenue</p>
            </div>
          </div>
        </section>

        {/* The Difference Section */}
        <section className={styles.difference}>
          <div className={styles.differenceInner}>
            <h2 className={styles.differenceTitle}>How Assistedly is Different</h2>
            <div className={styles.differenceColumn}>
              <h3 className={styles.differenceSubtitle}>Before Assistedly.ai</h3>
              <ul className={styles.differenceList}>
                <li>Families compare marketing instead of facts</li>
                <li>Sales teams guess why prospects decline</li>
                <li>Community matches based on proximity, not care needs</li>
                <li>High churn because the tour looked good</li>
              </ul>
            </div>
            <div className={styles.differenceColumn}>
              <h3 className={styles.differenceSubtitleSuccess}>After Assistedly.ai</h3>
              <ul className={styles.differenceListSuccess}>
                <li>Verified, structured data families actually trust</li>
                <li>Transparent scoring explains why families choose you</li>
                <li>Competitive intelligence shows where you win/lose</li>
                <li>40%+ longer stays from better initial matches</li>
              </ul>
            </div>
          </div>
        </section>

        {/* The Data Difference */}
        <section className={styles.dataDifference}>
          <div className={styles.dataDifferenceInner}>
            <h3 className={styles.dataDifferenceTitle}>The Data Difference</h3>
            <p className={styles.dataDifferenceText}>
              Traditional platforms profit when families move to competing communities—creating conflicts of interest.
            </p>
            <p className={styles.dataDifferenceText}>
              Assistedly.ai profits when families find the right fit—even if it&apos;s not your community.
            </p>
          </div>
        </section>

        {/* Data Sources */}
        <section className={styles.dataSources}>
          <div className={styles.dataSourcesInner}>
            <p className={styles.dataSourcesTitle}>Data Sources</p>
            <ul className={styles.dataSourcesList}>
              <li>
                <a
                  href="https://www.nic.org/fundamentals/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleDataSourceClick("nic_map")}
                >
                  NIC MAP Fundamentals — Occupancy &amp; Market Data
                </a>
              </li>
              <li>
                <a
                  href="https://www.argentum.org/advocacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleDataSourceClick("argentum")}
                >
                  Argentum Senior Living Workforce Report — Turnover &amp; Benchmarks
                </a>
              </li>
              <li>
                <a
                  href="https://www.aarp.org/research/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleDataSourceClick("aarp")}
                >
                  AARP Research — Family Decision-Making Behavior
                </a>
              </li>
              <li>
                <a
                  href="https://www.genworth.com/aging-and-you/finances/cost-of-care.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleDataSourceClick("genworth")}
                >
                  Genworth Cost of Care Survey — Monthly Cost Data
                </a>
              </li>
            </ul>
          </div>
        </section>

        {/* Onboarding Tool Preview */}
        <section className={styles.onboarding}>
          <div className={styles.onboardingInner}>
            <h2 className={styles.onboardingTitle}>Streamlined Family Onboarding</h2>
            <p className={styles.onboardingText}>
              Stop losing families who visit but never move in. The Assistedly AI intake wizard captures care needs, budget, and lifestyle preferences upfront—so your team qualifies every prospect before the first call.
            </p>
            <ul className={styles.onboardingList}>
              <li>AI-powered intake captures care needs, lifestyle preferences, and budget range</li>
              <li>Generates a structured family profile your team can review before outreach</li>
              <li>Identifies best-fit prospects automatically so your team prioritizes the right leads</li>
              <li>Reduces mismatched tours and accelerates move-in decisions</li>
            </ul>
          </div>
        </section>

        {/* CRM Integration */}
        <section className={styles.crm}>
          <div className={styles.crmInner}>
            <h2 className={styles.crmTitle}>Works With Your CRM—or Becomes Your CRM</h2>
            <p className={styles.crmText}>
              Already using Salesforce, HubSpot, or another CRM? Assistedly integrates seamlessly to enrich leads with verified data. Don&apos;t have a CRM yet? Assistedly functions as your lightweight CRM purpose-built for senior living sales.
            </p>
            <div className={styles.crmGrid}>
              <div className={styles.crmColumn}>
                <h3 className={styles.crmSubtitle}>Use With Your Existing CRM</h3>
                <ul className={styles.crmList}>
                  <li>Push enriched lead data to Salesforce, HubSpot, or your system of choice</li>
                  <li>Match Assistedly profiles to existing CRM contacts automatically</li>
                  <li>Feed verified facility intelligence back into your sales workflow</li>
                </ul>
              </div>
              <div className={styles.crmColumn}>
                <h3 className={styles.crmSubtitle}>Use Assistedly as Your CRM</h3>
                <ul className={styles.crmList}>
                  <li>Track every family from first inquiry through move-in</li>
                  <li>Log calls, tours, and follow-ups in one place</li>
                  <li>See exactly which data points influenced each family&apos;s decision</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.cta}>
          <div className={styles.ctaInner}>
            <h2 className={styles.ctaTitle}>See Why Families Choose Your Competitors—And How to Win Them Back</h2>
            <div className={styles.ctaButtons}>
              <a
                href="tel:617-500-3450"
                className={styles.ctaButtonPrimary}
                onClick={handleCtaClick}
              >
                Call 617-500-3450 for a 15-minute demo
              </a>
            </div>
            <p className={styles.ctaFinePrint}>
              No credit card required. No sales pitch. Just data transparency.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerInner}>
            <p className={styles.footerText}>
              Assistedly, Inc. | Building the Trusted Intelligence Layer for Assisted Living
            </p>
            <p className={styles.footerContact}>
              617-500-3450
            </p>
            <p className={styles.footerQuote}>
              Better matches increase occupancy better than shinier brochures.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
