import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { SITE_PRIMARY_NAV, siteNavItemIsActive } from "../lib/siteNavigation";
import styles from "../styles/SiteNav.module.css";

const HEART_PATH =
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

const HOME_PATH = "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z";

const ARROW_RIGHT_PATH =
    "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z";

const SEARCH_PATH =
    "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14z";

const HOME_HERO_PATHS = new Set(["/", "/index-video"]);
const SCROLL_REVEAL_PX = 16;

function SiteNavStickySearch() {
    const router = useRouter();
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (!router.isReady || router.pathname !== "/search") return;
        const raw = router.query.q;
        const q = Array.isArray(raw) ? raw[0] : raw;
        const next = typeof q === "string" ? q : "";
        // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is source of truth for /search
        setQuery(next);
    }, [router.isReady, router.pathname, router.query.q]);

    const onSubmit = (event) => {
        event.preventDefault();
        const q = query.trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    };

    return (
        <div className={styles.siteNavSearchWrap}>
            <form
                className={styles.siteNavSearch}
                onSubmit={onSubmit}
                role="search"
            >
                <label htmlFor="site-nav-search" className={styles.siteNavSrOnly}>
                    Search exclusive data base by name, city or zip code
                </label>
                <input
                    id="site-nav-search"
                    type="search"
                    name="q"
                    className={`${styles.siteNavSearchInput} ${styles.siteNavSearchInputFull}`}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name, city or zip..."
                    enterKeyHint="search"
                    autoComplete="off"
                    inputMode="search"
                />
                <button
                    type="submit"
                    className={styles.siteNavSearchBtn}
                    aria-label="Search exclusive data base"
                >
                    <span className={styles.siteNavSearchGlyphFull}>
                        <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path fill="currentColor" d={HEART_PATH} />
                        </svg>
                        <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path fill="currentColor" d={ARROW_RIGHT_PATH} />
                        </svg>
                    </span>
                    <svg
                        className={styles.siteNavSearchGlyphCompact}
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path fill="currentColor" d={SEARCH_PATH} />
                    </svg>
                </button>
            </form>
        </div>
    );
}

export default function SiteToolsNav() {
    const router = useRouter();
    const homeActive = router.pathname === "/";
    const hideUntilScroll = HOME_HERO_PATHS.has(router.pathname);
    const [navRevealed, setNavRevealed] = useState(!hideUntilScroll);

    useEffect(() => {
        if (!hideUntilScroll) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reveal immediately on non-hero pages
            setNavRevealed(true);
            return undefined;
        }

        const sync = () => {
            const y =
                window.scrollY ||
                document.documentElement.scrollTop ||
                document.body.scrollTop ||
                0;
            setNavRevealed(y > SCROLL_REVEAL_PX);
        };

        sync();
        window.addEventListener("scroll", sync, { passive: true });
        return () => window.removeEventListener("scroll", sync);
    }, [hideUntilScroll, router.pathname]);

    const navClassName = [
        styles.siteNav,
        hideUntilScroll ? styles.siteNavFixed : "",
        hideUntilScroll && !navRevealed ? styles.siteNavHidden : "",
        navRevealed ? styles.siteNavRevealed : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <nav
            className={navClassName}
            aria-label="Site sections and tools"
            aria-hidden={hideUntilScroll && !navRevealed ? true : undefined}
        >
            <div className={`container ${styles.siteNavInner}`}>
                <div className={styles.siteNavPrimary}>
                    <Link
                        href="/"
                        className={`${styles.siteNavHome} ${homeActive ? styles.siteNavHomeActive : ""}`}
                        aria-label="Home"
                        aria-current={homeActive ? "page" : undefined}
                    >
                        <svg
                            className={styles.siteNavHomeHeart}
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path fill="currentColor" d={HOME_PATH} />
                        </svg>
                    </Link>
                    <div className={styles.siteNavCluster}>
                        {SITE_PRIMARY_NAV.map((item) => {
                            const active = siteNavItemIsActive(
                                router.pathname,
                                item.href,
                            );
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
                <SiteNavStickySearch />
            </div>
        </nav>
    );
}
