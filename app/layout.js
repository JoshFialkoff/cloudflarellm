import '../styles/globals.css'
import SiteHeaderAppRouter from '../components/SiteHeaderAppRouter'
import SiteFooterAppRouter from '../components/SiteFooterAppRouter'
import JsonLd from '../components/Seo/JsonLd'
import {
  getOrganizationSchema,
  getSoftwareApplicationSchema,
  getWebsiteSchema,
} from '../lib/seo/schemaData'

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
      </head>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <SiteHeaderAppRouter />
        <main id="main-content" style={{ flex: '1 0 auto' }}>
          {children}
        </main>
        <SiteFooterAppRouter />
      </body>
    </html>
  )
}
