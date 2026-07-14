import styles from "../../styles/admin/Dashboard.module.css";

export default function EmptyState({ icon, title, text }) {
  return (
    <div className={styles.emptyState}>
      {icon && <div className={styles.emptyStateIcon}>{icon}</div>}
      {title && <h3 className={styles.emptyStateTitle}>{title}</h3>}
      {text && <p className={styles.emptyStateText}>{text}</p>}
    </div>
  );
}
