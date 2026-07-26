'use client'

import { useEffect, useState } from 'react'

function getCachedCoords(slug) {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`facilityCoords:${slug}`)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function setCachedCoords(slug, coords) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`facilityCoords:${slug}`, JSON.stringify(coords))
  } catch {}
}

export default function FacilityOpenStreetMap({ facility, className }) {
  const [coords, setCoords] = useState(() => getCachedCoords(facility?.slug))

  useEffect(() => {
    if (coords || !facility?.address) return

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
        if (data && data[0]) {
          const c = {
            lat: data[0].lat,
            lon: data[0].lon,
            bbox: data[0].boundingbox,
          }
          setCachedCoords(facility.slug, c)
          setCoords(c)
        }
      })
      .catch(() => {})
  }, [facility?.slug, facility?.address, coords])

  if (!coords) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          background: '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: '0.875rem',
        }}
      >
        Loading map…
      </div>
    )
  }

  const { lat, lon, bbox } = coords
  const bboxStr = bbox
    ? bbox.join('%2C')
    : `${parseFloat(lon) - 0.01}%2C${parseFloat(lat) - 0.01}%2C${parseFloat(lon) + 0.01}%2C${parseFloat(lat) + 0.01}`
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bboxStr}&layer=mapnik&marker=${lat}%2C${lon}`

  return (
    <iframe
      src={embedUrl}
      className={className}
      width="100%"
      height="100%"
      style={{ border: 0, display: 'block' }}
      loading="eager"
      title={`Map of ${facility.name || 'facility'}`}
    />
  )
}
