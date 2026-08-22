'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
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

function CompactRow({ f, rank, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 80px 70px',
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
        {f.avgFee ? `$${f.avgFee.toLocaleString()}` : f.feeLow ? `$${f.feeLow.toLocaleString()}` : 'N/A'}
      </div>
      <div style={{ textAlign: 'right', fontSize: '0.82rem' }}>
        <span style={{ fontWeight: 700, color: f.safetyScore >= 60 ? '#34c759' : '#ff9500' }}>{f.safetyScore}</span>
        <span style={{ color: '#aaa', fontSize: '0.7rem' }}>/100</span>
        <ScoreBar score={f.safetyScore} warn={f.safetyScore < 40} />
      </div>
    </div>
  )
}

export default function HomeScoresTabs({ dataUrl = '/data/chart-facilities.json' }) {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('safest')
  const [userCity, setUserCity] = useState(null)
  const [askInput, setAskInput] = useState('')
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

  // Geolocation → nearest city
  useEffect(() => {
    if (!rawData || Object.keys(cityCoordsMap).length === 0) return
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
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
        }
      },
      () => {},
      { timeout: 8000, maximumAge: 600000 }
    )
  }, [rawData, cityCoordsMap])

  const facilities = useMemo(() => {
    if (!rawData?.facilities) return []
    let rows = rawData.facilities.map((f) => ({
      ...f,
      topRatedScore: computeTopRatedScore(f),
    }))
    if (userCity) {
      const cityKey = userCity.toLowerCase().trim()
      const cityRows = rows.filter(
        (f) => (f.cityClean || f.city || '').toLowerCase().trim() === cityKey
      )
      // If we have at least 3 facilities in that city, filter to city; otherwise show all
      if (cityRows.length >= 3) rows = cityRows
    }
    return rows
  }, [rawData, userCity])

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
    return (
      <div>
        {userCity && (
          <div style={{ fontSize: '0.8rem', color: '#4a7c7e', marginBottom: '0.5rem', fontWeight: 600 }}>
            📍 Near {userCity}
            {' '}
            <button
              onClick={() => setUserCity(null)}
              style={{ background: 'none', border: 'none', color: '#c4956a', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
            >
              Show all MA
            </button>
          </div>
        )}
        {list.map((f, i) => (
          <CompactRow key={f.id} f={f} rank={i + 1} onClick={() => handleFacilityClick(f)} />
        ))}
      </div>
    )
  }

  return (
    <div
      className={styles.chartCard}
      style={{
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '1rem 1.25rem 1.25rem',
        maxWidth: 'none',
        width: '100%',
        minHeight: 420,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 className={styles.chartTitle} style={{ fontSize: '1.05rem', margin: 0 }}>
          Discover Massachusetts Assisted Living
        </h3>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          borderBottom: '1px solid #e6e8eb',
          marginBottom: '0.75rem',
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
              padding: '0.55rem 0.85rem',
              fontSize: '0.82rem',
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
  )
}
