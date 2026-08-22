import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import styles from "../../styles/facility-charts/Dashboard.module.css";

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#fff", border: "1px solid #e6e6e9", borderRadius: "8px", padding: "0.6rem 0.9rem", fontSize: "0.82rem" }}>
      <p style={{ fontWeight: 700, marginBottom: "0.2rem", color: "#1a1a2e" }}>{d.label}</p>
      <p style={{ margin: 0, color: "#555" }}>{d.count} facilities</p>
    </div>
  );
}

const BUCKETS = [
  { label: "0-20", min: 0, max: 20, count: 0, color: "#ff3b30" },
  { label: "21-40", min: 21, max: 40, count: 0, color: "#ff9500" },
  { label: "41-60", min: 41, max: 60, count: 0, color: "#ffcc00" },
  { label: "61-80", min: 61, max: 80, count: 0, color: "#34c759" },
  { label: "81-100", min: 81, max: 100, count: 0, color: "#007aff" },
];

export default function SafetyScoreChart({ data, activeRange, onBarClick }) {
  const buckets = useMemo(() => {
    const b = BUCKETS.map((bb) => ({ ...bb }));
    data.forEach((d) => {
      const score = d.safetyScore || 0;
      const bucket = b.find((bb) => score >= bb.min && score <= bb.max);
      if (bucket) bucket.count++;
    });
    return b;
  }, [data]);

  const isActive = (bucket) => {
    if (!activeRange) return false;
    return bucket.min === activeRange.min && bucket.max === activeRange.max;
  };

  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>Safety Score Distribution</h3>
      <p className={styles.chartSubtitle}>
        Based on video surveillance, backup generators, EMR usage, and transportation. Click a bar to filter results.
      </p>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={buckets} margin={{ top: 10, right: 20, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888" }} />
            <YAxis tick={{ fontSize: 11, fill: "#888" }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="count"
              radius={[6, 6, 0, 0]}
              cursor="pointer"
            >
              {buckets.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.color}
                  stroke={isActive(entry) ? "#1a1a2e" : "transparent"}
                  strokeWidth={isActive(entry) ? 3 : 0}
                  opacity={activeRange && !isActive(entry) ? 0.45 : 1}
                  onClick={() => {
                    if (onBarClick) {
                      // Toggle off if already active
                      if (isActive(entry)) {
                        onBarClick({ min: null, max: null });
                      } else {
                        onBarClick({ min: entry.min, max: entry.max });
                      }
                    }
                  }}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
