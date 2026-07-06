import Head from "next/head";
import Link from "next/link";
import AuthCapture from "../components/AuthCapture";
import ResultsPageAnalytics from "../components/ResultsPageAnalytics";
import ResultsSnapshotSection from "../components/ResultsSnapshotSection";
import WizardFacilityMatchList, { snapshotFacilitiesToMatchItems } from "../components/WizardFacilityMatchList";
import { getSession } from "../lib/serverAuth";
import styles from "../styles/Tools.module.css";
import growthStyles from "../styles/GrowthMvp.module.css";
import pageStyles from "../styles/ResultsPage.module.css";
import StickySummary from "../components/StickySummary";
import Compare from "../components/Compare";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function CalculatorSnapshot({ snapshot }) {
  const inputs = snapshot.inputs || {};
  const results = snapshot.results || {};
  const addOns = [
    inputs.medicationManagement ? "Medication management" : "",
    inputs.incontinenceSupport ? "Incontinence support" : "",
    inputs.mobilitySupport ? "Mobility / transfer support" : "",
  ].filter(Boolean);

  return (
    <div className={styles.resultDataPanel}>
      <div className={styles.resultDataHeader}>
        <p className={styles.resultLabel}>Your saved estimate</p>
        <h2>{snapshot.title}</h2>
        {snapshot.createdAt ? <small>Saved {formatDate(snapshot.createdAt)}</small> : null}
      </div>

      <dl className={styles.resultDataGrid}>
        <div>
          <dt>Care setting</dt>
          <dd>{inputs.careTypeLabel}</dd>
        </div>
        <div>
          <dt>Region</dt>
          <dd>{inputs.regionLabel}</dd>
        </div>
        <div>
          <dt>Monthly budget</dt>
          <dd>{currency.format(inputs.monthlyBudget || 0)}</dd>
        </div>
        <div>
          <dt>Estimated monthly range</dt>
          <dd>{currency.format(results.estimateLow || 0)} - {currency.format(results.estimateHigh || 0)}</dd>
        </div>
        <div>
          <dt>Budget fit</dt>
          <dd>
            {results.withinBudget
              ? "Budget may fit the lower end"
              : `${currency.format(results.budgetGap || 0)} above budget at the low end`}
          </dd>
        </div>
        <div>
          <dt>Included add-ons</dt>
          <dd>{addOns.length ? addOns.join(", ") : "None selected"}</dd>
        </div>
      </dl>

      <div className={styles.resultDataActions}>
        <Link href="/budget" className={styles.secondaryCta}>Update estimate</Link>
        <Link href="/?typebot_entry=cost_calculator#assistant" className={styles.primaryCta}>Find matching facilities</Link>
      </div>
    </div>
  );
}

function WizardSearchSnapshot({ snapshot }) {
  const inputs = snapshot.inputs || {};
  const rankedFacilities = snapshot.results?.rankedFacilities || [];
  const searchContext = {
    careType: inputs.careType,
    monthlyBudget: inputs.monthlyBudget,
    zipCode: inputs.zip,
    location: inputs.location,
    urgency: inputs.urgency,
  };

  return (
    <div className={styles.resultDataPanel}>
      <div className={styles.resultDataHeader}>
        <p className={styles.resultLabel}>Your saved matches</p>
        <h2>{snapshot.title}</h2>
        {snapshot.createdAt ? <small>Saved {formatDate(snapshot.createdAt)}</small> : null}
      </div>

      <div className={pageStyles.resultsContainer}>
        <div className={pageStyles.mainContent}>
          <WizardFacilityMatchList
            intro={inputs.summaryIntro || (inputs.location ? `Search area: ${inputs.location}` : "")}
            items={snapshotFacilitiesToMatchItems(rankedFacilities)}
            searchContext={searchContext}
          />
        </div>
        <div className={pageStyles.sidebar}>
          <StickySummary searchContext={searchContext} />
          <Compare facilities={snapshotFacilitiesToMatchItems(rankedFacilities)} />
        </div>
      </div>

      <div className={styles.resultDataActions}>
        <Link href="/#assistant" className={styles.primaryCta}>Start a new search</Link>
      </div>
    </div>
  );
}

function SafestSnapshot({ snapshot }) {
  const inputs = snapshot.inputs || {};
  const rankedFacilities = snapshot.results?.rankedFacilities || [];

  return (
    <div className={styles.resultDataPanel}>
      <div className={styles.resultDataHeader}>
        <p className={styles.resultLabel}>Your saved comparison</p>
        <h2>{snapshot.title}</h2>
        <p>Search area: {inputs.city || inputs.location || inputs.zip}</p>
        {snapshot.createdAt ? <small>Saved {formatDate(snapshot.createdAt)}</small> : null}
      </div>

      <div className={styles.savedFacilityList}>
        {rankedFacilities.map((facility) => (
          <article key={facility.slug || facility.name} className={styles.savedFacilityCard}>
            <div>
              <h3>{facility.name}</h3>
              <p>{facility.address}</p>
              <small>{facility.careTypes?.join(", ")}</small>
            </div>
            <div>
              <strong>{facility.safetyScore}/100</strong>
              <span>{currency.format(facility.monthlyMin || 0)} - {currency.format(facility.monthlyMax || 0)}/mo</span>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.resultDataActions}>
        <Link href="/find-safest" className={styles.secondaryCta}>Run another comparison</Link>
      </div>
    </div>
  );
}

function ResultSnapshot({ snapshot }) {
  if (!snapshot) return null;
  if (snapshot.kind === "cost_calculator") return <CalculatorSnapshot snapshot={snapshot} />;
  if (snapshot.kind === "wizard_search") return <WizardSearchSnapshot snapshot={snapshot} />;
  if (snapshot.kind === "safest_facilities") return <SafestSnapshot snapshot={snapshot} />;
  return null;
}

export default function ResultsPage({ authenticated, email, resultSnapshot }) {
  return (
    <>
      <Head>
        <title>Your Assistedly Results | assistedly.AI</title>
        <meta name="description" content="Sign in with a passwordless magic link to view the inputs and data used for your assisted living results." />
      </Head>
      <main className={styles.toolPage}>
        <ResultsPageAnalytics
          authenticated={authenticated}
          resultSnapshot={resultSnapshot}
        />
        <section className={styles.hero}>
          <p className={styles.kicker}>Passwordless account</p>
          <h1>Your Assistedly results data</h1>
          <p className={styles.heroCopy}>
            Use a magic link to see the specific inputs, estimates, and comparison data used for your results.
          </p>
        </section>

        <section className={styles.accountShell}>
          {authenticated ? (
            <>
              <div className={styles.accountHeader}>
                <div>
                  <p className={styles.resultLabel}>Signed in</p>
                  <h2>{email}</h2>
                </div>
                <Link href="/budget" className={styles.secondaryCta}>Create new results</Link>
              </div>

              {resultSnapshot ? (
                <ResultSnapshot snapshot={resultSnapshot} />
              ) : (
                <ResultsSnapshotSection
                  authenticated={authenticated}
                  serverSnapshot={resultSnapshot}
                />
              )}
            </>
          ) : (
            <div className={growthStyles.gateCard}>
              <h2>Sign in or register with a magic link.</h2>
              <AuthCapture
                authSurface="results_page"
                formId="results_magic_link"
                reason="Enter your email and we will send a passwordless link to open your Assistedly results page."
                redirectTo="/results"
                buttonLabel="Send my results link"
              />
            </div>
          )}
        </section>
      </main>
    </>
  );
}

export function getServerSideProps({ req }) {
  const session = getSession(req);
  return {
    props: {
      authenticated: Boolean(session),
      email: session?.email || "",
      resultSnapshot: session?.resultSnapshot || null,
    },
  };
}
