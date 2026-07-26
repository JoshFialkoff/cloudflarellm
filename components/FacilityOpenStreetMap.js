'use client'

import { useEffect, useMemo, useState } from 'react'

const SESSION_PREFIX = 'facilityCoords:'

function getCachedCoords(slug) {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}${slug}`)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function setCachedCoords(slug, coords) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`${SESSION_PREFIX}${slug}`, JSON.stringify(coords))
  } catch {}
}

function getDirectionsUrl(address, lat, lon) {
  if (!address) return '#'
  try {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
  } catch {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
  }
}

function getExternalMapUrl(address, lat, lon) {
  if (lat && lon) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`
}

export default function FacilityOpenStreetMap({ facility }) {
  const [coords, setCoords] = useState(() => getCachedCoords(facility?.slug))
  const [loading, setLoading] = useState(!coords)
  const [error, setError] = useState(false)

  // Geocode address via Nominatim
  useEffect(() => {
    if (coords || !facility?.address) return

    let cancelled = false
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(facility.address)}`,
      {
        headers: {
          'User-Agent': 'Assistedly.ai/1.0 (support@assistedly.ai)',
        },
      }
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data && data[0]) {
          const c = {
            lat: data[0].lat,
            lon: data[0].lon,
            bbox: data[0].boundingbox,
          }
          setCachedCoords(facility.slug, c)
          setCoords(c)
          setLoading(false)
          setError(false)
        } else {
          setError(true)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [facility?.slug, facility?.address, coords])

  const { embedUrl, directionsUrl, externalMapUrl } = useMemo(() => {
    if (!coords) {
      return { embedUrl: '', directionsUrl: '#', externalMapUrl: '#' }
    }
    const { lat, lon, bbox } = coords
    const bboxStr = bbox
      ? bbox.join('%2C')
      : `${parseFloat(lon) - 0.008}%2C${parseFloat(lat) - 0.008}%2C${parseFloat(lon) + 0.008}%2C${parseFloat(lat) + 0.008}`
    const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bboxStr}&layer=mapnik`
    return {
      embedUrl: embed,
      directionsUrl: getDirectionsUrl(facility?.address, lat, lon),
      externalMapUrl: getExternalMapUrl(facility?.address, lat, lon),
    }
  }, [coords, facility?.address])

  const nameInitial = facility?.name ? facility.name.charAt(0).toUpperCase() : '?'
  const shortName = facility?.name || 'Facility'

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 'inherit',
        overflow: 'hidden',
        background: '#f0f2f5',
      }}
    >
      {loading ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            color: '#6b7280',
            fontSize: '0.875rem',
          }}
        >
          <div
            style={{
              width: '2rem',
              height: '2rem',
              border: '2px solid #e5e7eb',
              borderTopColor: '#c4956a',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span>Loading map…</span>
        </div>
      ) : error ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            color: '#6b7280',
            fontSize: '0.875rem',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Unable to load map for this address.</span>
          {facility?.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#c4956a',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '0.8rem',
              }}
            >
              Search on Google Maps →
            </a>
          )}
        </div>
      ) : (
        <>
          <iframe
            src={embedUrl}
            width="100%"
            height="100%"
            style={{ border: 0, display: 'block', filter: 'saturate(0.85) contrast(1.05)' }}
            loading="lazy"
            title={`Map of ${shortName}`}
          />

          {/* Center marker pin overlay */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 2,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
            }}
          >
            <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
              <path
                d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z"
                fill="#c4956a"
              />
              <circle cx="18" cy="18" r="7" fill="white" />
            </svg>
          </div>

          {/* Facility info card overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              right: '12px',
              zIndex: 3,
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '12px',
              padding: '12px 14px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {/* Facility avatar / initial badge */}
            <div
              style={{
                flexShrink: 0,
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #c4956a 0%, #a67c52 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1.1rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxShadow: '0 2px 8px rgba(196,149,106,0.3)',
                userSelect: 'none',
              }}
            >
              {nameInitial}
            </div>

            {/* Text block */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  color: '#1f2937',
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {shortName}
              </div>
              {facility?.address && (
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: '#6b7280',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {facility.address}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <a
                href={externalMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#f3f4f6',
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '0.8rem',
                  transition: 'background 0.15s',
                }}
                title="Open map"
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #c4956a 0%, #a67c52 100%)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(196,149,106,0.3)',
                  transition: 'transform 0.1s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(196,149,106,0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(196,149,106,0.3)'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Directions
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
