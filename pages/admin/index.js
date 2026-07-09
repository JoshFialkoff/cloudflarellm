import { useEffect, useState } from "react";
import Head from "next/head";
import AuthCapture from "../../components/AuthCapture";
import searchStyles from "../../styles/Search.module.css";
import growthStyles from "../../styles/GrowthMvp.module.css";

export default function AdminDashboardPage() {
  const [session, setSession] = useState({ authenticated: false, role: "visitor" });
  const [summary, setSummary] = useState(null);
  const [botHealth, setBotHealth] = useState(null);
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

    // Fetch bot health metrics
    fetch("/api/admin/bot-health")
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setBotHealth(data);
        }
      })
      .catch(() => console.error("Could not load bot health metrics"));
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

          {session.role === "admin" && (summary || botHealth) ? (
            <>
              {botHealth && botHealth.current ? (
                <article className={searchStyles.facilityCard} style={{ marginBottom: "2rem" }}>
                  <h2 className={searchStyles.facilityName} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Bot Health Monitoring</span>
                    <span style={{ 
                      fontSize: "0.9rem", 
                      padding: "0.25rem 0.75rem", 
                      borderRadius: "1rem",
                      backgroundColor: botHealth.current.status === "excellent" || botHealth.current.status === "good" ? "#4a7c7e" : "#6d1247",
                      color: "white",
                      fontWeight: "normal"
                    }}>
                      Status: {botHealth.current.status} ({botHealth.current.overallScore}/100)
                    </span>
                  </h2>
                  <p className={searchStyles.facilityAddress} style={{ marginBottom: "1.5rem" }}>
                    Real-time AI and infrastructure vitals. Aggregated metrics show overall system health without exposing any underlying user queries or sensitive server details.
                  </p>
                  
                  <div className={growthStyles.trustGrid}>
                    <article className={growthStyles.trustMetric}>
                      <span>AI Uptime</span>
                      <strong>{botHealth.current.metrics.uptime}%</strong>
                      <p>Continuous uptime of the co-located Dify stack</p>
                    </article>
                    
                    <article className={growthStyles.trustMetric}>
                      <span>Response Performance</span>
                      <strong>{botHealth.current.metrics.responseTime}/100</strong>
                      <p>Dify API latency rating (100 = optimal speed)</p>
                    </article>
                    
                    <article className={growthStyles.trustMetric}>
                      <span>Total Interactions</span>
                      <strong>{botHealth.current.metrics.interactions}</strong>
                      <p>Successfully processed user and AI dialogues</p>
                    </article>
                  </div>

                  {botHealth.history && botHealth.history.length > 0 && (
                    <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e6e6e9", paddingTop: "1.5rem" }}>
                      <h4 style={{ fontSize: "0.95rem", color: "#666", marginBottom: "0.75rem" }}>7-Day Health Score History</h4>
                      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
                        {botHealth.history.map((h, idx) => (
                          <div key={idx} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "0.8rem", color: "#888" }}>
                              {new Date(h.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </div>
                            <strong style={{ fontSize: "1.1rem", color: h.score >= 80 ? "#4a7c7e" : "#6d1247" }}>
                              {h.score}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ) : null}

              {summary ? (
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
            </>
          ) : null}
          {error ? <p>{error}</p> : null}
        </div>
      </div>
    </>
  );
}
