import { useEffect, useMemo, useState, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { useFeatureFlagVariantKey } from "posthog-js/react";
import { REGISTRATION_CTA_EXPERIMENT_FLAG } from "../lib/posthogClient";
import AuthCapture from "../components/AuthCapture";
import AssistantResearchPanel from "../components/AssistantResearchPanel";
import CompareTable from "../components/CompareTable";
import ShareComparisonModal from "../components/ShareComparisonModal";
import ShareResultsCTA from "../components/ShareResultsCTA";
import SaveResultsCTA from "../components/SaveResultsCTA";
import ConsumerLeadCapture from "../components/ConsumerLeadCapture";
import { MASSACHUSETTS_FACILITIES } from "../lib/massachusettsFacilities";
import {
  buildComparisonSummary,
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  const ctaVariant = useFeatureFlagVariantKey(REGISTRATION_CTA_EXPERIMENT_FLAG) || "control";
  const isLossAversion = ctaVariant !== "control";

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setSession(data))
      .catch(() => setSession({ authenticated: false, role: "visitor" }));
  }, []);

  const selectedSlugs = useMemo(
    () => parseQueryFacilities(router.query.facilities),
    [router.query.facilities],
  );

  const selectedFacilities = useMemo(() => {
    const selected = MASSACHUSETTS_FACILITIES.filter((facility) =>
      selectedSlugs.includes(facility.slug),
    );
    return selected.slice(0, MAX_COMPARE);
  }, [selectedSlugs]);

  const comparisonSummary = useMemo(
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

    if (response.ok) {
      setSaveStatus("Saved to your premium comparison library.");
      return;
    }

    const data = await response.json().catch(() => null);
    setSaveStatus(data?.error || `Could not save (HTTP ${response.status}).`);
  }

  const openShareModal = useCallback(() => {
    setShareModalOpen(true);
  }, []);

  const closeShareModal = useCallback(() => {
    setShareModalOpen(false);
  }, []);

  const handleShared = useCallback(({ method, recipientEmail }) => {
    if (method === 'email' && recipientEmail) {
      setShareStatus(`✓ Comparison sent to ${recipientEmail}`);
    } else {
      setShareStatus('✓ Comparison ready to share!');
    }
    // Auto-clear the status after a few seconds
    setTimeout(() => setShareStatus(''), 5000);
  }, []);

  const enableShare = selectedFacilities.length >= 2;

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
            <h1 style={{ color: "white", marginBottom: "0.75rem" }}>Compare Massachusetts Assisted Living Facilities</h1>
            <p className={searchStyles.resultsCount}>
              Side-by-side comparison of cost, ratings, care types, and compliance. Share with family to decide together.
            </p>
          </div>
        </section>
        <div className={searchStyles.searchLayout}>
          {/* Sidebar: Facility selection */}
          <aside className={searchStyles.filtersSidebar}>
            <h2 className={searchStyles.filtersTitle}>Select facilities to compare</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1rem' }}>
              Choose 2–4 facilities to see them side by side.
            </p>
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

            {/* Share button in sidebar */}
            {selectedFacilities.length >= 2 && (
              <div style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={openShareModal}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    background: 'var(--secondary)',
                    color: 'var(--white)',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  👨‍👩‍👧‍👦 Share with family
                </button>
                {shareStatus && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--primary)', textAlign: 'center' }}>
                    {shareStatus}
                  </p>
                )}
              </div>
            )}

            <div style={{ marginTop: '1.25rem' }}>
              <ConsumerLeadCapture
                page="/compare"
                leadMagnet="comparison-guide"
                title="Get the comparison workbook"
                description="Capture the assisted living comparison guide, pricing questions, and tour checklist."
              />
            </div>
          </aside>

          {/* Main: Visual comparison table + extras */}
          <section className={searchStyles.resultsArea} aria-label="Facility comparison results">
            {/* Visual Comparison Table */}
            <CompareTable facilities={selectedFacilities} showSummary={true} />

            {/* Summary insights */}
            {selectedFacilities.length >= 2 && (
              <article className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>Key Insights</h2>
                <ul className={searchStyles.amenitiesList} style={{ gridTemplateColumns: "1fr" }}>
                  {comparisonSummary.map((item, idx) => (
                    <li key={idx} className={searchStyles.amenityItem}>{item}</li>
                  ))}
                </ul>
              </article>
            )}

            {/* Share CTA card — prominent call to action */}
            {selectedFacilities.length >= 2 && (
              <article className={searchStyles.facilityCard} style={{
                background: 'linear-gradient(135deg, #f4fbf8 0%, #fdf9f5 100%)',
                border: '2px solid #c4956a',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <h2 className={searchStyles.facilityName} style={{ color: 'var(--secondary)' }}>
                      👨‍👩‍👧‍👦 Making a decision together?
                    </h2>
                    <p className={searchStyles.facilityAddress} style={{ color: 'var(--text)' }}>
                      Send this comparison to your family so everyone can review the options. 
                      Share by email or text message — it only takes a moment.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={searchStyles.viewDetailsBtn}
                    onClick={openShareModal}
                    style={{
                      background: 'var(--secondary)',
                      padding: '0.85rem 1.5rem',
                      fontSize: '1rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📬 Send to my family
                  </button>
                </div>
                {shareStatus && (
                  <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--primary)', textAlign: 'center' }}>
                    {shareStatus}
                  </p>
                )}
              </article>
            )}

            {/* Registered-user expanded detail */}
            {selectedFacilities.length >= 2 && (
              <>
                {session.authenticated ? (
                  <article className={searchStyles.facilityCard}>
                    <h2 className={searchStyles.facilityName}>Expanded Details (Registered User)</h2>
                    <p className={searchStyles.facilityAddress}>
                      Pricing summaries, staffing signals, compliance context, and direct links to each facility profile.
                    </p>
                    <div className={growthStyles.trustGrid} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))` }}>
                      {selectedFacilities.map((facility) => (
                        <div key={facility.slug} className={growthStyles.trustMetric}>
                          <span>{facility.name}</span>
                          <Link href={`/massachusetts/${facility.town}/${facility.slug}`} style={{ fontSize: '0.85rem' }}>
                            View full facility profile →
                          </Link>
                        </div>
                      ))}
                    </div>
                  </article>
                ) : (
                  <article className={searchStyles.facilityCard}>
                    {ctaVariant === "share_family" && (
                      <ShareResultsCTA facilities={selectedFacilities} />
                    )}
                    {ctaVariant === "save_results" && (
                      <SaveResultsCTA
                        resultSnapshot={{ compared_facilities: selectedFacilities.map((f) => ({ slug: f.slug, name: f.name })) }}
                        redirectTo={router.asPath}
                        ctaVariant={ctaVariant}
                      />
                    )}
                    {ctaVariant === "control" && (
                      <>
                        <h2 className={searchStyles.facilityName}>Create a free account for expanded detail</h2>
                        <AuthCapture
                          authSurface="comparison_gate"
                          formId="comparison_gate_magic_link"
                          redirectTo={router.asPath}
                          reason="Email yourself a magic link to unlock expanded comparison details."
                        />
                      </>
                    )}
                  </article>
                )}
              </>
            )}

            {/* AI Research Assistant */}
            {selectedFacilities.length >= 2 && (
              <AssistantResearchPanel facilities={selectedFacilities} />
            )}

            {/* Premium save */}
            {selectedFacilities.length >= 2 && (
              <article className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>Premium Comparison Report</h2>
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
            )}
          </section>
        </div>
      </div>

      {/* Share Modal */}
      {shareModalOpen && selectedFacilities.length >= 2 && (
        <ShareComparisonModal
          facilities={selectedFacilities}
          facilitySlugs={selectedSlugs}
          onClose={closeShareModal}
          onShared={handleShared}
        />
      )}
    </>
  );
}
