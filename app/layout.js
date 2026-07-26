import '../styles/globals.css'
import SiteHeaderAppRouter from '../components/SiteHeaderAppRouter'
import SiteFooterAppRouter from '../components/SiteFooterAppRouter'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://assistedly.ai'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Assistedly',
    template: '%s | Assistedly',
  },
  description: 'Massachusetts assisted living search, planning tools, and facility guidance.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <SiteHeaderAppRouter />
        <main id="main-content" style={{ flex: '1 0 auto' }}>{children}</main>
        <SiteFooterAppRouter />
      </body>
    </html>
  )
}
