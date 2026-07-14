import { ClockIcon } from "lucide-react";
import styles from "../../styles/admin/Dashboard.module.css";
import EmptyState from "./EmptyState";

export default function TrendTimeline({ timelineData, isLoading }) {
  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.skeleton} style={{ width: "55%", height: "1.3rem" }} />
        </div>
        <div className={styles.timeline}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.timelineItem}>
              <div>
                <div className={styles.skeleton} style={{ width: "30%", height: "0.8rem", marginBottom: "0.4rem" }} />
                <div className={styles.skeleton} style={{ width: "70%", height: "1rem", marginBottom: "0.3rem" }} />
                <div className={styles.skeleton} style={{ width: "45%", height: "0.7rem" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasData = timelineData && timelineData.length > 0;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          <ClockIcon size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Trend Timeline
        </h3>
      </div>
      {hasData ? (
        <div className={styles.timeline}>
          {timelineData.map((item, idx) => (
            <div key={idx} className={styles.timelineItem}>
              <div
                className={`${styles.timelineDot} ${
                  item.impact === "high" ? styles.timelineDotHigh : ""
                }`}
              />
              <div className={styles.timelineDate}>{item.date}</div>
              <div className={styles.timelineEvent}>{item.event}</div>
              <div className={styles.timelineCompany}>{item.company}</div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ClockIcon size={36} />}
          title="No timeline data yet"
          text="Feature evolution and AgeTech milestones will appear here as data is collected."
        />
      )}
    </div>
  );
}
