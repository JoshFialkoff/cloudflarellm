import { Grid3X3 } from "lucide-react";
import styles from "../../styles/admin/Dashboard.module.css";
import EmptyState from "./EmptyState";

// Heatmap: score → background opacity using the platform's assigned color
function cellStyle(score, color, isAssistedly) {
  const alpha = Math.round((score / 100) * 0.75 * 100) / 100;
  return {
    background: `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`,
    color: score > 65 ? "#fff" : "#333",
    fontWeight: isAssistedly ? 700 : 400,
    textAlign: "center",
    padding: "0.45rem 0.35rem",
    fontSize: "0.78rem",
    borderRadius: isAssistedly ? "0 0 6px 6px" : "0",
    borderBottom: isAssistedly ? "3px solid currentColor" : "none",
  };
}

export default function FeatureComparisonChart({ radarData, platformColorMap, platformNames, isLoading }) {
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

  if (!radarData?.length || !platformColorMap) {
    return (
      <div className={styles.card}>
        <EmptyState icon={<Grid3X3 size={36} />} title="No data" />
      </div>
    );
  }

  const platforms = platformNames && platformNames.length > 0
    ? platformNames
    : Object.keys(platformColorMap);
  if (platforms.length === 0) return null;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          <Grid3X3 size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Feature Comparison Heatmap
        </h3>
        <span style={{ fontSize: "0.72rem", color: "#bbb" }}>
          darker = higher score
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.4rem 0.5rem", color: "#999", fontWeight: 600, fontSize: "0.7rem", width: 130 }}>Category</th>
              {platforms.map((p) => (
                <th key={p} style={{ textAlign: "center", padding: "0.4rem 0.25rem", color: platformColorMap[p], fontWeight: 700, fontSize: "0.7rem", whiteSpace: "nowrap", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p === "Assistedly" ? "★ Assistedly" : p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {radarData.map((row, ri) => (
              <tr key={ri}>
                <td style={{ padding: "0.45rem 0.5rem", color: "#333", fontWeight: 600, borderBottom: "1px solid #f0f0f0" }}>
                  {row.category}
                </td>
                {platforms.map((p) => {
                  const score = row[p] || 0;
                  return (
                    <td key={p} style={cellStyle(score, platformColorMap[p], p === "Assistedly")}>
                      {score}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
