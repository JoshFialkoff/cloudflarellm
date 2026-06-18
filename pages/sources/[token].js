import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import AssistedlyLogo from "../../components/AssistedlyLogo";
import AuthCapture from "../../components/AuthCapture";
import { revealFocusTarget } from "../../lib/revealFocusTarget";
import styles from "../../styles/FacilitySource.module.css";

function SourceActions({ token, attestation, onStatus }) {
  const [opening, setOpening] = useState(false);

  async function openWorkspace() {
    if (opening) return;
    setOpening(true);
    onStatus("Opening Assistedly data workspace…");

    try {
      const response = await fetch("/api/facility-source-redirect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.redirectUrl) {
        onStatus(data.error || "Could not open the data workspace.");
        setOpening(false);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      onStatus("Could not open the data workspace.");
      setOpening(false);
    }
  }

  async function shareSource() {
    const url = window.location.href;
    const title = `${attestation.label} · ${attestation.facilityName}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: attestation.excerpt, url });
        onStatus("Share sheet opened.");
        return;
      }
      await navigator.clipboard.writeText(url);
      onStatus("Source link copied to clipboard.");
    } catch {
      onStatus("Could not share this source.");
    }
  }

  return (
    <div className={styles.actionBar}>
      <p className={styles.actionLead}>
        Signed in — you can save, print, or share this verified source record.
      </p>
      <div className={styles.actionButtons}>
        <button type="button" className={styles.secondaryBtn} onClick={() => window.print()}>
          Print source
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={shareSource}>
          Share link
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={openWorkspace}
          disabled={opening}
        >
          {opening ? "Opening…" : "Save to workspace"}
        </button>
      </div>
      <p className={styles.backLink}>
        <Link href={`/massachusetts/${attestation.town}/${attestation.facilitySlug}`}>
          Back to {attestation.facilityName}
        </Link>
      </p>
    </div>
  );
}

export default function FacilitySourcePage({ attestation, token, error }) {
  const [status, setStatus] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .catch(() => ({}))
      .then((data) => {
        if (data?.authenticated) {
          setAuthenticated(true);
          setSessionEmail(data.email || "");
        }
      });
  }, []);

  useEffect(() => {
    if (authenticated || error || !attestation) return;
    const panel = document.getElementById("source-auth-panel");
    if (!panel) return;
    revealFocusTarget(panel, { block: "end", padding: 20 });
  }, [attestation, authenticated, error]);

  if (error || !attestation) {
    return (
      <>
        <Head>
          <title>Source unavailable | Assistedly</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>
        <main className={styles.page}>
          <div className="container">
            <div className={styles.topBar}>
              <AssistedlyLogo size="sm" />
            </div>
            <h1>Source link unavailable</h1>
            <p>{error || "This verification link is invalid or has expired."}</p>
            <Link href="/massachusetts">Back to Massachusetts facilities</Link>
          </div>
        </main>
      </>
    );
  }

  const facilityPath = `/massachusetts/${attestation.town}/${attestation.facilitySlug}`;
  const sourcePath = `/sources/${token}`;

  return (
    <>
      <Head>
        <title>Assistedly.ai Data Source · {attestation.facilityName}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main className={styles.page}>
        <div className="container">
          <div className={styles.topBar}>
            <AssistedlyLogo size="sm" />
          </div>

          <article className={styles.sheet}>
            <h1 className={styles.title}>Assistedly.ai Data Source</h1>
            <p className={styles.intro}>
              All of Assistedly.ai&apos;s data comes from verifiable sources.{" "}
              <strong>{attestation.facilityName}&apos;s</strong> data from:
            </p>

            <section className={styles.sourceBlock} aria-labelledby="source-record-title">
              <h2 id="source-record-title" className={styles.sourceLabel}>
                {attestation.label}
              </h2>
              <blockquote className={styles.excerpt}>{attestation.excerpt}</blockquote>
              <dl className={styles.metaList}>
                <div className={styles.metaRow}>
                  <dt>Covers</dt>
                  <dd>{attestation.scope}</dd>
                </div>
                {attestation.fieldKeys?.length ? (
                  <div className={styles.metaRow}>
                    <dt>Field keys</dt>
                    <dd>{attestation.fieldKeys.join(", ")}</dd>
                  </div>
                ) : null}
                {attestation.lastUpdated ? (
                  <div className={styles.metaRow}>
                    <dt>Last updated</dt>
                    <dd>{attestation.lastUpdated}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <p className={styles.copyright}>Copyright Assistedly.ai.</p>

            <section
              id="source-auth-panel"
              className={`${styles.authPanel} scrollRevealTarget`}
              aria-labelledby="source-auth-title"
            >
              <h2 id="source-auth-title" className={styles.authTitle}>
                Save, print, or share this source
              </h2>
              {authenticated ? (
                <>
                  {sessionEmail ? (
                    <p className={styles.signedInAs}>Signed in as {sessionEmail}</p>
                  ) : null}
                  <SourceActions
                    token={token}
                    attestation={attestation}
                    onStatus={setStatus}
                  />
                </>
              ) : (
                <>
                  <p className={styles.authLead}>
                    Create a free Assistedly account with a magic link to print this record,
                    share the verification URL, or open the full data workspace.
                  </p>
                  <div className={styles.authForm}>
                    <AuthCapture
                      authSurface="facility_source_verification"
                      formId={`facility_source_${token.slice(0, 16)}`}
                      redirectTo={sourcePath}
                      reason="Enter your email for a passwordless sign-in link."
                      submitLabel="Send magic link"
                      successMessage="Check your email, then return here to save, print, or share."
                      fallbackMessage="Test mode: use the sign-in link below, then return here."
                      onSuccess={() => setStatus("Magic link sent. Open it to unlock save, print, and share.")}
                    />
                  </div>
                  <p className={styles.backLink}>
                    <Link href={facilityPath}>Back to {attestation.facilityName}</Link>
                  </p>
                </>
              )}
              {status ? <p className={styles.status}>{status}</p> : null}
            </section>
          </article>
        </div>
      </main>
    </>
  );
}

export async function getServerSideProps({ params, req }) {
  const { verifySourceToken } = require("../../lib/sourceAccessToken");
  const { resolveFacilitySourceAttestation } = require("../../lib/facilitySourceAttestation");

  const token = String(params?.token || "").trim();
  const payload = verifySourceToken(token);
  if (!payload) {
    return {
      props: {
        attestation: null,
        token: "",
        error: "This verification link is invalid or has expired.",
      },
    };
  }

  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  if (!ua || /bot|crawler|spider|scrapy/i.test(ua)) {
    return {
      props: {
        attestation: null,
        token: "",
        error: "Automated clients cannot open Assistedly source verification pages.",
      },
    };
  }

  const attestation = resolveFacilitySourceAttestation(payload.slug, payload.sourceId);
  if (!attestation) {
    return {
      props: {
        attestation: null,
        token: "",
        error: "No matching Assistedly source record is configured for this facility.",
      },
    };
  }

  const { dashboardUrl, ...publicAttestation } = attestation;

  return {
    props: {
      attestation: publicAttestation,
      token,
      error: "",
    },
  };
}
