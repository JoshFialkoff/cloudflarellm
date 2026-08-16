import '../styles/globals.css'
import SiteHeaderAppRouter from '../components/SiteHeaderAppRouter'
import SiteFooterAppRouter from '../components/SiteFooterAppRouter'
import JsonLd from '../components/Seo/JsonLd'
import PostHogAppViewTracker from '../components/PostHogAppViewTracker'
import {
  getOrganizationSchema,
  getSoftwareApplicationSchema,
  getWebsiteSchema,
} from '../lib/seo/schemaData'

const GTM_ID = 'GTM-5MZDBQ5P'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://assistedly.ai'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Assistedly.ai | AI Assisted Living & Memory Care Matching',
    template: '%s | Assistedly.ai',
  },
  description:
    'The transparent assisted living broker alternative in Massachusetts. AI-powered assisted living and memory care matching. Privacy-first, unbiased, and transparent pricing.',
  keywords: [
    'AI assisted living matching',
    'assisted living broker alternatives',
    "assisted living search sites that don't sell your data",
    'Massachusetts assisted living',
    'memory care matching Massachusetts',
  ],
  openGraph: {
    title: 'Assistedly.ai | AI Assisted Living & Memory Care Matching',
    description:
      'The transparent assisted living broker alternative in Massachusetts. AI-powered assisted living and memory care matching. Privacy-first, unbiased, and transparent pricing.',
    url: siteUrl,
    siteName: 'Assistedly.ai',
    images: [
      {
        url: '/aialc-hero-banner.png',
        width: 1200,
        height: 630,
        alt: 'Assistedly.ai assisted living matching platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Assistedly.ai | AI Assisted Living & Memory Care Matching',
    description:
      'The transparent assisted living broker alternative in Massachusetts. AI-powered assisted living and memory care matching. Privacy-first, unbiased, and transparent pricing.',
    images: ['/aialc-hero-banner.png'],
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
  alternates: {
    canonical: '/',
  },
}

export default function RootLayout({ children }) {
  const rootSchemas = [
    getOrganizationSchema(),
    getSoftwareApplicationSchema(),
    getWebsiteSchema(),
  ]

  return (
    <html lang="en">
      <head>
        <JsonLd data={rootSchemas} />
        <script
          dangerouslySetInnerHTML={{
            __html: 'window.dataLayer=window.dataLayer||[];',
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');
            `.trim(),
          }}
        />
      </head>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
        <PostHogAppViewTracker />
        <SiteHeaderAppRouter />
        <main id="main-content" style={{ flex: '1 0 auto' }}>
          {children}
        </main>
        <SiteFooterAppRouter />
      </body>
    </html>
  )
}
