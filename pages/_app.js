import '../styles/globals.css'
import Script from 'next/script'
import { useEffect } from 'react'
import { Inter } from 'next/font/google'
import { initPosthog } from '../lib/posthogClient'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})

const GTM_ID = 'GTM-5MZDBQ5P'

export default function App({ Component, pageProps }) {
  useEffect(() => {
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
      <Component {...pageProps} />
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
