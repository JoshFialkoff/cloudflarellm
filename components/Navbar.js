import { useState } from 'react'
import Link from 'next/link'
import styles from '../styles/Navbar.module.css'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        <Link href="/" className={styles.navLogo}>
          🏠 AI Assist Living
        </Link>
        <div className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}>
          <Link href="/" className={styles.navLink}>Home</Link>
          <Link href="/#how-it-works" className={styles.navLink}>How It Works</Link>
          <Link href="/#for-families" className={styles.navLink}>For Families</Link>
          <Link href="/#contact" className={styles.navLink}>Contact</Link>
          <Link href="/search" className={styles.navCta}>Find a Facility</Link>
        </div>
        <button
          className={styles.mobileMenuBtn}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
    </nav>
  )
}
