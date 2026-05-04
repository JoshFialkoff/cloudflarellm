import Link from "next/link";
import { useRouter } from "next/router";
import styles from "../styles/SiteHeader.module.css";

const NAV_LINKS = [
  { href: "/find-safest", label: "Find safest care" },
  { href: "/budget", label: "Budget tool" },
  { href: "/search", label: "Search" },
  { href: "/about", label: "About" },
];

export default function SiteHeader() {
  const router = useRouter();

  return (
    <header className={styles.siteHeader}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="assistedly.AI home">
          <span className={styles.brandMark}>A</span>
          <span>
            <strong>assistedly.AI</strong>
            <small>Massachusetts senior care guidance</small>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Primary navigation">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? router.pathname === "/"
                : router.pathname === link.href || router.pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link href="/find-safest" className={styles.cta}>
          Start free
        </Link>
      </div>
    </header>
  );
}
