import '../lib/browserPolyfills'
import '../styles/globals.css'
import Script from 'next/script'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { PostHogProvider } from 'posthog-js/react'
import LandingBanner from '../components/LandingBanner'
import SiteHeader from '../components/SiteHeader'
import posthog, { TOP_NAV_SEARCH_EXPERIMENT_FLAG } from '../lib/posthogClient'
import { syncMarketingTouchFromUrl } from '../lib/marketingAttribution'
import { pushLandingDataLayer } from '../lib/landingAnalytics'
import { trackAuthMagicLinkVerified } from '../lib/authAnalytics'

const GTM_ID = 'GTM-5MZDBQ5P'
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const PAGES_WITH_CUSTOM_BANNER = new Set([
  '/',
  '/index-video',
  '/bots/[slug]',
  '/cost-calculator',
  '/tools/cost-calculator',
  '/tools',
  '/massachusetts/[town]/luxury-assisted-living',
  '/admin',
])

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const sentInitialPageViewRef = useRef(false)

  useEffect(() => {
    syncMarketingTouchFromUrl()
}, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const recordTopNavExperimentExposure = () => {
      posthog.getFeatureFlag(TOP_NAV_SEARCH_EXPERIMENT_FLAG)
    }
    if (posthog.config?.token) {
      recordTopNavExperimentExposure()
      return undefined
    }
    posthog.onFeatureFlags(recordTopNavExperimentExposure)
    return () => {
      posthog.onFeatureFlags(() => {})
    }
  }, [])

  useEffect(() => {
    if (!router.isReady) return undefined

    const sendPageView = (url) => {
      pushLandingDataLayer({
        event: 'page_view',
        page_path: url,
        page_location: typeof window !== 'undefined' ? window.location.href : url,
      })
      const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
      if (gaId && typeof globalThis.gtag === 'function') {
        globalThis.gtag('event', 'page_view', {
          page_path: url,
          page_location: typeof window !== 'undefined' ? window.location.href : url,
        })
      }
    }

    if (!sentInitialPageViewRef.current) {
      sentInitialPageViewRef.current = true
      sendPageView(router.asPath)
    }
    router.events.on('routeChangeComplete', sendPageView)
    return () => {
      router.events.off('routeChangeComplete', sendPageView)
    }
    }, [router.isReady, router.events, router.asPath])

  useEffect(() => {
    if (!router.isReady || typeof window === 'undefined') return undefined
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth_verified') !== '1') return undefined

    trackAuthMagicLinkVerified({
      auth_surface: params.get('auth_surface') || undefined,
      redirect_to: router.asPath.split('?')[0],
      has_result_snapshot: router.asPath.includes('/results'),
    })

    params.delete('auth_verified')
    params.delete('auth_surface')
    const qs = params.toString()
    const nextPath = `${router.pathname}${qs ? `?${qs}` : ''}`
    router.replace(nextPath, undefined, { shallow: true })
    return undefined
  }, [router.isReady, router.asPath, router.pathname, router])

  useEffect(() => {
    // Suppress the survey on tool and bot pages — it causes a scroll-to-top jump
    // that disrupts inline bot flows.
    const suppress = /^\/(tools|bots)(\/|$)/.test(router.pathname)
    if (suppress) return undefined

    let timer = null
    let engaged = false

    const startTimer = () => {
      if (engaged) return
      engaged = true

      timer = setTimeout(() => {
        window.dispatchEvent(new Event('posthog:show_survey'))
      }, 60000)
    }

    const handleScroll = () => {
      const scrolled =
        window.scrollY / (document.body.scrollHeight - window.innerHeight)
      if (scrolled > 0.3) startTimer()
    }

    const handleClick = () => startTimer()

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('click', handleClick)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('click', handleClick)
      if (timer) clearTimeout(timer)
    }
  }, [router.pathname])

  return (
    <PostHogProvider client={posthog}>
      <div>
        {PAGES_WITH_CUSTOM_BANNER.has(router.pathname) ? null : <LandingBanner />}
        <main id="main-content">
          <Component {...pageProps} />
        </main>
        {GA_MEASUREMENT_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script
              id="ga4-gtag-inline"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:false});`,
              }}
            />
          </>
        ) : null}
        <Script
          id="google-tag-manager"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
      </div>
    </PostHogProvider>
  )
}
