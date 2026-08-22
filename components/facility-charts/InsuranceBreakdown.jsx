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
} from "recharts";
import styles from "../../styles/facility-charts/Dashboard.module.css";

const LABELS = {
  sco: "SCO (Senior Care Options)",
  pace: "PACE",
  gafc: "GAFC",
  section8: "Section 8",
  mrvp: "MRVP",
};

const COLORS = {
  sco: "#007aff",
  pace: "#34c759",
  gafc: "#ff9500",
  section8: "#af52de",
  mrvp: "#ff3b30",
};

export default function InsuranceBreakdown({ data }) {
  const counts = useMemo(() => {
    const keys = Object.keys(LABELS);
    return keys.map((k) => ({
      key: k,
      label: LABELS[k],
      count: data.filter((d) => d.insurance?.[k]).length,
      color: COLORS[k],
    }));
  }, [data]);

  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>Insurance & Subsidy Acceptance</h3>
      <p className={styles.chartSubtitle}>
        Facilities accepting public programs that lower out-of-pocket costs for families.
      </p>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={counts} layout="vertical" margin={{ top: 10, right: 30, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#888" }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#555" }} width={160} />
            <Tooltip
              formatter={(value) => [`${value} facilities`, "Count"]}
              contentStyle={{ fontSize: "0.82rem", borderRadius: "8px" }}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {counts.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
