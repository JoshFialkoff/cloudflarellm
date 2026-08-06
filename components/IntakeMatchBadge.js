/**
 * IntakeMatchBadge — renders one explanation tag showing why a facility matched.
 */
import styles from './IntakeMatchBadge.module.css'

export default function IntakeMatchBadge({ tag }) {
  if (!tag) return null
  return (
    <span className={styles.badge}>
      <span className={styles.badgeIcon}>{tag.icon}</span>
      <span className={styles.badgeLabel}>{tag.label}</span>
    </span>
  )
}

export function IntakeMatchBadges({ tags = [], score }) {
  if (!tags.length && !score) return null
  return (
    <div className={styles.badgesRow}>
      {typeof score === 'number' && (
        <span className={styles.scoreChip} title="Match score">
          {score}% match
        </span>
      )}
      {tags.slice(0, 3).map((tag) => (
        <IntakeMatchBadge key={tag.key} tag={tag} />
      ))}
    </div>
  )
}
