/**
 * useFacilities — lazy-load facility data from the edge-cached API.
 *
 * Benefits over static import:
 *   1. Keeps 12.5KB of facility data OUT of the main JS bundle
 *   2. Data loads from Cloudflare edge cache (fast)
 *   3. API endpoint can be locked down with rate limits + bot detection
 *   4. LLM crawlers hitting the API get blocked — not the JS file
 *
 * Usage:
 *   const { facilities, loading, error } = useFacilities()
 */

import { useState, useEffect } from 'react'

const CACHE_KEY = '__assistedly_facilities'
const CACHE_TTL = 10 * 60 * 1000 // 10 min (matches max-age on API response)

let globalCache = null
let globalPromise = null

export function useFacilities() {
  const [facilities, setFacilities] = useState(() => {
    // Hydrate from in-memory cache on mount (fast path for re-renders)
    if (globalCache && Date.now() - globalCache.at < CACHE_TTL) {
      return globalCache.data
    }
    return null
  })
  const [loading, setLoading] = useState(!globalCache)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Already cached in memory — skip fetch
    if (globalCache && Date.now() - globalCache.at < CACHE_TTL) {
      setFacilities(globalCache.data)
      setLoading(false)
      return
    }

    // Deduplicate concurrent requests
    if (!globalPromise) {
      globalPromise = fetch('/api/facilities', {
        // Only accept cached responses within 10min freshness
        // This lets Cloudflare serve from edge without hitting origin
        headers: { Accept: 'application/json' },
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Facilities API returned ${res.status}`)
          return res.json()
        })
        .then((data) => {
          if (!Array.isArray(data)) throw new Error('Invalid facilities response')
          globalCache = { data, at: Date.now() }
          return data
        })
        .finally(() => {
          globalPromise = null
        })
    }

    let cancelled = false

    globalPromise
      .then((data) => {
        if (!cancelled) {
          setFacilities(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load facilities')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { facilities, loading, error }
}
