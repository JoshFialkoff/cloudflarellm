import Link from "next/link";
import { useRouter } from "next/router";
import { SITE_PRIMARY_NAV, siteNavItemIsActive } from "../lib/siteNavigation";
import styles from "../styles/SiteNav.module.css";

export default function SiteToolsNav() {
  const router = useRouter();

  return (
    <nav className={styles.siteNav} aria-label="Site sections and tools">
      <div className={`container ${styles.siteNavInner}`}>
        <div className={styles.siteNavCluster}>
          {SITE_PRIMARY_NAV.map((item) => {
            const active = siteNavItemIsActive(router.pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.siteNavLink} ${active ? styles.siteNavLinkActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
