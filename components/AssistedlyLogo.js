import Link from 'next/link'
import styles from '../styles/AssistedlyLogo.module.css'

const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'

export default function AssistedlyLogo({
  href = '/',
  size = 'md',
  showWordmark = true,
  className = '',
}) {
  const rootClass = [styles.logo, styles[`size${size.charAt(0).toUpperCase()}${size.slice(1)}`], className]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <span className={styles.mark} aria-hidden="true">
        <svg className={styles.heart} viewBox="0 0 24 24" width="24" height="24" focusable="false">
          <path fill="currentColor" d={HEART_PATH} />
        </svg>
      </span>
      {showWordmark ? (
        <span className={styles.wordmark}>
          Assistedly<span className={styles.wordmarkDot}>.</span>ai
        </span>
      ) : null}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={rootClass} aria-label="Assistedly.ai home">
        {content}
      </Link>
    )
  }

  return <span className={rootClass}>{content}</span>
}
