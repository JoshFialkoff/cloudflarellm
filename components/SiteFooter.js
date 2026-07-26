'use client'

import Link from 'next/link'
import AssistedlyLogo from './AssistedlyLogo'
import styles from './SiteFooter.module.css'

const FOOTER_LINKS = {
  company: {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/founder-story', label: 'Founder Story' },
      { href: '/how-we-make-money', label: 'How We Make Money' },
      { href: '/editorial-policy', label: 'Editorial Policy' },
      { href: '/methodology', label: 'Methodology' },
    ],
  },
  tools: {
    title: 'Tools',
    links: [
      { href: '/search', label: 'Find Help' },
      { href: '/tools', label: 'Tools Directory' },
      { href: '/find-safest', label: 'Safest Places' },
      { href: '/tools/cost-calculator', label: 'Cost Calculator' },
      { href: '/tools/memory-care-readiness', label: 'Memory Care Readiness' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { href: '/compare', label: 'Compare Facilities' },
      { href: '/concierge', label: 'Concierge' },
      { href: '/get-matched', label: 'Get Matched' },
      { href: '/answers', label: 'Data-Powered Answers' },
      { href: '/trends', label: 'Trends' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/data-sources', label: 'Data Sources' },
      { href: '/how-we-work', label: 'How We Work' },
      { href: '/companies', label: 'For Businesses' },
    ],
  },
}

/** Pages that should NOT render the global site footer. */
const NO_FOOTER_PATHS = new Set([
  '/admin',
])

/** Runtime override: any page can opt out by setting <html data-no-site-footer> */
function runtimeOptedOut() {
  if (typeof document === 'undefined') return false
  return (
    document.documentElement?.dataset?.noSiteFooter === 'true' ||
    document.documentElement?.dataset?.noSiteFooter === ''
  )
}

export default function SiteFooter({ pathname = '' }) {
  if (NO_FOOTER_PATHS.has(pathname)) return null
  if (typeof document !== 'undefined' && runtimeOptedOut()) return null

  return (
    <footer className={styles.siteFooter} role="contentinfo">
      <div className={styles.siteFooterContent}>
        {/* Brand column */}
        <div className={styles.siteFooterBrand}>
          <AssistedlyLogo size="md" href="/" />
          <p className={styles.siteFooterDesc}>
            Massachusetts&apos;s most trusted AI-powered assisted living finder.
            We protect your privacy while helping you make informed decisions.
          </p>
        </div>

        {/* Link columns */}
        {Object.values(FOOTER_LINKS).map((section) => (
          <div key={section.title} className={styles.siteFooterColumn}>
            <h3 className={styles.siteFooterColumnTitle}>{section.title}</h3>
            <ul className={styles.siteFooterLinkList}>
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.siteFooterLink}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.siteFooterBottom}>
        <p className={styles.siteFooterCopyright}>
          © {new Date().getFullYear()} Assistedly.ai. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
