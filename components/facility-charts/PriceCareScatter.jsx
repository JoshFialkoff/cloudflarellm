import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import styles from "../../styles/facility-charts/Dashboard.module.css";

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e6e6e9",
        borderRadius: "8px",
        padding: "0.75rem 1rem",
        fontSize: "0.82rem",
        maxWidth: 260,
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: "0.35rem", color: "#1a1a2e" }}>
        {d.name}
      </p>
      <p style={{ margin: "0.1rem 0", color: "#555" }}>
        City: <strong>{d.city}</strong>
      </p>
      <p style={{ margin: "0.1rem 0", color: "#555" }}>
        Avg Fee: <strong>${d.avgFee?.toLocaleString()}/mo</strong>
      </p>
      <p style={{ margin: "0.1rem 0", color: "#555" }}>
        Care Depth: <strong>{d.careDepthScore}/100</strong>
      </p>
      <p style={{ margin: "0.1rem 0", color: "#555" }}>
        Safety: <strong>{d.safetyScore}/100</strong>
      </p>
      <p style={{ margin: "0.1rem 0", color: "#555" }}>
        Occupancy: <strong>{d.occupancyRate}%</strong>
      </p>
      <p style={{ margin: "0.1rem 0", color: "#555" }}>
        Tax Status: <strong>{d.taxStatus}</strong>
      </p>
    </div>
  );
}

export default function PriceCareScatter({ data }) {
  const points = data
    .filter((d) => d.avgFee && d.careDepthScore)
    .map((d) => ({
      ...d,
      x: d.avgFee,
      y: d.careDepthScore,
      z: d.safetyScore || 50,
    }));

  const avgFee = points.length
    ? Math.round(points.reduce((a, d) => a + d.x, 0) / points.length)
    : 0;
  const avgCare = points.length
    ? Math.round(points.reduce((a, d) => a + d.y, 0) / points.length)
    : 0;

  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>Price vs. Care Depth</h3>
      <p className={styles.chartSubtitle}>
        Explore facilities by monthly cost and clinical capability. Larger bubbles = higher safety score.
      </p>
      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
            <XAxis
              type="number"
              dataKey="x"
              name="Avg Monthly Fee"
              tick={{ fontSize: 11, fill: "#888" }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              label={{ value: "Avg Monthly Fee →", position: "bottom", offset: -5, style: { fontSize: 12, fill: "#666" } }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Care Depth Score"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#888" }}
              label={{ value: "Care Depth →", angle: -90, position: "insideLeft", offset: 0, style: { fontSize: 12, fill: "#666" } }}
            />
            <ZAxis type="number" dataKey="z" range={[40, 200]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
            <ReferenceLine x={avgFee} stroke="#ff9500" strokeDasharray="4 4" label={{ value: "Avg Price", position: "top", fontSize: 11, fill: "#ff9500" }} />
            <ReferenceLine y={avgCare} stroke="#007aff" strokeDasharray="4 4" label={{ value: "Avg Care", position: "right", fontSize: 11, fill: "#007aff" }} />
            <Scatter name="Facilities" data={points} fill="#007aff" fillOpacity={0.55} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
