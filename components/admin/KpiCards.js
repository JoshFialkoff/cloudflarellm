import { TrendingUp, TrendingDown, BarChart3, Users, Lightbulb, Target } from "lucide-react";
import styles from "../../styles/admin/Dashboard.module.css";

const KPI_DEFINITIONS = [
  {
    key: "totalFeatures",
    label: "Features Tracked",
    icon: BarChart3,
    iconClass: "kpiCardIconTeal",
    format: (v) => v,
  },
  {
    key: "totalCompetitors",
    label: "Competitors Monitored",
    icon: Users,
    iconClass: "kpiCardIconPlum",
    format: (v) => v,
  },
  {
    key: "marketSaturationScore",
    label: "Market Saturation",
    icon: Target,
    iconClass: "kpiCardIconGold",
    format: (v) => `${v}%`,
  },
  {
    key: "assistedlyFeatureCount",
    label: "Assistedly Features",
    icon: Lightbulb,
    iconClass: "kpiCardIconGreen",
    format: (v) => v,
  },
];

export default function KpiCards({ analytics, isLoading }) {
  if (isLoading) {
    return (
      <div className={styles.kpiRow}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${styles.skeleton} ${styles.skeletonKpi}`} />
        ))}
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className={styles.kpiRow}>
      {KPI_DEFINITIONS.map((kpi) => {
        const Icon = kpi.icon;
        const value = analytics[kpi.key] ?? 0;
        const trend = analytics[`${kpi.key}Trend`];

        return (
          <div key={kpi.key} className={styles.kpiCard}>
            <div className={styles.kpiCardHeader}>
              <div className={`${styles.kpiCardIcon} ${styles[kpi.iconClass]}`}>
                <Icon size={20} />
              </div>
              <span className={styles.kpiCardLabel}>{kpi.label}</span>
            </div>
            <div className={styles.kpiCardValue}>{kpi.format(value)}</div>
            {trend !== undefined && (
              <div
                className={`${styles.kpiCardTrend} ${
                  trend >= 0 ? styles.kpiCardTrendUp : styles.kpiCardTrendDown
                }`}
              >
                {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {trend > 0 ? `+${trend}%` : `${trend}%`} vs last audit
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
