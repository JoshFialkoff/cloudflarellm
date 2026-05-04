import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styles from "../styles/Home.module.css";
import { landingBanner } from "../lib/homePageCopy";
import {
    buildBannerProxyUrl,
    LANDING_BANNER_CAROUSEL_SLIDES,
    LANDING_BANNER_DEFAULT_OBJECT_POSITION,
} from "../lib/landingBannerPhotos";

/** DOM id for the hero banner search pill (sticky nav observes visibility via IntersectionObserver). */
export const LANDING_BANNER_HERO_SEARCH_ID = "landing-banner-hero-search";

/** First carousel slide only — banner rotation disabled (quieter UX). */
const BANNER_SLIDE_INDEX = 0;

const HEART_PATH =
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

/** Material-style forward arrow (right). */
const ARROW_RIGHT_PATH =
    "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z";

function LandingBannerCenterSearch() {
    const router = useRouter();
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (!router.isReady || router.pathname !== "/search") return;
        const raw = router.query.q;
        const q = Array.isArray(raw) ? raw[0] : raw;
        const next = typeof q === "string" ? q : "";
        // Sync ?q= to the banner field (landings, back/forward).
        // eslint-disable-next-line react-hooks/set-state-in-effect -- URL is source of truth for /search
        setQuery(next);
    }, [router.isReady, router.pathname, router.query.q]);

    const onSubmit = (event) => {
        event.preventDefault();
        const q = query.trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    };

    return (
        <form
            id={LANDING_BANNER_HERO_SEARCH_ID}
            className={styles.landingBannerCenterSearch}
            onSubmit={onSubmit}
            role="search"
        >
            <label htmlFor="landing-banner-search" className={styles.landingBannerSrOnly}>
                Search exclusive data base by name, city or zip code
            </label>
            <input
                id="landing-banner-search"
                type="search"
                name="q"
                className={styles.landingBannerSearchInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search exclusive data base by name, city or zip code..."
                enterKeyHint="search"
                autoComplete="off"
                inputMode="search"
            />
            <button
                type="submit"
                className={styles.landingBannerSearchBtn}
                aria-label="Search exclusive data base"
            >
                <svg
                    className={styles.landingBannerSearchHeart}
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path fill="currentColor" d={HEART_PATH} />
                </svg>
                <svg
                    className={styles.landingBannerSearchArrow}
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path fill="currentColor" d={ARROW_RIGHT_PATH} />
                </svg>
            </button>
        </form>
    );
}

function BannerPhotoSection({
    bannerAdCreativeUrl,
    isMobileViewport,
    failedSlides,
    setFailedSlides,
}) {
    return (
        <div className={styles.landingBannerPhotoCell}>
            <div className={styles.landingBannerPhotoFrame}>
                <div className={styles.landingBannerPhotoDecor} aria-hidden="true">
                    <LandingBannerPhotoStrip
                        bannerAdCreativeUrl={bannerAdCreativeUrl}
                        slideIndex={BANNER_SLIDE_INDEX}
                        isMobileViewport={isMobileViewport}
                        failedSlides={failedSlides}
                        setFailedSlides={setFailedSlides}
                    />
                </div>
                <LandingBannerCenterSearch />
            </div>
        </div>
    );
}

function bannerTileImgSrc({
    slide,
    slot,
    useProxy,
    failedSlides,
    slideIndex,
    isMobileViewport,
}) {
    const i = (slideIndex + slot) % LANDING_BANNER_CAROUSEL_SLIDES.length;
    if (
        !useProxy ||
        failedSlides.has(i) ||
        !slide.proxyPaths?.length
    ) {
        return slide.src;
    }
    return buildBannerProxyUrl(
        slide.proxyPaths,
        isMobileViewport ? "portrait" : "wide",
    );
}

function LandingBannerPhotoStrip({
    bannerAdCreativeUrl,
    slideIndex,
    isMobileViewport,
    failedSlides,
    setFailedSlides,
}) {
    const slideCount = LANDING_BANNER_CAROUSEL_SLIDES.length;
    const useProxy = process.env.NEXT_PUBLIC_BANNER_USE_PROXY === "1";
    const visibleCount = 2;

    return (
        <div className={styles.landingBannerPhotoStrip}>
            {Array.from({ length: visibleCount }, (_, slot) => {
                // Guarantee the two visible tiles are never adjacent in the source list.
                // slot 0 → slideIndex; slot 1 → slideIndex + floor(slideCount/2),
                // so the two tiles are always at least half the carousel apart.
                const offset = slot === 0 ? 0 : Math.floor(slideCount / 2);
                const i = (slideIndex + offset) % slideCount;
                const slide = LANDING_BANNER_CAROUSEL_SLIDES[i];
                const useAdCreative =
                    Boolean(bannerAdCreativeUrl) && slot === 0;
                const imgSrc = useAdCreative
                    ? bannerAdCreativeUrl
                    : bannerTileImgSrc({
                          slide,
                          slot,
                          useProxy,
                          failedSlides,
                          slideIndex,
                          isMobileViewport,
                      });
                return (
                    <div
                        key={
                            useAdCreative
                                ? `ad-creative-${slideIndex}`
                                : `${slide.src}-${slot}`
                        }
                        className={styles.landingBannerPhotoTile}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={imgSrc}
                            alt=""
                            width={1200}
                            height={800}
                            sizes={
                                isMobileViewport
                                    ? "50vw"
                                    : "(max-width: 1200px) 33vw, 320px"
                            }
                            decoding="async"
                            fetchpriority={slot === 0 ? "high" : "low"}
                            loading="eager"
                            onError={
                                useAdCreative
                                    ? undefined
                                    : () =>
                                          setFailedSlides((prev) => {
                                              if (prev.has(i)) return prev;
                                              const next = new Set(prev);
                                              next.add(i);
                                              return next;
                                          })
                            }
                            className={styles.landingBannerPhotoImg}
                            style={{
                                objectFit: "cover",
                                objectPosition: useAdCreative
                                    ? "center center"
                                    : (isMobileViewport
                                          ? slide.objectPositionMobile
                                          : slide.objectPosition) ??
                                      LANDING_BANNER_DEFAULT_OBJECT_POSITION,
                            }}
                        />
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Top strip: two-image rail with centered site search (static hero slides).
 * Optional overrides personalize the headline/kicker (e.g. Reddit ad context).
 * When `bannerAdCreativeUrl` is set (https ad image), the first visible tile uses it instead of the carousel slide.
 */
export default function LandingBanner({
    headlineOverride = "",
    kickerOverride = "",
    bannerAdCreativeUrl = "",
}) {
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [failedSlides, setFailedSlides] = useState(() => new Set());

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 720px)");
        const sync = () => setIsMobileViewport(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    const finalHeadline = headlineOverride || landingBanner.headline;
    const finalKicker = kickerOverride || landingBanner.kicker;

    return (
        <header
            className={styles.landingBanner}
            role="banner"
            aria-labelledby="landing-banner-headline"
        >
            <div className={styles.landingBannerInner}>
                <div className={styles.landingBannerLayout}>
                    <BannerPhotoSection
                        bannerAdCreativeUrl={bannerAdCreativeUrl}
                        isMobileViewport={isMobileViewport}
                        failedSlides={failedSlides}
                        setFailedSlides={setFailedSlides}
                    />
                    <div className={styles.landingBannerCopy}>
                        <div className={styles.landingBannerTextColumn}>
                            <div className={styles.landingBannerText}>
                                {finalKicker ? (
                                    <p className={styles.landingBannerKicker}>
                                        {finalKicker}
                                    </p>
                                ) : null}
                                <h2
                                    id="landing-banner-headline"
                                    className={styles.landingBannerHeadline}
                                >
                                    {finalHeadline}
                                </h2>
                            </div>
                        </div>
                    </div>
                    <p className={styles.landingBannerSrOnly} aria-live="polite">
                        {LANDING_BANNER_CAROUSEL_SLIDES[BANNER_SLIDE_INDEX].alt}
                    </p>
                </div>
            </div>
        </header>
    );
}

export function LandingBannerPersonalized({
    headlineOverride = "",
    kickerOverride = "",
    bannerAdCreativeUrl = "",
}) {
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [failedSlides, setFailedSlides] = useState(() => new Set());

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 720px)");
        const sync = () => setIsMobileViewport(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    const finalHeadline = headlineOverride || landingBanner.headline;
    const finalKicker = kickerOverride || landingBanner.kicker;

    return (
        <header
            className={styles.landingBanner}
            role="banner"
            aria-labelledby="landing-banner-headline"
        >
            <div className={styles.landingBannerInner}>
                <div className={styles.landingBannerLayout}>
                    <BannerPhotoSection
                        bannerAdCreativeUrl={bannerAdCreativeUrl}
                        isMobileViewport={isMobileViewport}
                        failedSlides={failedSlides}
                        setFailedSlides={setFailedSlides}
                    />
                    <div className={styles.landingBannerCopy}>
                        <div className={styles.landingBannerTextColumn}>
                            <div className={styles.landingBannerText}>
                                {finalKicker ? (
                                    <p className={styles.landingBannerKicker}>
                                        {finalKicker}
                                    </p>
                                ) : null}
                                <h2
                                    id="landing-banner-headline"
                                    className={styles.landingBannerHeadline}
                                >
                                    {finalHeadline}
                                </h2>
                            </div>
                        </div>
                    </div>
                    <p className={styles.landingBannerSrOnly} aria-live="polite">
                        {LANDING_BANNER_CAROUSEL_SLIDES[BANNER_SLIDE_INDEX].alt}
                    </p>
                </div>
            </div>
        </header>
    );
}
