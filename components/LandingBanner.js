import styles from "../styles/Home.module.css";

export default function LandingBanner() {
    return (
        <header className={styles.landingBanner} role="banner">
            <div className={styles.landingBannerInner}>
                <div className={styles.landingBannerRow}>
                    <div className={styles.landingBannerBrand}>
                        <span className={styles.landingBannerMark}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- small static asset from /public */}
                            <img
                                src="/favicon.png"
                                alt=""
                                width={32}
                                height={32}
                                className={styles.landingBannerMarkImg}
                                decoding="async"
                                fetchpriority="high"
                            />
                        </span>
                        <p className={styles.landingBannerBrandName}>
                            AI Assisted Living Companion
                        </p>
                    </div>
                    <h2 className={styles.landingBannerHeadline}>
                        Access Exclusive Data to Find Best Massachusetts Assisted Living
                    </h2>
                </div>
            </div>
        </header>
    );
}
