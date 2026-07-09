import { useEffect, useState } from "react";
import Head from "next/head";
import searchStyles from "../../styles/Search.module.css";
import growthStyles from "../../styles/GrowthMvp.module.css";

export default function AdminDashboardPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === "$$enior$$5") {
      setAuthenticated(true);
      setError("");
    } else {
      setError("Incorrect password");
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    fetch("/api/admin/firecrawl-data")
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || "Could not load Firecrawl data.");
          return;
        }
        setData(data);
      })
      .catch(() => setError("Could not load Firecrawl data."));
  }, [authenticated]);

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
              Features & Competitors intelligence from Firecrawl analysis.
            </p>
          </div>
        </section>
        <div className={searchStyles.searchLayout} style={{ gridTemplateColumns: "1fr" }}>
          {!authenticated ? (
            <article className={searchStyles.facilityCard}>
              <h2 className={searchStyles.facilityName}>Access required</h2>
              <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Dashboard password"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #e6e6e9",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    marginBottom: "0.75rem"
                  }}
                />
                <button
                  type="submit"
                  style={{
                    backgroundColor: "#4a7c7e",
                    color: "white",
                    border: "none",
                    padding: "0.75rem 1.5rem",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    cursor: "pointer",
                    width: "100%"
                  }}
                >
                  Unlock dashboard
                </button>
                {error && <p style={{ color: "#6d1247", marginTop: "0.75rem" }}>{error}</p>}
              </form>
            </article>
          ) : null}

          {authenticated && data ? (
            <>
              <article className={searchStyles.facilityCard}>
                <h2 className={searchStyles.facilityName}>Firecrawl Intelligence Summary</h2>
                <p className={searchStyles.facilityAddress} style={{ marginBottom: "1.5rem" }}>
                  {data.summary || "No summary available"}
                </p>
                <div className={growthStyles.trustGrid}>
                  <div className={growthStyles.trustMetric}>
                    <span>Total Features</span>
                    <strong>{data.features?.length || 0}</strong>
                    <p>New features detected</p>
                  </div>
                  <div className={growthStyles.trustMetric}>
                    <span>Competitors</span>
                    <strong>{data.competitors?.length || 0}</strong>
                    <p>Active competitors tracked</p>
                  </div>
                  <div className={growthStyles.trustMetric}>
                    <span>Last Update</span>
                    <strong>{data.lastUpdate || "Unknown"}</strong>
                    <p>Most recent data sync</p>
                  </div>
                </div>
              </article>

              {data.features && data.features.length > 0 && (
                <article className={searchStyles.facilityCard}>
                  <h2 className={searchStyles.facilityName}>New Features Detected</h2>
                  <ul className={searchStyles.amenitiesList} style={{ gridTemplateColumns: "1fr" }}>
                    {data.features.map((feature, idx) => (
                      <li key={idx} className={searchStyles.amenityItem}>
                        <strong>{feature.name || feature}</strong>
                        {feature.description && <p style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>{feature.description}</p>}
                        {feature.recommendation && (
                          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", color: "#4a7c7e" }}>
                            💡 {feature.recommendation}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              )}

              {data.competitors && data.competitors.length > 0 && (
                <article className={searchStyles.facilityCard}>
                  <h2 className={searchStyles.facilityName}>Competitors</h2>
                  <ul className={searchStyles.amenitiesList} style={{ gridTemplateColumns: "1fr" }}>
                    {data.competitors.map((competitor, idx) => (
                      <li key={idx} className={searchStyles.amenityItem}>
                        <strong>{competitor.name || competitor}</strong>
                        {competitor.url && <p style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>{competitor.url}</p>}
                        {competitor.notes && <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>{competitor.notes}</p>}
                      </li>
                    ))}
                  </ul>
                </article>
              )}
            </>
          ) : null}
          {authenticated && error ? <p style={{ color: "#6d1247", marginTop: "1rem" }}>{error}</p> : null}
        </div>
      </div>
    </>
  );
}
