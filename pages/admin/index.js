import { useEffect, useState } from "react";
import Head from "next/head";
import AuthCapture from "../../components/AuthCapture";
import searchStyles from "../../styles/Search.module.css";
import growthStyles from "../../styles/GrowthMvp.module.css";

export default function AdminDashboardPage() {
  const [session, setSession] = useState({ authenticated: false, role: "visitor" });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setSession(data))
      .catch(() => setSession({ authenticated: false, role: "visitor" }));
  }, []);

  useEffect(() => {
    if (session.role !== "admin") return;
    fetch("/api/admin/summary")
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || "Could not load admin summary.");
          return;
        }
        setSummary(data);
      })
      .catch(() => setError("Could not load admin summary."));
  }, [session.role]);

  return (
    <>
      <Head>
        <title>Admin dashboard | Assistedly.ai</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className={searchStyles.searchPage}>
        <section className={searchStyles.searchHeader}>
          <div className="container">
            <h1 style={{ color: "white", marginBottom: "0.75rem" }}>Admin dashboard</h1>
            <p className={searchStyles.resultsCount}>
              Lightweight internal view of users, registrations, AI usage, popular facilities, and funnel health.
            </p>
          </div>
        </section>
        <div className={searchStyles.searchLayout} style={{ gridTemplateColumns: "1fr" }}>
          {session.role !== "admin" ? (
            <article className={searchStyles.facilityCard}>
              <h2 className={searchStyles.facilityName}>Admin access required</h2>
              <p className={searchStyles.facilityAddress}>
                Sign in with an admin-approved email address to open the internal dashboard.
              </p>
              <AuthCapture
                authSurface="admin_dashboard"
                formId="admin_dashboard_magic_link"
                redirectTo="/admin"
                reason="Send an admin magic link"
              />
            </article>
          ) : null}

          {session.role === "admin" && summary ? (
            <>
              <section className={growthStyles.trustGrid}>
                {Object.entries(summary.totals).map(([label, value]) => (
                  <article key={label} className={growthStyles.trustMetric}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <p>{label === "facilityClaims" ? "Facility representative requests" : "MVP total"}</p>
                  </article>
                ))}
              </section>

              <article className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>Conversion funnel</h2>
                <div className={growthStyles.trustGrid}>
                  {Object.entries(summary.funnel).map(([label, value]) => (
                    <div key={label} className={growthStyles.trustMetric}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <p>Tracked in the MVP event store.</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>Popular facilities</h2>
                <ul className={searchStyles.amenitiesList} style={{ gridTemplateColumns: "1fr" }}>
                  {summary.popularFacilities.map((item) => (
                    <li key={item.facility} className={searchStyles.amenityItem}>
                      {item.facility}: {item.count}
                    </li>
                  ))}
                </ul>
              </article>

              <article className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>Recent leads</h2>
                <ul className={searchStyles.amenitiesList} style={{ gridTemplateColumns: "1fr" }}>
                  {summary.recentLeads.map((lead) => (
                    <li key={lead.id} className={searchStyles.amenityItem}>
                      {lead.createdAt}: {lead.email} · {lead.intent} · {lead.city || lead.town || "Unknown town"}
                    </li>
                  ))}
                </ul>
              </article>
            </>
          ) : null}
          {error ? <p>{error}</p> : null}
        </div>
      </div>
    </>
  );
}
