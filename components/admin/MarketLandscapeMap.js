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
  Cell,
} from "recharts";
import { MapIcon } from "lucide-react";
import styles from "../../styles/admin/Dashboard.module.css";
import EmptyState from "./EmptyState";

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#fff", border: "1px solid #e6e6e9", borderRadius: "8px", padding: "0.75rem 1rem", fontSize: "0.82rem" }}>
      <p style={{ fontWeight: 700, marginBottom: "0.25rem", color: "#333" }}>{d.name}</p>
      <p style={{ margin: 0, color: "#666" }}>Ease of Use: <strong>{d.easeOfUse}</strong></p>
      <p style={{ margin: 0, color: "#666" }}>Feature Depth: <strong>{d.featureDepth}</strong></p>
    </div>
  );
}

export default function MarketLandscapeMap({ landscapeData, platformColorMap, isLoading }) {
  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.skeleton} style={{ width: "60%", height: "1.3rem" }} />
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
      </div>
    );
  }

  const hasData = landscapeData && landscapeData.length > 0;

  // Assign color from shared map, fall back to grey
  const data = hasData
    ? landscapeData.map((d) => ({
        ...d,
        color: (platformColorMap && platformColorMap[d.name]) || "#999",
      }))
    : [];

  // Auto-scale domain
  const xMin = hasData ? Math.min(...data.map((d) => d.easeOfUse)) : 0;
  const xMax = hasData ? Math.max(...data.map((d) => d.easeOfUse)) : 100;
  const yMin = hasData ? Math.min(...data.map((d) => d.featureDepth)) : 0;
  const yMax = hasData ? Math.max(...data.map((d) => d.featureDepth)) : 100;
  const xPad = Math.max(8, (xMax - xMin) * 0.12);
  const yPad = Math.max(8, (yMax - yMin) * 0.12);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          <MapIcon size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Market Landscape
        </h3>
        <span style={{ fontSize: "0.75rem", color: "#999" }}>
          {hasData ? `${data.length} platforms` : ""}
        </span>
      </div>
      {hasData ? (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 20, right: 25, bottom: 35, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
              <ReferenceLine x={50} stroke="#ddd" strokeDasharray="3 3" />
              <ReferenceLine y={50} stroke="#ddd" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="easeOfUse"
                domain={[Math.max(0, xMin - xPad), Math.min(100, xMax + xPad)]}
                tick={{ fontSize: 11, fill: "#888" }}
                label={{ value: "Ease of Use →", position: "bottom", offset: -5, style: { fontSize: 12, fill: "#666" } }}
              />
              <YAxis
                type="number"
                dataKey="featureDepth"
                domain={[Math.max(0, yMin - yPad), Math.min(100, yMax + yPad)]}
                tick={{ fontSize: 11, fill: "#888" }}
                label={{ value: "Feature Depth →", angle: -90, position: "insideLeft", offset: 0, style: { fontSize: 12, fill: "#666" } }}
              />
              <ZAxis type="number" dataKey="size" range={[80, 220]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
              <Scatter name="platforms" data={data}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} stroke={entry.color} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          {/* Legend removed — now shared between both charts */}
        </div>
      ) : (
        <EmptyState icon={<MapIcon size={36} />} title="No landscape data yet" />
      )}
    </div>
  );
}
