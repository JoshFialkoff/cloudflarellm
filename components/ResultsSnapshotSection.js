'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import WizardFacilityMatchList, { snapshotFacilitiesToMatchItems } from './WizardFacilityMatchList'
import styles from '../styles/Tools.module.css'
import growthStyles from '../styles/GrowthMvp.module.css'

const PENDING_SNAPSHOT_KEY = 'assistedly_pending_snapshot'

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

function WizardSearchSnapshot({ snapshot }) {
  const inputs = snapshot.inputs || {}
  const rankedFacilities = snapshot.results?.rankedFacilities || []

  return (
    <div className={styles.resultDataPanel}>
      <div className={styles.resultDataHeader}>
        <p className={styles.resultLabel}>Your saved matches</p>
        <h2>{snapshot.title}</h2>
        {snapshot.createdAt ? <small>Saved {formatDate(snapshot.createdAt)}</small> : null}
      </div>

      <WizardFacilityMatchList
        intro={inputs.summaryIntro || (inputs.location ? `Search area: ${inputs.location}` : '')}
        items={snapshotFacilitiesToMatchItems(rankedFacilities)}
      />

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
