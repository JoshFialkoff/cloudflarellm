import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import AuthCapture from "../components/AuthCapture";
import AssistantResearchPanel from "../components/AssistantResearchPanel";
import ConsumerLeadCapture from "../components/ConsumerLeadCapture";
import { MASSACHUSETTS_FACILITIES } from "../lib/massachusettsFacilities";
import {
  buildComparisonRows,
  buildComparisonSummary,
  buildFacilityProfile,
} from "../lib/facilityProfiles";
import searchStyles from "../styles/Search.module.css";
import growthStyles from "../styles/GrowthMvp.module.css";

const MAX_COMPARE = 4;

function parseQueryFacilities(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE);
}

export default function ComparePage() {
  const router = useRouter();
  const [session, setSession] = useState({ authenticated: false, role: "visitor" });
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setSession(data))
      .catch(() => setSession({ authenticated: false, role: "visitor" }));
  }, []);

  const selectedSlugs = useMemo(
    () => parseQueryFacilities(router.query.facilities),
    [router.query.facilities],
  )

  const selectedFacilities = useMemo(() => {
    const selected = MASSACHUSETTS_FACILITIES.filter((facility) =>
      selectedSlugs.includes(facility.slug),
    ).map(buildFacilityProfile);
    return selected.slice(0, MAX_COMPARE);
  }, [selectedSlugs]);

  const comparisonRows = useMemo(
    () => buildComparisonRows(selectedFacilities),
    [selectedFacilities],
  );
  const summary = useMemo(
    () => buildComparisonSummary(selectedFacilities),
    [selectedFacilities],
  );

  function toggleFacility(slug) {
    const exists = selectedSlugs.includes(slug);
    const next = exists
      ? selectedSlugs.filter((item) => item !== slug)
      : selectedSlugs.length >= MAX_COMPARE
        ? selectedSlugs
        : [...selectedSlugs, slug];
    router.replace(
      {
        pathname: "/compare",
        query: next.length ? { facilities: next.join(",") } : {},
      },
      undefined,
      { shallow: true },
    );
  }

  async function saveComparison() {
    setSaveStatus("Saving...");
    const response = await fetch("/api/comparisons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:
          selectedFacilities.map((facility) => facility.name).join(" vs ").slice(0, 120) ||
          "Saved comparison",
        facilitySlugs: selectedFacilities.map((facility) => facility.slug),
      }),
    });

    const data = await response.json().catch(() => ({}));
    setSaveStatus(response.ok ? "Saved to your premium comparison library." : data.error || "Could not save.");
  }

  return (
    <>
      <Head>
        <title>Compare Massachusetts assisted living facilities | Assistedly.ai</title>
        <meta
          name="description"
          content="Compare 2 to 4 Massachusetts assisted living facilities by cost, staffing, care intensity, occupancy, memory care, and compliance indicators."
        />
      </Head>
      <div className={searchStyles.searchPage}>
        <section className={searchStyles.searchHeader}>
          <div className="container">
            <h1 style={{ color: "white", marginBottom: "0.75rem" }}>Compare 2 to 4 facilities</h1>
            <p className={searchStyles.resultsCount}>
              Public visitors can review the summary table. Registered users get expanded detail, and premium members can save full comparison reports.
            </p>
          </div>
        </section>
        <div className={searchStyles.searchLayout}>
          <aside className={searchStyles.filtersSidebar}>
            <h2 className={searchStyles.filtersTitle}>Build your comparison set</h2>
            {MASSACHUSETTS_FACILITIES.map((facility) => (
              <label key={facility.slug} className={searchStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={selectedSlugs.includes(facility.slug)}
                  onChange={() => toggleFacility(facility.slug)}
                  disabled={
                    !selectedSlugs.includes(facility.slug) && selectedSlugs.length >= MAX_COMPARE
                  }
                />
                <span>{facility.name}</span>
              </label>
            ))}
            <ConsumerLeadCapture
              page="/compare"
              leadMagnet="comparison-guide"
              title="Get the comparison workbook"
              description="Capture the assisted living comparison guide, pricing questions, and tour checklist."
            />
          </aside>
          <section className={searchStyles.resultsArea} aria-label="Facility comparison results">
            <article className={searchStyles.facilityCard}>
              <h2 className={searchStyles.facilityName}>Comparison summary</h2>
              <ul className={searchStyles.amenitiesList} style={{ gridTemplateColumns: "1fr" }}>
                {summary.map((item) => (
                  <li key={item} className={searchStyles.amenityItem}>{item}</li>
                ))}
              </ul>
            </article>

            {comparisonRows.map((row) => (
              <article key={row.category} className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>{row.category}</h2>
                <p className={searchStyles.facilityAddress}>{row.description}</p>
                <div className={growthStyles.trustGrid} style={{ gridTemplateColumns: `repeat(${Math.max(selectedFacilities.length, 1)}, minmax(0, 1fr))` }}>
                  {selectedFacilities.map((facility, index) => (
                    <div key={`${row.category}-${facility.slug}`} className={growthStyles.trustMetric}>
                      <span>{facility.name}</span>
                      <strong>{row.values[index]}</strong>
                      <p>{facility.profile.aiSummary}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}

            {session.authenticated ? (
              <article className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>Registered-user detail</h2>
                <p className={searchStyles.facilityAddress}>
                  Expanded detail includes pricing summaries, staffing signals, compliance context,
                  and direct links to each facility profile.
                </p>
                <div className={growthStyles.trustGrid} style={{ gridTemplateColumns: `repeat(${Math.max(selectedFacilities.length, 1)}, minmax(0, 1fr))` }}>
                  {selectedFacilities.map((facility) => (
                    <div key={facility.slug} className={growthStyles.trustMetric}>
                      <span>{facility.name}</span>
                      <strong>{facility.profile.pricingSummary}</strong>
                      <p>{facility.profile.regulatorySummary}</p>
                      <p>{facility.profile.staffingSummary}</p>
                      <Link href={`/massachusetts/${facility.town}/${facility.slug}`}>
                        View full facility profile
                      </Link>
                    </div>
                  ))}
                </div>
              </article>
            ) : (
              <article className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>Create a free account for expanded detail</h2>
                <AuthCapture
                  authSurface="comparison_gate"
                  formId="comparison_gate_magic_link"
                  redirectTo={router.asPath}
                  reason="Email yourself a magic link to unlock expanded comparison details."
                />
              </article>
            )}

            <AssistantResearchPanel facilities={selectedFacilities} />

            <article className={searchStyles.facilityCard}>
              <h2 className={searchStyles.facilityName}>Premium comparison report</h2>
              <p className={searchStyles.facilityAddress}>
                Premium members can save facility lists and revisit their full comparison reports.
              </p>
              <button
                type="button"
                className={searchStyles.viewDetailsBtn}
                onClick={saveComparison}
                disabled={selectedFacilities.length < 2}
              >
                Save comparison
              </button>
              {saveStatus ? <p className={searchStyles.facilityAddress}>{saveStatus}</p> : null}
            </article>
          </section>
        </div>
      </div>
    </>
  );
}
