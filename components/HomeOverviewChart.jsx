'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import FacilityDiscoveryDashboard from './facility-charts/FacilityDiscoveryDashboard'

const styles = {
  wrap: {
    position: 'relative',
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '1rem',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease',
    maxWidth: 500,
    margin: '0 auto',
  },
  wrapHover: {
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  hint: {
    fontSize: '0.7rem',
    color: '#888',
    background: '#f4f5f7',
    padding: '0.2rem 0.5rem',
    borderRadius: '999px',
  },
  chartHeight: { width: '100%', height: 220 },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: '#f4f5f7',
    overflowY: 'auto',
    paddingTop: 64, // space for fixed nav
  },
  closeBtn: {
    position: 'fixed',
    top: 72,
    right: 20,
    zIndex: 1001,
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 40,
    height: 40,
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
}

function CompactTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid #e6e6e9', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
      <p style={{ fontWeight: 700, margin: '0 0 0.15rem', color: '#1a1a2e' }}>{d.label}</p>
      <p style={{ margin: 0, color: '#555' }}>{d.count} facilities</p>
    </div>
  )
}

export default function HomeOverviewChart({ dataUrl = '/data/chart-facilities.json' }) {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    fetch(dataUrl)
      .then((r) => r.json())
      .then((json) => { setRawData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dataUrl])

  const buckets = useMemo(() => {
    const b = [
      { label: '0-20', min: 0, max: 20, count: 0, color: '#ff3b30' },
      { label: '21-40', min: 21, max: 40, count: 0, color: '#ff9500' },
      { label: '41-60', min: 41, max: 60, count: 0, color: '#ffcc00' },
      { label: '61-80', min: 61, max: 80, count: 0, color: '#34c759' },
      { label: '81-100', min: 81, max: 100, count: 0, color: '#007aff' },
    ]
    if (!rawData?.facilities) return b
    rawData.facilities.forEach((d) => {
      const score = d.safetyScore || 0
      const bucket = b.find((bb) => score >= bb.min && score <= bb.max)
      if (bucket) bucket.count++
    })
    return b
  }, [rawData])

  if (expanded) {
    return (
      <>
        <div style={styles.overlay}>
          <FacilityDiscoveryDashboard
            title="Discover Massachusetts Assisted Living"
            subtitle="Ranked by official Massachusetts state inspection data. Compare safety scores, staffing ratios, emergency power, electronic records, and video monitoring across all licensed facilities — metrics no broker site publishes."
          />
        </div>
        <button
          style={styles.closeBtn}
          onClick={() => setExpanded(false)}
          aria-label="Close chart"
          title="Close"
        >
          ✕
        </button>
      </>
    )
  }

  return (
    <div
      style={{ ...styles.wrap, ...(hovered ? styles.wrapHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setExpanded(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(true) }}
      aria-label="Open full facility data dashboard"
    >
      <div style={styles.header}>
        <h3 style={styles.title}>Facility Safety Scores</h3>
        <span style={styles.hint}>Click to explore</span>
      </div>
      {loading || !rawData ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14 }}>
          Loading data…
        </div>
      ) : (
        <div style={styles.chartHeight}>
          <ResponsiveContainer>
            <BarChart data={buckets} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
              <Tooltip content={<CompactTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {buckets.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
