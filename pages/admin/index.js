import { useEffect, useState } from "react";
import Head from "next/head";
import {
  AlertTriangle,
  Lightbulb,
  Target,
  Zap,
  ExternalLink,
  Shield,
  LayoutDashboard,
  DollarSign,
  Star,
  TrendingUp,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
// import KpiCards from "../../components/admin/KpiCards"; // Missing component
// import FeatureComparisonChart from "../../components/admin/FeatureComparisonChart"; // Missing component
import MarketLandscapeMap from "../../components/admin/MarketLandscapeMap";
import TrendTimeline from "../../components/admin/TrendTimeline";
import LoadingSkeleton from "../../components/admin/LoadingSkeleton";
import EmptyState from "../../components/admin/EmptyState";
import styles from "../../styles/admin/Dashboard.module.css";

const BRAND = "#4a7c7e";
const BURGUNDY = "#6d1247";
const GOLD = "#c4956a";

// Helper: parse rating string to number
function parseRating(ratingStr) {
  if (!ratingStr) return 0;
  const match = ratingStr.match(/^([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// Helper: parse funding to millions
function parseFunding(fundingStr) {
  if (!fundingStr) return 0;
  const lower = fundingStr.toLowerCase();
  if (lower.includes("billion")) return 1400;
  const m = lower.match(/\$?([\d,.]+)\s*m/);
  if (m) return parseFloat(m[1].replace(/,/g, ""));
  return 1;
}

export default function AdminDashboardPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    fetch("/api/admin/firecrawl-data")
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) { setError(body.error || "Load failed"); return; }
        setData(body);
      })
      .catch(() => setError("Could not load Firecrawl data."))
      .finally(() => setLoading(false));
  }, [authenticated]);

  // ── Auth Gate ──
  if (!authenticated) {
    return (
      <>
        <Head><title>AgeTech Vendor Dashboard | Assistedly.ai</title><meta name="robots" content="noindex,nofollow" /></Head>
        <div className={styles.dashboard}>
          <div className={styles.header}>
            <div className={styles.headerInner}>
              <h1 className={styles.headerTitle}>AgeTech Vendor Dashboard</h1>
              <p className={styles.headerSubtitle}>Tracking 11 Competitors&apos; Features, Ratings &amp; Funding</p>
            </div>
          </div>
          <div className={styles.authCard}>
            <LayoutDashboard size={40} color={BRAND} style={{ marginBottom: "0.75rem" }} />
            <h2>Access Required</h2>
            <p>Enter the dashboard password to view competitive intelligence.</p>
            <form onSubmit={handleSubmit} className={styles.authForm}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Dashboard password" className={styles.authInput} />
              <button type="submit" className={styles.authBtn}><Shield size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />Unlock Dashboard</button>
              {error && <p className={styles.authError}>{error}</p>}
            </form>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Head><title>AgeTech Vendor Dashboard | Assistedly.ai</title><meta name="robots" content="noindex,nofollow" /></Head>
        <div className={styles.dashboard}>
          <div className={styles.header}><div className={styles.headerInner}><h1 className={styles.headerTitle}>AgeTech Vendor Dashboard</h1></div></div>
          <div className={styles.container} style={{ paddingTop: "2rem" }}><LoadingSkeleton /></div>
        </div>
      </>
    );
  }

  if (!data && error) {
    return (
      <>
        <Head><title>AgeTech Vendor Dashboard | Assistedly.ai</title></Head>
        <div className={styles.dashboard}>
          <div className={styles.header}><div className={styles.headerInner}><h1 className={styles.headerTitle}>AgeTech Vendor Dashboard</h1></div></div>
          <div className={styles.emptyState}><AlertTriangle size={40} color="#dc3545" /><h3>Error</h3><p>{error}</p></div>
        </div>
      </>
    );
  }

  if (!data) return null;

  const { summary, features, competitors, lastUpdate, analytics, radarData, landscapeData, timelineData } = data;
  const positioning = analytics?.competitivePositioning || "";

  // ── Shared Platform Color Map (stable alpha-sort, Assistedly first) ──
  const PLATFORM_PALETTE = ["#4a7c7e", "#6d1247", "#c4956a", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0891b2", "#65a30d", "#ca8a04", "#dc2626", "#0d9488"];
  const platformNames = (radarData?.length
    ? Object.keys(radarData[0]).filter((k) => k !== "category")
        .sort((a, b) => { if (a === "Assistedly") return -1; if (b === "Assistedly") return 1; return a.localeCompare(b); })
    : []
  );
  const platformColorMap = {};
  platformNames.forEach((name, i) => { platformColorMap[name] = PLATFORM_PALETTE[i % PLATFORM_PALETTE.length]; });

  // Build funding & rating chart data
  const fundingData = competitors
    .map((c) => ({ name: c.name, funding: parseFunding(c.funding), rating: parseRating(c.rating) }))
    .sort((a, b) => b.funding - a.funding);

  const ratingData = [...competitors]
    .map((c) => ({ name: c.name, rating: parseRating(c.rating) }))
    .sort((a, b) => b.rating - a.rating);

  // NEW KPI definitions
  const extendedKpis = [
    { key: "totalFundingEstimate", label: "Total Competitor Funding", icon: DollarSign, iconClass: "kpiCardIconGreen", format: (v) => v },
    { key: "marketSaturationScore", label: "Market Saturation", icon: Target, iconClass: "kpiCardIconGold", format: (v) => `${v}%` },
    { key: "totalCompetitors", label: "Competitors Tracked", icon: Layers, iconClass: "kpiCardIconPlum", format: (v) => v },
    { key: "totalFeatures", label: "Features Detected", icon: Lightbulb, iconClass: "kpiCardIconTeal", format: (v) => v },
  ];

  return (
    <>
      <Head><title>AgeTech Vendor Dashboard | Assistedly.ai</title><meta name="robots" content="noindex,nofollow" /></Head>
      <div className={styles.dashboard}>
        <div className={styles.header}>
          <div className={styles.headerInner}>
            <h1 className={styles.headerTitle}>AgeTech Vendor Dashboard</h1>
            <p className={styles.headerSubtitle}>Tracking {competitors?.length || 0} Competitors&apos; Features, Ratings &amp; Funding</p>
          </div>
        </div>

        <div className={styles.container}>
          {/* ── KPI Cards ── */}
          <div className={styles.kpiRow}>
            {extendedKpis.map((kpi) => {
              const Icon = kpi.icon;
              const val = analytics?.[kpi.key] ?? 0;
              return (
                <div key={kpi.key} className={styles.kpiCard}>
                  <div className={styles.kpiCardHeader}>
                    <div className={`${styles.kpiCardIcon} ${styles[kpi.iconClass]}`}><Icon size={20} /></div>
                    <span className={styles.kpiCardLabel}>{kpi.label}</span>
                  </div>
                  <div className={styles.kpiCardValue}>{kpi.format(val)}</div>
                </div>
              );
            })}
          </div>

          {/* ── Gap Alert ── */}
          {analytics?.competitiveGap && (
            <div style={{ marginTop: "1.5rem" }}>
              <div className={styles.gapAlert}>
                <AlertTriangle size={20} className={styles.gapAlertIcon} />
                <div className={styles.gapAlertContent}>
                  <h3>Competitive Landscape Analysis</h3>
                  <p>{analytics.competitiveGap}</p>
                  {positioning && <p style={{ fontWeight: 700 }}>{positioning}</p>}
                  <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#999" }}>
                    Data sourced by{" "}
                    <a
                      href="https://docs.google.com/spreadsheets/d/1ZGAREevVLYFhvQeg3osMYkzOydH6pEsE-iqfD5HPNiM/edit?gid=1923250291#gid=1923250291&range=1:1000"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#4a7c7e", textDecoration: "underline" }}
                    >
                      Firecrawl
                    </a>
                    {" · "}Last updated: {lastUpdate || "Unknown"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Insights Row ── */}
          <div className={styles.insightRow} style={{ marginTop: "1.5rem" }}>
            <div className={styles.insightCard}>
              <div className={styles.insightCardTitle}><Zap size={14} /> Top Opportunity</div>
              <p className={styles.insightCardBody}>
                Only <strong>Cubigo</strong> and <strong>Icon</strong> excel at family communication. Assistedly can own this space with a "Family Dashboard" linking families to facilities.
              </p>
            </div>
            <div className={styles.insightCard}>
              <div className={styles.insightCardTitle}><TrendingUp size={14} /> Market Position</div>
              <p className={styles.insightCardBody}>
                Assistedly sits in the <strong>consumer marketplace</strong> quadrant. Competitors span clinical SaaS, home care networks, and caregiver support — validating the market's breadth.
              </p>
            </div>
            <div className={styles.insightCard}>
              <div className={styles.insightCardTitle}><Lightbulb size={14} /> Recommended Action</div>
              <p className={styles.insightCardBody}>
                Prioritize <strong>mobile-first experience</strong> and <strong>family communication tools</strong>. These are underserved relative to clinical operations features competitors have built.
              </p>
            </div>
          </div>

          {/* ── Charts Row 1: Heatmap + Landscape ── */}
          <div className={styles.section}>
            {/* Shared legend — stable color per platform */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.4rem 1rem", marginBottom: "0.75rem", padding: "0.5rem 1rem", background: "var(--white)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
              {platformNames.slice(0, 8).map((name) => {
                const color = platformColorMap[name];
                return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "#555" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontWeight: name === "Assistedly" ? 700 : 400 }}>{name}</span>
                </div>
              );
              })}
            </div>
            <div className={styles.grid2}>
              {/* <KpiCards /> */}
              {/* <FeatureComparisonChart radarData={radarData} platformColorMap={platformColorMap} platformNames={platformNames} isLoading={false} /> */}
              <MarketLandscapeMap landscapeData={landscapeData} platformColorMap={platformColorMap} isLoading={false} />
            </div>
          </div>

          {/* ── Charts Row 2: Funding + Ratings ── */}
          <div className={styles.section}>
            <div className={styles.grid2}>
              {/* Funding Bar Chart */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}><DollarSign size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />Funding by Competitor ($M)</h3>
                </div>
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={fundingData} layout="vertical" margin={{ left: 90, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#999" }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#333" }} width={90} />
                      <ReTooltip formatter={(v) => [`$${v}M`, "Funding"]} />
                      <Bar dataKey="funding" radius={[0, 6, 6, 0]}>
                        {fundingData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.name === "Honor" || entry.name === "Papa" ? BURGUNDY : entry.name === "Birdie" || entry.name === "August Health" ? BRAND : GOLD} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Ratings Bar Chart */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}><Star size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />Avg Rating by Competitor</h3>
                </div>
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={ratingData} layout="vertical" margin={{ left: 90, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: "#999" }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#333" }} width={90} />
                      <ReTooltip formatter={(v) => [v.toFixed(1), "Rating"]} />
                      <Bar dataKey="rating" radius={[0, 6, 6, 0]}>
                        {ratingData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.rating >= 4.8 ? BRAND : entry.rating >= 4.4 ? GOLD : entry.rating >= 4.0 ? "#93c5fd" : "#d4d4d8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* ── Timeline + Competitor Table ── */}
          <div className={styles.section}>
            <div className={styles.grid2}>
              <TrendTimeline timelineData={timelineData} isLoading={false} />

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}><Target size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />Competitor Profiles</h3>
                  <span style={{ fontSize: "0.78rem", color: "#999" }}>{competitors?.length || 0} total</span>
                </div>
                {competitors?.length > 0 ? (
                  <div>
                    <table className={styles.compTable}>
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Category</th>
                          <th>Funding</th>
                          <th>Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {competitors.map((comp, idx) => {
                          const notes = (comp.notes || "").toLowerCase();
                          let badge = styles.compBadgeNiche;
                          if (notes.includes("billion") || notes.includes("unicorn")) badge = styles.compBadgeLeader;
                          else if (notes.includes("$44m") || notes.includes("$62") || notes.includes("$31m")) badge = styles.compBadgeChallenger;
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, color: "#333" }}>
                                <a href={comp.url} target="_blank" rel="noopener noreferrer" style={{ color: "#333", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  {comp.name} <ExternalLink size={10} />
                                </a>
                              </td>
                              <td><span className={`${styles.compBadge} ${badge}`}>{comp.category || "—"}</span></td>
                              <td style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>{comp.funding || "—"}</td>
                              <td style={{ fontWeight: 600, color: parseRating(comp.rating) >= 4.5 ? "#16a34a" : "#333" }}>{comp.rating || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={<Target size={36} />} title="No competitor data" />
                )}
              </div>
            </div>
          </div>

          {/* ── Features Detail ── */}
          <div className={styles.section}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}><Lightbulb size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />Feature Intelligence</h3>
                <span style={{ fontSize: "0.82rem", color: "#999" }}>{features?.length || 0} features</span>
              </div>
              {features?.length > 0 ? (
                <div>
                  {features.map((f, idx) => (
                    <div key={idx} style={{ borderTop: idx > 0 ? "1px solid #e6e6e9" : "none", padding: "1rem 0" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                        <span className={styles.featureTag} style={{ flexShrink: 0 }}><Lightbulb size={13} /> Feature</span>
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: "0.95rem", color: "#333" }}>{f.name}</strong>
                          {f.description && <p style={{ fontSize: "0.88rem", color: "#666", marginTop: "0.3rem", lineHeight: 1.55 }}>{f.description}</p>}
                          {f.recommendation && (
                            <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", color: BRAND, background: "rgba(74,124,126,0.06)", padding: "0.6rem 0.9rem", borderRadius: "8px", lineHeight: 1.5 }}>
                              💡 <strong>Recommendation:</strong> {f.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<Lightbulb size={36} />} title="No feature intelligence yet" />
              )}
            </div>
          </div>

          {/* ── Summary ── */}
          {summary && (
            <div className={styles.section}>
              <div className={styles.card}>
                <div className={styles.cardHeader}><h3 className={styles.cardTitle}><Target size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />Intelligence Summary</h3></div>
                <p style={{ fontSize: "0.92rem", color: "#666", lineHeight: 1.65 }}>{summary}</p>
              </div>
            </div>
          )}

          <div className={styles.lastUpdated}>
            Last updated: {lastUpdate || "Unknown"} · {competitors?.length || 0} competitors · {features?.length || 0} features
          </div>
        </div>
      </div>
    </>
  );
}
