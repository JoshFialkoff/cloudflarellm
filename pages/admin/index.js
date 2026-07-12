import Head from "next/head";
import { LayoutDashboard, AlertTriangle, ExternalLink } from "lucide-react";

export default function AdminPage() {
  const now = new Date();
  return (
    <>
      <Head>
        <title>Assistedly.ai Admin Dashboard</title>
      </Head>
      <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", color: "#333" }}>
        <h1 style={{ margin: "0 0 0.5rem" }}>
          <LayoutDashboard size={22} style={{ verticalAlign: "middle", marginRight: "0.5rem" }} />
          Assistedly.ai Admin Dashboard
        </h1>
        <p style={{ color: "#666", margin: "0 0 2rem" }}>
          Production health and monitoring hub.{" "}
          <em>Last refreshed: {now.toLocaleString()}</em>
        </p>

        <div
          style={{
            border: "1px solid #e6e6e9",
            borderRadius: 10,
            padding: "1.5rem",
            background: "#f9f6f2",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ margin: "0 0 0.75rem" }}>
            <AlertTriangle size={18} style={{ verticalAlign: "middle", marginRight: "0.5rem", color: "#c4956a" }} />
            Admin UI Under Construction
          </h3>
          <p style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>
            The full admin dashboard (KPI cards, feature comparison charts, market landscape
            map, trend timeline) is being re-synced from a feature branch. In the meantime,
            these endpoints remain available for programmatic access:
          </p>
          <ul style={{ lineHeight: 1.8 }}>
            <li>
              <strong>Bot Health:</strong>{" "}
              <a href="/api/admin/bot-health" style={{ color: "#4a7c7e" }}>
                /api/admin/bot-health
              </a>
            </li>
            <li>
              <strong>Firecrawl Data:</strong>{" "}
              <a href="/api/admin/firecrawl-data" style={{ color: "#4a7c7e" }}>
                /api/admin/firecrawl-data
              </a>
            </li>
            <li>
              <strong>Health Check:</strong>{" "}
              <a href="/api/health" style={{ color: "#4a7c7e" }}>
                /api/health
              </a>
            </li>
          </ul>
        </div>

        <a
          href="https://assistedly.ai/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#4a7c7e",
            textDecoration: "none",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <ExternalLink size={16} /> Visit Assistedly.ai Homepage
        </a>
      </div>
    </>
  );
}
