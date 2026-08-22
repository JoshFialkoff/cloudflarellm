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

export default function OccupancyBarChart({ data }) {
  const chartData = useMemo(() => {
    return data
      .filter((d) => d.occupancyRate)
      .sort((a, b) => b.occupancyRate - a.occupancyRate)
      .slice(0, 20)
      .map((d) => ({
        name: d.name.length > 28 ? d.name.slice(0, 28) + "…" : d.name,
        occupancy: d.occupancyRate,
        city: d.city,
        taxStatus: d.taxStatus,
      }));
  }, [data]);

  const avgOcc = useMemo(() => {
    const vals = data.filter((d) => d.occupancyRate).map((d) => d.occupancyRate);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [data]);

  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>Top 20 Facilities by Occupancy</h3>
      <p className={styles.chartSubtitle}>
        High occupancy often signals trust and quality. Low occupancy may mean immediate availability.
      </p>
      <div style={{ width: "100%", height: 420 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#888" }} unit="%" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#555" }} width={200} />
            <Tooltip
              formatter={(value, name, props) => [`${value}% occupied`, "Occupancy"]}
              contentStyle={{ fontSize: "0.82rem", borderRadius: "8px" }}
            />
            <ReferenceLine x={avgOcc} stroke="#ff9500" strokeDasharray="4 4" label={{ value: `MA Avg ${avgOcc}%`, position: "top", fontSize: 11, fill: "#ff9500" }} />
            <Bar dataKey="occupancy" radius={[0, 6, 6, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.occupancy >= 90 ? "#007aff" : entry.occupancy >= 75 ? "#34c759" : "#ff9500"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
