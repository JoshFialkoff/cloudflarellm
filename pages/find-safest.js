import { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { MASSACHUSETTS_FACILITIES } from "../lib/massachusettsFacilities";
import { facilityAiSummary, facilityTrustMetrics, rankedFacilities } from "../lib/facilityTrust";
import { HumanAdvisorLead, ShortlistDownload } from "../components/LeadCaptureActions";
import searchStyles from "../styles/Search.module.css";
import growthStyles from "../styles/GrowthMvp.module.css";

function townLabel(town) {
  return town.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function HeartExpandIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M19 13H5v-2h14v2z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      <path fill="white" d="M12 8v8M8 12h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CollapsibleMetric({ metric }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={growthStyles.metricDisclosure}>
      <button
        type="button"
        className={growthStyles.metricDisclosureButton}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <small>{metric.label}</small>
          <strong>{metric.value}</strong>
        </span>
        <span className={growthStyles.heartExpandBtn} aria-label={open ? "Hide detail" : "Tell me more"}>
          <HeartExpandIcon open={open} />
        </span>
      </button>
      {open ? <p className={growthStyles.metricDisclosureDetail}>{metric.why}</p> : null}
    </div>
  );
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

        <div className={growthStyles.resultsFirstShell}>
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
                    <span className={searchStyles.careTypeBadge}>{townLabel(facility.town)}</span>
                    {facility.careTypes.map((type) => (
                      <span key={type} className={searchStyles.careTypeBadge}>{type}</span>
                    ))}
                  </div>

                  <div className={growthStyles.aiSummary}>
                    <strong>AI summary</strong>
                    <p>{facilityAiSummary(facility)}</p>
                  </div>

                  <div className={growthStyles.metricDisclosureGrid}>
                    {metrics.map((metric) => (
                      <CollapsibleMetric key={metric.label} metric={metric} />
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

          <section className={growthStyles.leadSection} aria-label="Next steps">
            <div>
              <h2>Save the shortlist before you call.</h2>
              <p>
                Three facility views are free. After that, email magic-link sign-in unlocks more comparisons.
              </p>
            </div>
            <div className={growthStyles.leadGrid}>
              <ShortlistDownload facilities={defaultShortlist} city={submittedCity} />
              <HumanAdvisorLead facilities={defaultShortlist} city={submittedCity} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
