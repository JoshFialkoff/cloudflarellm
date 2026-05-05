import { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import AuthCapture from "../components/AuthCapture";
import { MASSACHUSETTS_FACILITIES } from "../lib/massachusettsFacilities";
import { facilityAiSummary, facilitySafetyScore, facilityTrustMetrics, rankedFacilities } from "../lib/facilityTrust";
import { HumanAdvisorLead, ShortlistDownload } from "../components/LeadCaptureActions";
import searchStyles from "../styles/Search.module.css";
import growthStyles from "../styles/GrowthMvp.module.css";

function townLabel(town) {
  return town.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function FindSafestPage() {
  const [city, setCity] = useState("Boston");
  const [submittedCity, setSubmittedCity] = useState("Boston");
  const [saved, setSaved] = useState({});

  const results = useMemo(
    () => rankedFacilities(MASSACHUSETTS_FACILITIES, submittedCity),
    [submittedCity],
  );
  const shown = results.length ? results : rankedFacilities(MASSACHUSETTS_FACILITIES).slice(0, 6);
  const resultSnapshot = {
    kind: "safest_facilities",
    city: submittedCity,
    facilities: shown.slice(0, 6).map((facility) => ({
      name: facility.name,
      slug: facility.slug,
      town: facility.town,
      address: facility.address,
      safetyScore: facilitySafetyScore(facility),
      monthlyMin: facility.monthlyMin,
      monthlyMax: facility.monthlyMax,
      careTypes: facility.careTypes,
    })),
  };
  const shortlist = shown.filter((facility) => saved[facility.slug]).slice(0, 6);
  const defaultShortlist = shortlist.length ? shortlist : shown.slice(0, 3);

  const submit = (event) => {
    event.preventDefault();
    setSubmittedCity(city.trim());
  };

  return (
    <>
      <Head>
        <title>Find Safest Assisted Living Near You | assistedly.AI</title>
        <meta name="description" content="Search Massachusetts assisted living facilities by city and compare safety-focused trust metrics before sharing your information." />
      </Head>
      <div className={searchStyles.searchPage}>
        <section className={searchStyles.searchHeader}>
          <div className="container">
            <form className={searchStyles.searchBarForm} onSubmit={submit}>
              <input
                className={searchStyles.searchBarInput}
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City, e.g. Boston, Worcester, Newton"
              />
              <button className={searchStyles.searchBarBtn} type="submit">Find safest</button>
            </form>
            <p className={searchStyles.resultsCount}>
              Find safest assisted living near {submittedCity || "Massachusetts"}
            </p>
          </div>
        </section>

        <div className={searchStyles.searchLayout}>
          <aside className={searchStyles.filtersSidebar}>
            <h3 className={searchStyles.filtersTitle}>Consumer MVP</h3>
            <p className={searchStyles.amenityItem}>
              Three facility views are free. After that, email magic-link sign-in unlocks more comparisons.
            </p>
            <div className={growthStyles.leadGrid} style={{ gridTemplateColumns: "1fr" }}>
              <div className={growthStyles.captureCard}>
                <h3>Save your results data</h3>
                <AuthCapture
                  reason="Register or sign in with a passwordless email link to view the city and ranked facility data used for these results."
                  redirectTo="/results"
                  resultSnapshot={resultSnapshot}
                  buttonLabel="Email my results link"
                />
              </div>
              <ShortlistDownload facilities={defaultShortlist} city={submittedCity} />
              <HumanAdvisorLead facilities={defaultShortlist} city={submittedCity} />
            </div>
          </aside>

          <section className={searchStyles.resultsArea} aria-label="Safest assisted living results">
            {shown.map((facility) => {
              const metrics = facilityTrustMetrics(facility).slice(0, 3);
              return (
                <article key={facility.slug} className={searchStyles.facilityCard}>
                  <div className={searchStyles.cardHeader}>
                    <div>
                      <h2 className={searchStyles.facilityName}>{facility.name}</h2>
                      <p className={searchStyles.facilityAddress}>{facility.address}</p>
                    </div>
                    <button
                      className={`${searchStyles.saveBtn} ${saved[facility.slug] ? searchStyles.saveBtnActive : ""}`}
                      onClick={() => setSaved((current) => ({ ...current, [facility.slug]: !current[facility.slug] }))}
                      aria-label="Save facility to shortlist"
                      type="button"
                    >
                      {saved[facility.slug] ? "Saved" : "Save"}
                    </button>
                  </div>

                  <div className={searchStyles.careTypesRow}>
                    <span className={searchStyles.complianceBadge}>Safety score {facilitySafetyScore(facility)}/100</span>
                    <span className={searchStyles.careTypeBadge}>{townLabel(facility.town)}</span>
                    {facility.careTypes.map((type) => (
                      <span key={type} className={searchStyles.careTypeBadge}>{type}</span>
                    ))}
                  </div>

                  <div className={growthStyles.aiSummary}>
                    <strong>AI summary</strong>
                    <p>{facilityAiSummary(facility)}</p>
                  </div>

                  <div className={growthStyles.trustGrid} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                    {metrics.map((metric) => (
                      <div key={metric.label} className={growthStyles.trustMetric}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                        <p>{metric.why}</p>
                      </div>
                    ))}
                  </div>

                  <div className={searchStyles.cardActions}>
                    <Link href={`/massachusetts/${facility.town}/${facility.slug}/`} className={searchStyles.viewDetailsBtn}>
                      View facility safety page
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </div>
    </>
  );
}
