import '../styles/globals.css'
import Script from 'next/script'
import { useEffect } from 'react'
import { Inter } from 'next/font/google'
import { initPosthog } from '../lib/posthogClient'
import { syncMarketingTouchFromUrl } from '../lib/marketingAttribution'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})

const GTM_ID = 'GTM-5MZDBQ5P'
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Persist Reddit / UTM params before PostHog init so early events can use them.
    syncMarketingTouchFromUrl()
    initPosthog()
  }, [])

  useEffect(() => {
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
  }, [])

  return (
    <div className={inter.className}>
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
  )
}
