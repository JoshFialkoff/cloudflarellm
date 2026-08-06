import '../styles/globals.css'

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
      <body>{children}</body>
    </html>
  )
}
