'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AssistedlyLogo from './AssistedlyLogo'
import { SITE_PRIMARY_NAV, siteNavItemIsActive } from '../lib/siteNavigation'
import styles from './SiteHeader.module.css'

/**
 * Pages that should NOT render the global site header.
 * Easy to extend for landing pages, fullscreen flows, etc.
 */
const NO_HEADER_PATHS = new Set([
  '/admin',
])

/** Runtime override: any page can opt out by setting <html data-no-site-header> */
function runtimeOptedOut() {
  if (typeof document === 'undefined') return false
  return (
    document.documentElement?.dataset?.noSiteHeader === 'true' ||
    document.documentElement?.dataset?.noSiteHeader === ''
  )
}

const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'

const ARROW_RIGHT_PATH =
  'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z'

function SiteHeaderSearch({ className = '', pathname = '' }) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (pathname !== '/search') return
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('q')
    const q = typeof raw === 'string' ? raw : ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is source of truth for /search
    setQuery(q)
  }, [pathname])

  const onSubmit = useCallback(
    (event) => {
      event.preventDefault()
      const q = query.trim()
      const dest = q ? `/search?q=${encodeURIComponent(q)}` : '/search'
      window.location.href = dest
    },
    [query],
  )

  return (
    <form
      className={`${styles.siteHeaderSearch} ${className}`}
      onSubmit={onSubmit}
      role="search"
    >
      <label htmlFor="site-header-search" className={styles.siteHeaderSrOnly}>
        Search assisted living by name, city or zip code
      </label>
      <input
        id="site-header-search"
        type="search"
        name="q"
        className={styles.siteHeaderSearchInput}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, city or zip..."
        enterKeyHint="search"
        autoComplete="off"
        inputMode="search"
      />
      <button
        type="submit"
        className={styles.siteHeaderSearchBtn}
        aria-label="Search"
      >
        <svg
          className={styles.siteHeaderSearchGlyphHeart}
          viewBox="0 0 24 24"
          width="14"
          height="14"
          aria-hidden="true"
          focusable="false"
        >
          <path fill="currentColor" d={HEART_PATH} />
        </svg>
        <svg
          className={styles.siteHeaderSearchGlyphArrow}
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
          focusable="false"
        >
          <path fill="currentColor" d={ARROW_RIGHT_PATH} />
        </svg>
      </button>
    </form>
  )
}

export default function SiteHeader({ pathname = '' }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [optedOut, setOptedOut] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with DOM attribute
    setOptedOut(runtimeOptedOut())
  }, [pathname])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  if (optedOut || NO_HEADER_PATHS.has(pathname)) return null

  return (
    <header className={styles.siteHeader} role="banner">
      <div className={`container ${styles.siteHeaderInner}`}>
        {/* Skip link */}
        <a
          href="#main-content"
          className={styles.siteHeaderSrOnly}
          style={{
            position: 'absolute',
            top: '0.5rem',
            left: '0.5rem',
            zIndex: 70,
            background: 'var(--white)',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            fontWeight: 600,
            color: 'var(--primary)',
            textDecoration: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.clip = 'auto'
            e.currentTarget.style.width = 'auto'
            e.currentTarget.style.height = 'auto'
            e.currentTarget.style.whiteSpace = 'normal'
          }}
          onBlur={(e) => {
            e.currentTarget.style.clip = 'rect(0,0,0,0)'
            e.currentTarget.style.width = '1px'
            e.currentTarget.style.height = '1px'
            e.currentTarget.style.whiteSpace = 'nowrap'
          }}
        >
          Skip to main content
        </a>

        {/* Logo + tagline */}
        <div className={styles.siteHeaderLogoWrap}>
          <AssistedlyLogo size="sm" href="/" />
          <span className={styles.siteHeaderTagline}>
            Massachusetts senior living research
          </span>
        </div>

        {/* Desktop nav */}
        <nav
          className={styles.siteHeaderNav}
          aria-label="Primary"
        >
          {SITE_PRIMARY_NAV.map((item) => {
            const active = siteNavItemIsActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.siteHeaderNavLink} ${active ? styles.siteHeaderNavLinkActive : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Search + hamburger */}
        <div className={styles.siteHeaderSearchWrap}>
          <SiteHeaderSearch pathname={pathname} className={styles.siteHeaderSearch} />
          <button
            className={styles.siteHeaderMenuBtn}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="site-header-drawer"
            onClick={() => setMobileOpen((p) => !p)}
          >
            {mobileOpen ? (
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          id="site-header-drawer"
          className={styles.siteHeaderDrawer}
        >
          <div className="container">
            <nav className={styles.siteHeaderDrawerNav} aria-label="Primary mobile">
              {SITE_PRIMARY_NAV.map((item) => {
                const active = siteNavItemIsActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.siteHeaderDrawerLink} ${active ? styles.siteHeaderDrawerLinkActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <div className={styles.siteHeaderDrawerSearch}>
                <SiteHeaderSearch pathname={pathname} />
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
