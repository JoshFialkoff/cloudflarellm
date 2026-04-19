import { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";
import { landingBanner } from "../lib/homePageCopy";
import {
    LANDING_BANNER_CAROUSEL_INTERVAL_MS,
    LANDING_BANNER_CAROUSEL_SLIDES,
    LANDING_BANNER_DEFAULT_OBJECT_POSITION,
} from "../lib/landingBannerPhotos";

const HEART_PATH =
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

/**
 * Top strip: rotating photos fill the area inside the green border; headline + logo on top.
 */
export default function LandingBanner() {
    const [slideIndex, setSlideIndex] = useState(0);
    const slideCount = LANDING_BANNER_CAROUSEL_SLIDES.length;

    useEffect(() => {
        if (slideCount <= 1) return undefined;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (mq.matches) return undefined;
        const id = window.setInterval(() => {
            setSlideIndex((i) => (i + 1) % slideCount);
        }, LANDING_BANNER_CAROUSEL_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [slideCount]);

    return (
        <header
            className={styles.landingBanner}
            role="banner"
            aria-labelledby="landing-banner-headline"
        >
            <div className={styles.landingBannerInner}>
                <div className={styles.landingBannerLayout}>
                    <div
                        className={styles.landingBannerPhotoFill}
                        aria-hidden="true"
                    >
                        <div className={styles.landingBannerImageFrame}>
                            {LANDING_BANNER_CAROUSEL_SLIDES.map((slide, i) => (
                                <img
                                    key={slide.src}
                                    src={slide.src}
                                    alt=""
                                    width={1200}
                                    height={800}
                                    decoding="async"
                                    fetchPriority={i === 0 ? "high" : "auto"}
                                    /* Eager: lazy slides are often not decoded when the carousel advances → blank frame */
                                    loading="eager"
                                    className={
                                        i === slideIndex
                                            ? `${styles.landingBannerPhotoImg} ${styles.landingBannerPhotoImgVisible}`
                                            : styles.landingBannerPhotoImg
                                    }
                                    style={{
                                        objectFit: "cover",
                                        objectPosition:
                                            slide.objectPosition ??
                                            LANDING_BANNER_DEFAULT_OBJECT_POSITION,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className={styles.landingBannerCopy}>
                        <div className={styles.landingBannerTopRow}>
                            <div
                                className={styles.landingBannerBrand}
                                aria-hidden="true"
                            >
                                <span className={styles.landingBannerMark}>
                                    <svg
                                        className={styles.landingBannerHeart}
                                        viewBox="0 0 24 24"
                                        width="22"
                                        height="22"
                                        focusable="false"
                                    >
                                        <path
                                            fill="currentColor"
                                            d={HEART_PATH}
                                        />
                                    </svg>
                                </span>
                            </div>
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
                    </div>
                    <p
                        className={styles.landingBannerSrOnly}
                        aria-live="polite"
                    >
                        {LANDING_BANNER_CAROUSEL_SLIDES[slideIndex].alt}
                    </p>
                </div>
            </div>
        </header>
    );
}
