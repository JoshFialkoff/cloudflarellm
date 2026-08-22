'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import posthog from '../lib/posthogClient'
import styles from '../styles/facility-charts/Dashboard.module.css'
import homeStyles from '../styles/Home.module.css'

const TABS = [
  { key: 'safest', label: 'Safest' },
  { key: 'topRated', label: 'Top Rated' },
  { key: 'mostAffordable', label: 'Most Affordable' },
  { key: 'ask', label: 'Ask Me Anything' },
]

/** Haversine distance in miles */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function computeTopRatedScore(f) {
  const safety = f.safetyScore || 0
  const careDepth = f.careDepthScore || 0
  const stability = f.stabilityScore || 0
  const occupancy = f.occupancyRate || 0
  const insurance = (f.insuranceCount || 0) * 20 // 0-100 (max 5)
  const fee = f.avgFee || f.feeLow || 8000
  const feeScore = Math.max(0, Math.min(100, 100 - fee / 100))
  return (
    safety * 0.25 +
    careDepth * 0.25 +
    stability * 0.15 +
    occupancy * 0.10 +
    insurance * 0.10 +
    feeScore * 0.15
  )
}

function ScoreBar({ score, warn }) {
  return (
    <div style={{ background: '#e6e8eb', borderRadius: 4, height: 6, width: '100%', marginTop: 4 }}>
      <div
        style={{
          background: warn ? '#ff3b30' : '#34c759',
          borderRadius: 4,
          height: 6,
          width: `${Math.max(0, Math.min(100, score))}%`,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  )
}

function InfoTip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-block', marginLeft: 4, cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      {show && (
        <span
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1a2e',
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 400,
            lineHeight: 1.35,
            padding: '0.4rem 0.55rem',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            zIndex: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}

function ColumnHeader({ scoreLabel, scoreTip }) {
  const headerCell = {
    fontSize: '0.7rem',
    color: '#aaa',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 90px 95px',
        alignItems: 'start',
        gap: '0.5rem',
        padding: '0.35rem 0.5rem',
        borderBottom: '1px solid #e6e8eb',
      }}
    >
      <span style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 600, lineHeight: 1.2 }}>#</span>
      <span style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: 600, lineHeight: 1.2 }}>Facility</span>
      <span style={{ ...headerCell, justifyContent: 'flex-end' }}>
        Monthly Fee
        <InfoTip text="Typical monthly cost reported to the state. May vary by care needs." />
      </span>
      <span style={{ ...headerCell, justifyContent: 'flex-end' }}>
        {scoreLabel}
        <InfoTip text={scoreTip} />
      </span>
    </div>
  )
}

function CiteSuperscript({ sources, field, onClickRow }) {
  if (!sources || !sources.length) return null
  const feeSources = ['eoea-alr-2025', 'self-reported']
  const scoreSources = ['cms-care-compare', 'state-inspections', 'assistedly-calculated']
  const find = (ids) => sources.find((s) => ids.some((id) => s.url && s.url.endsWith('#' + id)))
  const source = field === 'fee' ? find(feeSources) : find(scoreSources)
  if (!source) return null
  const num = field === 'fee' ? '1' : '2'
  return (
    <sup>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        title={source.label}
        onClick={(e) => {
          e.stopPropagation()
          if (onClickRow) onClickRow()
        }}
        style={{
          color: '#aaa',
          fontSize: '0.6rem',
          textDecoration: 'none',
          marginLeft: 1,
          cursor: 'pointer',
        }}
      >
        {num}
      </a>
    </sup>
  )
}

function CompactRow({ f, rank, onClick, score, scoreLabel }) {
  const isSafety = scoreLabel === 'Safety Score'
  const numericScore = score ?? 0
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 90px 95px',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 0.5rem',
        borderBottom: '1px solid #f0f0f0',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f9fb')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ fontWeight: 700, color: '#c4956a', fontSize: '0.85rem' }}>{rank}</span>
      <div>
        <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: '0.88rem', lineHeight: 1.2 }}>{f.name}</div>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>{f.city}</div>
      </div>
      <div style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, color: '#1a1a2e' }}>
        {(() => {
          const raw = f.avgFee || f.feeLow;
          if (!raw) return 'N/A';
          if (raw < 500 || raw > 25000) return `$${raw.toLocaleString()}*`;
          return `$${raw.toLocaleString()}`;
        })()}
        <CiteSuperscript sources={f.sources} field="fee" onClickRow={onClick} />
      </div>
      <div style={{ textAlign: 'right', fontSize: '0.82rem' }}>
        <span style={{ fontWeight: 700, color: isSafety ? (numericScore >= 60 ? '#34c759' : '#ff9500') : '#4a7c7e' }}>
          {numericScore}
        </span>
        <span style={{ color: '#aaa', fontSize: '0.7rem' }}>/100</span>
        <CiteSuperscript sources={f.sources} field="score" onClickRow={onClick} />
        <ScoreBar score={numericScore} warn={isSafety && numericScore < 40} />
      </div>
    </div>
  )
}

function LocationModal({
  open,
  onClose,
  cityCoordsMap,
  onPickCity,
  onUseGeolocation,
  radiusMiles,
  onRadiusChange,
}) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const cityList = useMemo(() => Object.keys(cityCoordsMap).sort(), [cityCoordsMap])

  const suggestions = useMemo(() => {
    const raw = input.trim().toLowerCase()
    if (!raw || raw.length < 1) return []
    return cityList
      .filter((c) => c.toLowerCase().startsWith(raw))
      .slice(0, 6)
  }, [input, cityList])

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInput('')
      setError('')
      setGeoLoading(false)
      setActiveIndex(-1)
    }
  }, [open])

  if (!open) return null

  const confirmCity = (city) => {
    onPickCity(city)
    onClose()
    posthog?.capture('homepage_scores_location_changed', { method: 'manual_city', city })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const raw = input.trim()
    if (!raw) return
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      confirmCity(suggestions[activeIndex])
      return
    }
    const normalized = raw.toLowerCase().replace(/,/g, '').replace(/ma$/i, '').trim()
    const match = cityList.find(
      (c) => c.toLowerCase() === normalized || c.toLowerCase().startsWith(normalized)
    )
    if (match) {
      confirmCity(match)
    } else {
      setError(`"${raw}" not found in our Massachusetts database. Try a nearby town.`)
    }
  }

  const handleUseLocation = () => {
    setGeoLoading(true)
    setError('')
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported in this browser.')
      setGeoLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false)
        onUseGeolocation && onUseGeolocation(pos)
        onClose()
      },
      () => {
        setGeoLoading(false)
        setError('Unable to get your location. Please type a city name.')
      },
      { timeout: 10000, maximumAge: 600000 }
    )
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setActiveIndex(-1)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Change location"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '1.5rem',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', color: '#1a1a2e' }}>Location &amp; Search Radius</h4>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#666' }}>
          Pick a town and choose how far out to search.
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="location-input" className="sr-only">
            Town or ZIP code
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="location-input"
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setActiveIndex(-1)
                if (error) setError('')
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Lexington, Worcester, Springfield"
              autoFocus
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls="location-suggestions"
              aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
              style={{
                width: '100%',
                padding: '0.7rem 0.9rem',
                borderRadius: 10,
                border: error ? '1px solid #ff3b30' : '1px solid #d0d4db',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {suggestions.length > 0 && (
              <ul
                id="location-suggestions"
                role="listbox"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  background: '#fff',
                  border: '1px solid #e6e8eb',
                  borderRadius: 10,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                  padding: '0.35rem 0',
                  listStyle: 'none',
                  margin: 0,
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {suggestions.map((city, i) => (
                  <li
                    key={city}
                    id={`suggestion-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseLeave={() => setActiveIndex(-1)}
                    onClick={() => confirmCity(city)}
                    style={{
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.88rem',
                      color: '#333',
                      cursor: 'pointer',
                      background: i === activeIndex ? '#f0f7f7' : 'transparent',
                      fontWeight: i === activeIndex ? 600 : 400,
                      transition: 'background 0.08s',
                    }}
                  >
                    {city}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && (
            <p style={{ margin: '0.5rem 0 0.75rem', fontSize: '0.8rem', color: '#ff3b30' }}>{error}</p>
          )}
          <div style={{ margin: '0.75rem 0 0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#555', marginBottom: '0.35rem' }}>
              Search radius
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {[10, 15, 20].map((mi) => (
                <button
                  key={mi}
                  type="button"
                  onClick={() => onRadiusChange(mi)}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.6rem',
                    borderRadius: 8,
                    border: radiusMiles === mi ? '1.5px solid #4a7c7e' : '1.5px solid #d0d4db',
                    background: radiusMiles === mi ? '#f0f7f7' : '#fff',
                    color: radiusMiles === mi ? '#4a7c7e' : '#555',
                    fontSize: '0.85rem',
                    fontWeight: radiusMiles === mi ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {mi} mi
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '0.65rem 1rem',
                borderRadius: 10,
                border: 'none',
                background: '#4a7c7e',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Find Facilities
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: 10,
                border: '1px solid #d0d4db',
                background: '#f8f9fb',
                color: '#555',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
        <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleUseLocation}
            disabled={geoLoading}
            style={{
              background: 'none',
              border: 'none',
              color: '#4a7c7e',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'underline',
              opacity: geoLoading ? 0.6 : 1,
            }}
          >
            {geoLoading ? 'Detecting location…' : '📍 Use my current location'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HomeScoresTabs({
  dataUrl = '/data/chart-facilities.json',
  expanded = false,
  onExpandToggle,
}) {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('safest')
  const [userCity, setUserCity] = useState(null)
  const [userCoords, setUserCoords] = useState(null)
  const [radiusMiles, setRadiusMiles] = useState(15)
  const [askInput, setAskInput] = useState('')
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch(dataUrl)
      .then((r) => r.json())
      .then((json) => {
        setRawData(json)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [dataUrl])

  const cityCoordsMap = useMemo(() => {
    if (!rawData) return {}
    const map = {}
    rawData.facilities.forEach((f) => {
      if (f.lat != null && f.lng != null) {
        const key = f.cityClean || f.city
        if (key && !map[key]) {
          map[key] = { lat: f.lat, lng: f.lng }
        }
      }
    })
    return map
  }, [rawData])

  // Geolocation → nearest city + store coords for radius filtering
  const runGeolocation = useCallback(
    (onComplete) => {
      if (!rawData || Object.keys(cityCoordsMap).length === 0) return
      if (!('geolocation' in navigator)) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setUserCoords({ lat: latitude, lng: longitude })
          let nearest = null
          let minDist = Infinity
          for (const [city, coords] of Object.entries(cityCoordsMap)) {
            const dist = haversine(latitude, longitude, coords.lat, coords.lng)
            if (dist < minDist) {
              minDist = dist
              nearest = city
            }
          }
          if (nearest) {
            setUserCity(nearest)
            setActiveTab('safest')
            onComplete?.(nearest)
          }
        },
        () => {},
        { timeout: 8000, maximumAge: 600000 }
      )
    },
    [rawData, cityCoordsMap]
  )

  useEffect(() => {
    runGeolocation()
  }, [runGeolocation])

  const facilities = useMemo(() => {
    if (!rawData?.facilities) return []
    let rows = rawData.facilities.map((f) => ({
      ...f,
      topRatedScore: computeTopRatedScore(f),
    }))
    if (userCoords) {
      rows = rows.filter(
        (f) =>
          f.lat != null &&
          f.lng != null &&
          haversine(userCoords.lat, userCoords.lng, f.lat, f.lng) <= radiusMiles
      )
    } else if (userCity) {
      const cityKey = userCity.toLowerCase().trim()
      const cityRows = rows.filter(
        (f) => (f.cityClean || f.city || '').toLowerCase().trim() === cityKey
      )
      if (cityRows.length >= 3) rows = cityRows
    }
    return rows
  }, [rawData, userCity, userCoords, radiusMiles])

  const safest = useMemo(
    () => [...facilities].sort((a, b) => (b.safetyScore || 0) - (a.safetyScore || 0)).slice(0, 8),
    [facilities]
  )
  const topRated = useMemo(
    () => [...facilities].sort((a, b) => b.topRatedScore - a.topRatedScore).slice(0, 8),
    [facilities]
  )
  const mostAffordable = useMemo(
    () =>
      [...facilities]
        .filter((f) => f.avgFee || f.feeLow)
        .sort((a, b) => (a.avgFee || a.feeLow || Infinity) - (b.avgFee || b.feeLow || Infinity))
        .slice(0, 8),
    [facilities]
  )

  const handleFacilityClick = useCallback(
    (f) => {
      const slug = f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      router.push(`/facility/ma/${slug}`)
      posthog?.capture('facility_click', {
        facility_id: f.id,
        facility_name: f.name,
        city: f.city,
        safety_score: f.safetyScore,
        chart_source: 'homepage_scores_tabs',
      })
    },
    [router]
  )

  const handleAskSubmit = (e) => {
    e.preventDefault()
    const q = askInput.trim()
    if (!q) return
    router.push(`/ask?q=${encodeURIComponent(q)}`)
  }

  const renderList = (list) => {
    if (loading) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Loading official state data…</div>
      )
    }
    if (!list.length) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>No facilities found.</div>
      )
    }

    const scoreLabel = activeTab === 'topRated' ? 'Overall Score' : 'Safety Score'
    const scoreTip =
      activeTab === 'topRated'
        ? 'Composite rating blending safety, care depth, stability, occupancy, and value.'
        : 'State inspection safety score out of 100 based on complaints and citations history.'

    return (
      <div>
        <ColumnHeader scoreLabel={scoreLabel} scoreTip={scoreTip} />
        {list.map((f, i) => (
          <CompactRow
            key={f.id}
            f={f}
            rank={i + 1}
            onClick={() => handleFacilityClick(f)}
            score={activeTab === 'topRated' ? Math.round(f.topRatedScore ?? 0) : (f.safetyScore ?? 0)}
            scoreLabel={scoreLabel}
          />
        ))}
      </div>
    )
  }

  const locationLabel = userCity || 'Massachusetts'

  return (
    <>
      <LocationModal
        open={showModal}
        onClose={() => setShowModal(false)}
        cityCoordsMap={cityCoordsMap}
        radiusMiles={radiusMiles}
        onRadiusChange={(mi) => {
          setRadiusMiles(mi)
          posthog?.capture('homepage_scores_radius_changed', { miles: mi })
        }}
        onPickCity={(city) => {
          setUserCity(city)
          posthog?.capture('homepage_scores_location_changed', { method: 'manual_city', city })
        }}
        onUseGeolocation={({ coords }) => {
          const { latitude, longitude } = coords
          setUserCoords({ lat: latitude, lng: longitude })
          let nearest = null
          let minDist = Infinity
          for (const [city, coords] of Object.entries(cityCoordsMap)) {
            const dist = haversine(latitude, longitude, coords.lat, coords.lng)
            if (dist < minDist) {
              minDist = dist
              nearest = city
            }
          }
          if (nearest) setUserCity(nearest)
        }}
      />
      <div
        className={styles.chartCard}
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          padding: '1.25rem 1.5rem 1.5rem',
          maxWidth: 'none',
          width: '100%',
          minHeight: 560,
        }}
      >
        {/* Title + subtitle with expand toggle */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.15rem', color: '#1a1a2e', lineHeight: 1.25 }}>
              Find the right Assisted Living near{' '}
              <button
                type="button"
                onClick={() => {
                  setShowModal(true)
                  posthog?.capture('homepage_scores_location_link_clicked')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#4a7c7e',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  cursor: 'pointer',
                  fontSize: 'inherit',
                  fontWeight: 'inherit',
                  fontFamily: 'inherit',
                  lineHeight: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {locationLabel}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#888' }}>
              Use Assistedly&apos;s proprietary database to help your family
            </p>
          </div>
          <button
            type="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            title={expanded ? 'Collapse' : 'Expand'}
            onClick={() => {
              onExpandToggle?.()
              posthog?.capture('homepage_scores_expand_toggle', { expanded: !expanded })
            }}
            style={{
              background: 'none',
              border: '1px solid #e6e8eb',
              borderRadius: 8,
              padding: '0.35rem',
              cursor: 'pointer',
              color: '#888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {expanded ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            borderBottom: '1px solid #e6e8eb',
            marginBottom: '0.9rem',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key)
                posthog?.capture('homepage_scores_tab_click', { tab: t.key })
              }}
              style={{
                padding: '0.65rem 1rem',
                fontSize: '0.92rem',
                fontWeight: 600,
                border: 'none',
                background: 'none',
                color: activeTab === t.key ? '#1a1a2e' : '#888',
                borderBottom: activeTab === t.key ? '2px solid #34c759' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'safest' && renderList(safest)}
        {activeTab === 'topRated' && renderList(topRated)}
        {activeTab === 'mostAffordable' && renderList(mostAffordable)}
        {activeTab === 'ask' && (
          <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
            <p style={{ color: '#555', fontSize: '0.95rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              Ask anything about assisted living — costs, care types, locations, or how to compare facilities.
            </p>
            <form onSubmit={handleAskSubmit} style={{ display: 'flex', gap: '0.5rem', maxWidth: 400, margin: '0 auto' }}>
              <input
                type="text"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder="e.g. What is SCO in Massachusetts?"
                style={{
                  flex: 1,
                  padding: '0.6rem 0.85rem',
                  borderRadius: 8,
                  border: '1px solid #d0d4db',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '0.6rem 1.1rem',
                  borderRadius: 8,
                  border: 'none',
                  background: '#34c759',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Ask
              </button>
            </form>
            <p style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.75rem' }}>
              Powered by Assistedly.ai — your data stays private.
            </p>
          </div>
        )}

        {!loading && rawData && activeTab !== 'ask' && (
          <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            <a
              href={activeTab === 'mostAffordable' ? '/affordable' : activeTab === 'topRated' ? '/top-rated' : '/find-safest'}
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#4a7c7e',
                textDecoration: 'none',
              }}
              onClick={() => posthog?.capture('homepage_scores_see_all_click', { tab: activeTab })}
            >
              See all {activeTab === 'mostAffordable' ? 'affordable' : activeTab === 'topRated' ? 'top-rated' : 'safest'} facilities →
            </a>
          </div>
        )}
      </div>
    </>
  )
}
