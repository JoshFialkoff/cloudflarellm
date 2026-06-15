'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { enrichWizardMatchItems } from '../lib/wizardFacilityInsights'
import styles from './WizardFacilityMatchList.module.css'

const MAX_MATCHES = 3

function formatTownLabel(town) {
  if (!town) return ''
  return String(town)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function snapshotFacilitiesToMatchItems(facilities) {
  return (facilities || []).map((facility) => ({
    title: facility.town ? `${facility.name} — ${formatTownLabel(facility.town)}` : facility.name,
    memoryCare: facility.memoryCare || (facility.careTypes?.includes('Memory Care') ? 'Yes' : ''),
    why: facility.why || '',
    slug: facility.slug || '',
    address: facility.address || '',
    careTypes: facility.careTypes || [],
    monthlyRange:
      facility.monthlyMin || facility.monthlyMax
        ? `$${Number(facility.monthlyMin || 0).toLocaleString()}–$${Number(facility.monthlyMax || 0).toLocaleString()}/mo`
        : '',
    safetyScore: facility.safetyScore || null,
  }))
}

function ChevronIcon({ open }) {
  return (
    <span className={`${styles.expandControl} ${open ? styles.expandControlOpen : ''}`} aria-hidden="true">
      <svg className={styles.chevron} viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}

function MemoryCareCheck() {
  return (
    <span className={styles.memoryCareCheck} aria-label="Memory care available">
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 111.42-1.42l2.54 2.54 6.54-6.54a1 1 0 011.42 0z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}

function MemoryCareRow({ status }) {
  if (status === 'yes') {
    return (
      <p className={`${styles.detail} ${styles.detailFlex}`}>
        <span className={styles.detailLabel}>Memory care</span>
        <MemoryCareCheck />
      </p>
    )
  }
  if (status === 'no') {
    return (
      <p className={styles.detail}>
        <span className={styles.detailLabel}>Memory care: </span>
        Not listed
      </p>
    )
  }
  if (status === 'unknown') {
    return (
      <p className={styles.detail}>
        <span className={styles.detailLabel}>Memory care: </span>
        Ask on your tour
      </p>
    )
  }
  return null
}

function facilityNameFromTitle(title = '') {
  return String(title).split(/[—–-]/)[0].replace(/^\d+[.)]\s*/, '').trim()
}

function FacilityKbInsightBullet({ insightState }) {
  if (!insightState || insightState.status === 'idle' || insightState.status === 'empty') return null

  if (insightState.status === 'loading') {
    return (
      <p className={styles.kbInsight}>
        <span className={styles.detailLabel}>KB analysis: </span>
        <span className={styles.kbInsightLoading}>Analyzing Massachusetts facility data…</span>
      </p>
    )
  }

  return (
    <p className={styles.kbInsight}>
      <span className={styles.detailLabel}>KB analysis: </span>
      {insightState.text}
    </p>
  )
}

export default function WizardFacilityMatchList({
  intro = '',
  items = [],
  searchContext = null,
  expandFirst = false,
}) {
  const enrichedItems = enrichWizardMatchItems(items, searchContext || {})
  const visibleItems = enrichedItems.slice(0, MAX_MATCHES)
  const [openKeys, setOpenKeys] = useState(() => {
    if (!expandFirst || visibleItems.length === 0) return new Set()
    return new Set([`${visibleItems[0].title}-0`])
  })
  const [kbInsights, setKbInsights] = useState({})
  const kbControllersRef = useRef({})
  const kbRequestedRef = useRef(new Set())

  const loadKbInsight = useCallback(
    (item, rowKey) => {
      const facilityName = facilityNameFromTitle(item.title)
      if (!facilityName) return

      const cacheKey = `${rowKey}::${item.slug || facilityName}`
      if (kbRequestedRef.current.has(cacheKey)) return
      kbRequestedRef.current.add(cacheKey)

      kbControllersRef.current[cacheKey]?.abort()
      const controller = new AbortController()
      kbControllersRef.current[cacheKey] = controller

      setKbInsights((current) => ({
        ...current,
        [cacheKey]: { status: 'loading', text: '' },
      }))

      fetch('/api/facility-kb-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityName,
          slug: item.slug || '',
          careType: searchContext?.careType || '',
          location: searchContext?.location || '',
          zipCode: searchContext?.zipCode || '',
          town: item.town || '',
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}))
          if (!response.ok || !data?.insight) {
            setKbInsights((current) => ({
              ...current,
              [cacheKey]: { status: 'empty', text: '' },
            }))
            return
          }
          setKbInsights((current) => ({
            ...current,
            [cacheKey]: { status: 'done', text: String(data.insight) },
          }))
        })
        .catch((error) => {
          if (error?.name === 'AbortError') return
          setKbInsights((current) => ({
            ...current,
            [cacheKey]: { status: 'empty', text: '' },
          }))
        })
    },
    [searchContext],
  )

  const toggle = (key, item) => {
    setOpenKeys((current) => {
      const next = new Set(current)
      const willOpen = !next.has(key)
      if (willOpen) {
        next.add(key)
        loadKbInsight(item, key)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  useEffect(() => {
    if (!expandFirst || visibleItems.length === 0) return
    const firstKey = `${visibleItems[0].title}-0`
    if (!openKeys.has(firstKey)) return
    queueMicrotask(() => loadKbInsight(visibleItems[0], firstKey))
  }, [expandFirst, loadKbInsight, openKeys, visibleItems])

  if (visibleItems.length === 0) return null

  return (
    <div className={styles.wrap}>
      {intro ? <p className={styles.intro}>{intro}</p> : null}
      <ol className={styles.list}>
        {visibleItems.map((item, index) => {
          const key = `${item.title}-${index}`
          const open = openKeys.has(key)
          const insights = item.insights || []
          const insightKey = `${key}::${item.slug || facilityNameFromTitle(item.title)}`

          return (
            <li key={key} className={styles.row}>
              <button
                type="button"
                className={styles.toggle}
                aria-expanded={open}
                aria-label={open ? 'Hide facility details' : 'Show facility details'}
                onClick={() => toggle(key, item)}
              >
                <span className={styles.index}>{index + 1}</span>
                <span className={styles.titleWrap}>
                  <span className={styles.title}>{item.title}</span>
                  {item.memoryCareStatus === 'yes' ? (
                    <span className={styles.titleBadge}>
                      <MemoryCareCheck />
                      <span className={styles.titleBadgeText}>Memory care</span>
                    </span>
                  ) : null}
                </span>
                <ChevronIcon open={open} />
              </button>
              {open ? (
                <div className={styles.panel}>
                  <MemoryCareRow status={item.memoryCareStatus} />
                  {item.why ? (
                    <p className={styles.detail}>
                      <span className={styles.detailLabel}>Why this match: </span>
                      {item.why}
                    </p>
                  ) : null}
                  {insights.length > 0 ? (
                    <div className={styles.insightsBlock}>
                      <p className={styles.insightsHeading}>Facility data</p>
                      <ul className={styles.insightsList}>
                        {insights.map((insight) => (
                          <li key={insight.label}>
                            <span className={styles.detailLabel}>{insight.label}: </span>
                            {insight.value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <FacilityKbInsightBullet insightState={kbInsights[insightKey]} />
                  {item.phone ? (
                    <p className={styles.detail}>
                      <span className={styles.detailLabel}>Phone: </span>
                      <a href={`tel:${item.phone.replace(/\D/g, '')}`} className={styles.phoneLink}>
                        {item.phone}
                      </a>
                    </p>
                  ) : null}
                  {item.address ? (
                    <p className={styles.detail}>
                      <span className={styles.detailLabel}>Address: </span>
                      {item.address}
                    </p>
                  ) : null}
                  {item.monthlyRange ? (
                    <p className={styles.detail}>
                      <span className={styles.detailLabel}>Monthly range: </span>
                      {item.monthlyRange}
                    </p>
                  ) : null}
                  {item.slug ? (
                    <Link href={`/facility/${item.slug}`} className={styles.profileLink}>
                      View full facility profile
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export { MAX_MATCHES }
