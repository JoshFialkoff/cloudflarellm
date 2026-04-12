import styles from "../styles/Home.module.css";
import {
    LANDING_BANNER_ALT,
    LANDING_BANNER_HEIGHT,
    LANDING_BANNER_SRC,
    LANDING_BANNER_WIDTH,
} from "../lib/landingBannerAssets";

export default function LandingBanner() {
    return (
        <div className={styles.landingBanner} role="banner">
            {/* eslint-disable-next-line @next/next/no-img-element -- static PNG from /public; avoids next/image + SVG/CDN edge cases */}
            <img
                src={LANDING_BANNER_SRC}
                alt={LANDING_BANNER_ALT}
                className={styles.landingBannerImg}
                width={LANDING_BANNER_WIDTH}
                height={LANDING_BANNER_HEIGHT}
                decoding="async"
                fetchpriority="high"
                loading="eager"
            />
        </div>
    );
}
