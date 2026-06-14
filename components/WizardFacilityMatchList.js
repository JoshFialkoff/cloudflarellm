'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  }))
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\*\*/g, '')
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

function itemDetails(item) {
  return [
    item.memoryCare ? { label: 'Memory care', value: item.memoryCare } : null,
    item.why ? { label: 'Why', value: item.why } : null,
    item.address ? { label: 'Address', value: item.address } : null,
    item.monthlyRange ? { label: 'Monthly range', value: item.monthlyRange } : null,
    item.careTypes?.length ? { label: 'Care types', value: item.careTypes.join(', ') } : null,
  ].filter(Boolean)
}

export default function WizardFacilityMatchList({ intro = '', items = [] }) {
  const [openKeys, setOpenKeys] = useState(() => new Set())
  const visibleItems = items.slice(0, MAX_MATCHES)

  const toggle = (key) => {
    setOpenKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (visibleItems.length === 0) return null

  return (
    <div className={styles.wrap}>
      {intro ? <p className={styles.intro}>{intro}</p> : null}
      <ol className={styles.list}>
        {visibleItems.map((item, index) => {
          const key = `${item.title}-${index}`
          const open = openKeys.has(key)
          const details = itemDetails(item)

          return (
            <li key={key} className={styles.row}>
              <button
                type="button"
                className={styles.toggle}
                aria-expanded={open}
                aria-label={open ? 'Hide facility details' : 'Show facility details'}
                onClick={() => toggle(key)}
              >
                <span className={styles.index}>{index + 1}</span>
                <span className={styles.title}>{item.title}</span>
                <ChevronIcon open={open} />
              </button>
              {open ? (
                <div className={styles.panel}>
                  {details.length > 0 ? (
                    details.map((detail) => (
                      <p key={detail.label} className={styles.detail}>
                        <span className={styles.detailLabel}>{detail.label}: </span>
                        {detail.value}
                      </p>
                    ))
                  ) : (
                    <p className={styles.detail}>Tap a facility name above anytime to expand details here.</p>
                  )}
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
