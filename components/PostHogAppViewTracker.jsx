'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import posthog from '../lib/posthogClient'
import { trackNextdoorPageView } from '../lib/nextdoorUniversalPixel'
import { getNextdoorAttributionProperties } from '../lib/marketingAttribution'

/**
 * App Router pageview tracker.
 *
 * Fires PostHog $pageview and GTM page_view on initial load and client-side
 * navigation. Uses window.location.href for $current_url so query params are
 * captured without forcing dynamic rendering via useSearchParams.
 */
export default function PostHogAppViewTracker() {
  const pathname = usePathname()
  const lastUrl = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const checkPosthog = () => {
      if (!posthog.__loaded) {
        const state = window.__posthog_init_state__ || 'unknown'
        console.error(`[PostHog] SDK not initialized in App Router (state: ${state}). Key present: ${!!process.env.NEXT_PUBLIC_POSTHOG_KEY}`)
      }
    }
    const timer = setTimeout(checkPosthog, 3000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const currentUrl = window.location.href
    const currentPath = window.location.pathname

    // Deduplicate: skip if we've already recorded this exact URL
    if (lastUrl.current === currentUrl) return
    lastUrl.current = currentUrl

    // PostHog $pageview
    if (posthog?.capture) {
      posthog.capture('$pageview', {
        $current_url: currentUrl,
        $pathname: currentPath,
      })
    }

    // GTM dataLayer bridge (parity with Pages Router pages/_app.js)
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'page_view',
        page_path: currentPath,
        page_location: currentUrl,
      })
    }

    // Direct gtag page_view fallback
    const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    if (gaId && typeof globalThis.gtag === 'function') {
      globalThis.gtag('event', 'page_view', {
        page_path: currentPath,
        page_location: currentUrl,
      })
    }

    // Nextdoor Universal Pixel PageView (audience building + retargeting)
    try {
      trackNextdoorPageView({ page_path: currentPath, page_location: currentUrl })
    } catch {
      // silent
    }

    // Nextdoor enriched campaign pageview (only for attributed Nextdoor traffic)
    try {
      const nd = getNextdoorAttributionProperties()
      if (nd.is_nextdoor_traffic) {
        import('../lib/nextdoorAnalytics').then(({ trackNextdoorPageview }) => {
          trackNextdoorPageview(currentUrl, {
            page_path: currentPath,
            utm_campaign: nd.nd_campaign,
            nd_post_id: nd.nd_post_id,
          })
        })
      }
    } catch {
      // silent
    }
  }, [pathname])

  return null
}
