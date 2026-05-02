import { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";
import { landingBanner } from "../lib/homePageCopy";
import {
    buildBannerProxyUrl,
    LANDING_BANNER_CAROUSEL_INTERVAL_MS,
    LANDING_BANNER_CAROUSEL_SLIDES,
    LANDING_BANNER_DEFAULT_OBJECT_POSITION,
} from "../lib/landingBannerPhotos";

const HEART_PATH =
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

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
 * Top strip: two-image rail with centered logo and rotating image set.
 * Optional overrides personalize the headline/kicker (e.g. Reddit ad context).
 * When `bannerAdCreativeUrl` is set (https ad image), the first visible tile uses it instead of the carousel slide.
 */
export default function LandingBanner({
    headlineOverride = "",
    kickerOverride = "",
    bannerAdCreativeUrl = "",
}) {
    const [slideIndex, setSlideIndex] = useState(0);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [failedSlides, setFailedSlides] = useState(() => new Set());
    const slideCount = LANDING_BANNER_CAROUSEL_SLIDES.length;

    useEffect(() => {
        if (slideCount <= 1) return undefined;
        const id = window.setTimeout(() => {
            setSlideIndex((i) => (i + 1) % slideCount);
        }, LANDING_BANNER_CAROUSEL_INTERVAL_MS);
        return () => window.clearTimeout(id);
    }, [slideCount, slideIndex]);

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
                    <div className={styles.landingBannerPhotoCell} aria-hidden="true">
                        <div className={styles.landingBannerPhotoFrame}>
                            <LandingBannerPhotoStrip
                                bannerAdCreativeUrl={bannerAdCreativeUrl}
                                slideIndex={slideIndex}
                                isMobileViewport={isMobileViewport}
                                failedSlides={failedSlides}
                                setFailedSlides={setFailedSlides}
                            />
                            <div className={styles.landingBannerCenterLogo}>
                                <span className={styles.landingBannerMark}>
                                    <svg
                                        className={styles.landingBannerHeart}
                                        viewBox="0 0 24 24"
                                        width="30"
                                        height="30"
                                        focusable="false"
                                    >
                                        <path fill="currentColor" d={HEART_PATH} />
                                    </svg>
                                </span>
                            </div>
                        </div>
                    </div>
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
                        {LANDING_BANNER_CAROUSEL_SLIDES[slideIndex].alt}
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
    const [slideIndex, setSlideIndex] = useState(0);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [failedSlides, setFailedSlides] = useState(() => new Set());
    const slideCount = LANDING_BANNER_CAROUSEL_SLIDES.length;

    useEffect(() => {
        if (slideCount <= 1) return undefined;
        const id = window.setTimeout(() => {
            setSlideIndex((i) => (i + 1) % slideCount);
        }, LANDING_BANNER_CAROUSEL_INTERVAL_MS);
        return () => window.clearTimeout(id);
    }, [slideCount, slideIndex]);

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
                    <div className={styles.landingBannerPhotoCell} aria-hidden="true">
                        <div className={styles.landingBannerPhotoFrame}>
                            <LandingBannerPhotoStrip
                                bannerAdCreativeUrl={bannerAdCreativeUrl}
                                slideIndex={slideIndex}
                                isMobileViewport={isMobileViewport}
                                failedSlides={failedSlides}
                                setFailedSlides={setFailedSlides}
                            />
                            <div className={styles.landingBannerCenterLogo}>
                                <span className={styles.landingBannerMark}>
                                    <svg
                                        className={styles.landingBannerHeart}
                                        viewBox="0 0 24 24"
                                        width="30"
                                        height="30"
                                        focusable="false"
                                    >
                                        <path fill="currentColor" d={HEART_PATH} />
                                    </svg>
                                </span>
                            </div>
                        </div>
                    </div>
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
                        {LANDING_BANNER_CAROUSEL_SLIDES[slideIndex].alt}
                    </p>
                </div>
            </div>
        </header>
    );
}
