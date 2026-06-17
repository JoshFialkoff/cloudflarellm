import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import styles from "../../styles/FacilitySource.module.css";

export default function FacilitySourcePage({ attestation, token, error }) {
  const [status, setStatus] = useState("");
  const [opening, setOpening] = useState(false);

  if (error || !attestation) {
    return (
      <>
        <Head>
          <title>Source unavailable | Assistedly</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>
        <main className={styles.page}>
          <div className="container">
            <h1>Source link unavailable</h1>
            <p>{error || "This verification link is invalid or has expired."}</p>
            <Link href="/massachusetts">Back to Massachusetts facilities</Link>
          </div>
        </main>
      </>
    );
  }

  async function openWorkspace(event) {
    event.preventDefault();
    if (opening) return;
    setOpening(true);
    setStatus("Opening Assistedly data workspace…");

    try {
      const response = await fetch("/api/facility-source-redirect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.redirectUrl) {
        setStatus(data.error || "Could not open the data workspace.");
        setOpening(false);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setStatus("Could not open the data workspace.");
      setOpening(false);
    }
  }

  return (
    <>
      <Head>
        <title>{attestation.label} · {attestation.facilityName} | Assistedly</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main className={styles.page}>
        <div className="container">
          <p className={styles.eyebrow}>Assistedly source verification</p>
          <h1>{attestation.label}</h1>
          <p className={styles.lead}>
            This record in the Assistedly data workspace backs specific fields on the{" "}
            <strong>{attestation.facilityName}</strong> profile — not the whole database.
          </p>
          <div className={styles.card}>
            <p>
              <strong>Covers:</strong> {attestation.scope}
            </p>
            {attestation.fieldKeys?.length ? (
              <p>
                <strong>Field keys:</strong> {attestation.fieldKeys.join(", ")}
              </p>
            ) : null}
            {attestation.lastUpdated ? (
              <p>
                <strong>Last updated:</strong> {attestation.lastUpdated}
              </p>
            ) : null}
          </div>
          <p className={styles.note}>
            The workspace link is issued only after you open this page from Assistedly.ai. Bots and bulk
            scrapers cannot enumerate these URLs from facility pages.
          </p>
          <button type="button" className={styles.primaryBtn} onClick={openWorkspace} disabled={opening}>
            Open Assistedly data workspace
          </button>
          {status ? <p className={styles.status}>{status}</p> : null}
          <p className={styles.backLink}>
            <Link href={`/massachusetts/${attestation.town}/${attestation.facilitySlug}`}>
              Back to facility page
            </Link>
          </p>
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
