import styles from "../../styles/admin/Dashboard.module.css";

export default function LoadingSkeleton() {
  return (
    <>
      {/* KPI row skeleton */}
      <div className={styles.kpiRow}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${styles.skeleton} ${styles.skeletonKpi}`} />
        ))}
      </div>

      {/* Chart grid skeleton */}
      <div className={styles.section}>
        <div className={styles.grid2}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.skeleton} style={{ width: "60%", height: "1.3rem" }} />
            </div>
            <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.skeleton} style={{ width: "55%", height: "1.3rem" }} />
            </div>
            <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
          </div>
        </div>
      </div>

      {/* Timeline + insight skeleton */}
      <div className={styles.section}>
        <div className={styles.grid2}>
          <div className={styles.card}>
            <div>
              <div className={styles.skeleton} style={{ width: "40%", height: "1.2rem", marginBottom: "1rem" }} />
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ marginBottom: "1.25rem" }}>
                  <div className={styles.skeleton} style={{ width: "30%", height: "0.8rem", marginBottom: "0.4rem" }} />
                  <div className={styles.skeleton} style={{ width: "70%", height: "0.95rem" }} />
                </div>
              ))}
            </div>
          </div>
          <div className={styles.card}>
            <div>
              <div className={styles.skeleton} style={{ width: "50%", height: "1.2rem", marginBottom: "1rem" }} />
              <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
