'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from '../styles/Tools.module.css'
import growthStyles from '../styles/GrowthMvp.module.css'

const PENDING_SNAPSHOT_KEY = 'assistedly_pending_snapshot'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatTownLabel(town) {
  if (!town) return ''
  return String(town)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function WizardSearchSnapshot({ snapshot }) {
  const inputs = snapshot.inputs || {}
  const rankedFacilities = snapshot.results?.rankedFacilities || []

  return (
    <div className={styles.resultDataPanel}>
      <div className={styles.resultDataHeader}>
        <p className={styles.resultLabel}>Your saved matches</p>
        <h2>{snapshot.title}</h2>
        {inputs.summaryIntro ? <p className={styles.heroCopy}>{inputs.summaryIntro}</p> : null}
        {!inputs.summaryIntro && inputs.location ? <p>Search area: {inputs.location}</p> : null}
        {snapshot.createdAt ? <small>Saved {formatDate(snapshot.createdAt)}</small> : null}
      </div>

      <div className={styles.savedFacilityList}>
        {rankedFacilities.map((facility) => (
          <article key={facility.slug || facility.name} className={styles.savedFacilityCard}>
            <div>
              <h3>
                {facility.name}
                {facility.town ? ` — ${formatTownLabel(facility.town)}` : ''}
              </h3>
              {facility.address ? <p>{facility.address}</p> : null}
              {facility.memoryCare ? <p>Memory care: {facility.memoryCare}</p> : null}
              {!facility.memoryCare && facility.careTypes?.length ? (
                <small>{facility.careTypes.join(', ')}</small>
              ) : null}
            </div>
            {facility.slug ? (
              <div>
                {facility.safetyScore ? <strong>{facility.safetyScore}/100</strong> : null}
                {(facility.monthlyMin || facility.monthlyMax) ? (
                  <span>
                    {currency.format(facility.monthlyMin || 0)} - {currency.format(facility.monthlyMax || 0)}/mo
                  </span>
                ) : null}
                <Link href={`/facility/${facility.slug}`} className={styles.primaryCta}>
                  View facility
                </Link>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className={styles.resultDataActions}>
        <Link href="/#assistant" className={styles.primaryCta}>Start a new search</Link>
      </div>
    </div>
  )
}

function SnapshotBody({ snapshot }) {
  if (!snapshot) return null
  if (snapshot.kind === 'wizard_search') return <WizardSearchSnapshot snapshot={snapshot} />
  return null
}

export default function ResultsSnapshotSection({ authenticated, serverSnapshot }) {
  const [snapshot, setSnapshot] = useState(serverSnapshot)

  useEffect(() => {
    if (snapshot || !authenticated || typeof window === 'undefined') return

    let cancelled = false
    const hydrate = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json().catch(() => ({}))
        if (!cancelled && data.resultSnapshot) {
          setSnapshot(data.resultSnapshot)
          return
        }
      } catch {
        // fall through to localStorage
      }

      try {
        const raw = window.localStorage.getItem(PENDING_SNAPSHOT_KEY)
        if (!raw || cancelled) return
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') setSnapshot(parsed)
      } catch {
        // ignore invalid cache
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [authenticated, snapshot])

  if (!authenticated) return null

  if (snapshot) {
    return <SnapshotBody snapshot={snapshot} />
  }

  return (
    <div className={growthStyles.gateCard}>
      <h2>No saved result snapshot yet.</h2>
      <p>Start with the budget calculator or safest-facility comparison, then send yourself a magic link to save the exact data behind those results.</p>
      <Link href="/budget" className={styles.primaryCta}>Start with budget</Link>
    </div>
  )
}

export { PENDING_SNAPSHOT_KEY }
