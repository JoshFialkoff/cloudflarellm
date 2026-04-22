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

/**
 * Top strip: two-image rail with centered logo and rotating image set.
 */
export default function LandingBanner() {
    const [slideIndex, setSlideIndex] = useState(0);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [failedSlides, setFailedSlides] = useState(() => new Set());
    const slideCount = LANDING_BANNER_CAROUSEL_SLIDES.length;
    const useProxy = process.env.NEXT_PUBLIC_BANNER_USE_PROXY === "1";
    const visibleCount = 2;

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
                            <div className={styles.landingBannerPhotoStrip}>
                                {Array.from({ length: visibleCount }, (_, slot) => {
                                    const i = (slideIndex + slot) % slideCount;
                                    const slide = LANDING_BANNER_CAROUSEL_SLIDES[i];
                                    return (
                                        <div
                                            key={`${slide.src}-${slot}`}
                                            className={styles.landingBannerPhotoTile}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={
                                                    !useProxy ||
                                                    failedSlides.has(i) ||
                                                    !slide.proxyPaths?.length
                                                        ? slide.src
                                                        : buildBannerProxyUrl(
                                                              slide.proxyPaths,
                                                              isMobileViewport ? "portrait" : "wide",
                                                          )
                                                }
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
                                                onError={() =>
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
                                                    objectPosition:
                                                        (isMobileViewport
                                                            ? slide.objectPositionMobile
                                                            : slide.objectPosition) ??
                                                        LANDING_BANNER_DEFAULT_OBJECT_POSITION,
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
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
                                {landingBanner.kicker ? (
                                    <p className={styles.landingBannerKicker}>
                                        {landingBanner.kicker}
                                    </p>
                                ) : null}
                                <h2
                                    id="landing-banner-headline"
                                    className={styles.landingBannerHeadline}
                                >
                                    {landingBanner.headline}
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
