import React, { useState, useMemo } from "react";
import styles from "../../styles/facility-charts/Dashboard.module.css";

const SORTS = [
  { key: "safetyScore", label: "Safety" },
  { key: "careDepthScore", label: "Care Depth" },
  { key: "avgFee", label: "Avg Fee" },
  { key: "occupancyRate", label: "Occupancy" },
  { key: "stabilityScore", label: "Stability" },
  { key: "insuranceCount", label: "Insurance Programs" },
];

function Badge({ children, type }) {
  const classMap = {
    nonprofit: styles.badgeGreen,
    forprofit: styles.badgeOrange,
    insurance: styles.badgeBlue,
    memory: styles.badgePurple,
    transport: styles.badgeGreen,
  };
  return <span className={`${styles.badge} ${classMap[type] || styles.badgeBlue}`}>{children}</span>;
}

function ScoreBar({ score, warn }) {
  return (
    <div className={styles.scoreBarWrap}>
      <div
        className={`${styles.scoreBarFill} ${warn ? styles.scoreBarFillWarn : ""}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

export default function InteractiveTable({
  data,
  defaultSortKey = "safetyScore",
  defaultSortDir = "desc",
  extraSorts = [],
  onSortChange,
  onFacilityClick,
}) {
  const allSorts = useMemo(() => {
    if (!extraSorts || extraSorts.length === 0) return SORTS;
    return [...extraSorts, ...SORTS];
  }, [extraSorts]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir);

  const filtered = useMemo(() => {
    let rows = data.filter(
      (d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.city.toLowerCase().includes(search.toLowerCase())
    );
    rows.sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows.slice(0, 50);
  }, [data, search, sortKey, sortDir]);

  return (
    <div className={styles.tableCard}>
      <h3 className={styles.chartTitle}>Interactive Facility Explorer</h3>
      <p className={styles.chartSubtitle}>
        Sort and filter by the factors that matter most to your family. Top 50 shown.
      </p>

      <div className={styles.tableControls}>
        <input
          className={styles.tableSearch}
          placeholder="Search by facility name or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {allSorts.map((s) => (
          <button
            key={s.key}
            className={`${styles.sortBtn} ${sortKey === s.key ? styles.sortBtnActive : ""}`}
            onClick={() => {
              let newDir;
              let newKey;
              if (sortKey === s.key) {
                newDir = sortDir === "asc" ? "desc" : "asc";
                setSortDir(newDir);
                newKey = sortKey;
              } else {
                newKey = s.key;
                newDir = "desc";
                setSortKey(newKey);
                setSortDir(newDir);
              }
              if (onSortChange) {
                onSortChange(newKey, newDir);
              }
            }}
          >
            {s.label} {sortKey === s.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </button>
        ))}
      </div>

      <table className={styles.facilityTable}>
        <thead>
          <tr>
            <th>Facility</th>
            <th>City</th>
            <th>Tax Status</th>
            <th>Memory Care</th>
            <th>Avg Fee</th>
            <th>Occupancy</th>
            <th>Safety</th>
            <th>Care Depth</th>
            <th>Insurance</th>
            <th>Transport</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((d) => (
            <tr
              key={d.id}
              style={{ cursor: onFacilityClick ? 'pointer' : 'default' }}
              onClick={() => onFacilityClick && onFacilityClick(d)}
            >
              <td style={{ fontWeight: 600, color: "#1a1a2e" }}>{d.name}</td>
              <td>{d.city}</td>
              <td>
                <Badge type={d.taxStatus === "Not-for-profit" ? "nonprofit" : "forprofit"}>
                  {d.taxStatus === "Not-for-profit" ? "Non-Profit" : "For-Profit"}
                </Badge>
              </td>
              <td>
                {d.scrUnits ? (
                  <Badge type="memory">{d.scrUnits} SCR</Badge>
                ) : (
                  <span style={{ color: "#aaa", fontSize: "0.78rem" }}>—</span>
                )}
              </td>
              <td>
                <div className={styles.priceCell}>
                  {d.avgFee ? `$${d.avgFee.toLocaleString()}` : "N/A"}
                </div>
                <div className={styles.priceRange}>
                  {d.feeLow && d.feeHigh
                    ? `$${d.feeLow.toLocaleString()} – $${d.feeHigh.toLocaleString()}`
                    : ""}
                </div>
              </td>
              <td>
                {d.occupancyRate != null ? (
                  <>
                    <div style={{ fontWeight: 700 }}>{d.occupancyRate}%</div>
                    <ScoreBar score={d.occupancyRate} />
                  </>
                ) : (
                  <span style={{ color: "#aaa" }}>—</span>
                )}
              </td>
              <td>
                <div style={{ fontWeight: 700 }}>{d.safetyScore}/100</div>
                <ScoreBar score={d.safetyScore} warn={d.safetyScore < 40} />
              </td>
              <td>
                <div style={{ fontWeight: 700 }}>{d.careDepthScore}/100</div>
                <ScoreBar score={d.careDepthScore} warn={d.careDepthScore < 30} />
              </td>
              <td>
                {d.insuranceCount > 0 ? (
                  <Badge type="insurance">{d.insuranceCount} program{d.insuranceCount > 1 ? "s" : ""}</Badge>
                ) : (
                  <span style={{ color: "#aaa", fontSize: "0.78rem" }}>Private pay</span>
                )}
              </td>
              <td>
                {d.hasTransportMedical ? (
                  <Badge type="transport">Medical ✓</Badge>
                ) : (
                  <span style={{ color: "#aaa", fontSize: "0.78rem" }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <div className={styles.emptyState}>No facilities match your search.</div>
      )}
    </div>
  );
}
