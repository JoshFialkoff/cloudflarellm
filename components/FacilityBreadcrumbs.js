import Link from 'next/link'
import styles from '../styles/FacilityBreadcrumbs.module.css'

function ChevronSep() {
  return (
    <span className={styles.sep} aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
        <path
          fill="currentColor"
          d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"
        />
      </svg>
    </span>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" focusable="false" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3H8v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z"
      />
    </svg>
  )
}

export default function FacilityBreadcrumbs({ items = [] }) {
  if (!items.length) return null

  return (
    <nav className={styles.nav} aria-label="Breadcrumb">
      <ol className={styles.list}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const isHome = index === 0 && item.label === 'Home'

          return (
            <li key={`${item.label}-${index}`} className={styles.item}>
              {index > 0 ? <ChevronSep /> : null}
              {isLast || !item.href ? (
                <span className={styles.current} aria-current="page" title={item.label}>
                  {isHome ? (
                    <span className={styles.homeLabel}>
                      <HomeIcon />
                      <span>Home</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </span>
              ) : (
                <Link href={item.href} className={styles.link} title={item.label}>
                  {isHome ? (
                    <span className={styles.homeLabel}>
                      <HomeIcon />
                      <span className={styles.homeText}>Home</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
