import { useEffect, useMemo, useState } from "react";
import styles from "../styles/Home.module.css";

export default function LandingBanner() {
    const frames = useMemo(
        () => [
            {
                src: "/banner-creative-1.png",
                alt: "Exclusive data to find assisted living in Massachusetts",
            },
            {
                src: "/banner-creative-2.png",
                alt: "Find assisted living answers in Massachusetts",
            },
        ],
        [],
    );
    const [activeFrame, setActiveFrame] = useState(0);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setActiveFrame((prev) => (prev + 1) % frames.length);
        }, 3500);

        return () => window.clearInterval(intervalId);
    }, [frames.length]);

    return (
        <div className={styles.landingBanner} role="banner">
            <div className={styles.landingBannerInner}>
                <p className={styles.landingBannerEyebrow}>Massachusetts Assisted Living</p>
                <h2 className={styles.landingBannerHeading}>Use Exclusive Data to Find Better Care</h2>
                <div className={styles.landingBannerFrame}>
                    {/* Button removed from layout: image area rotates only. */}
                    <img
                        src={frames[activeFrame].src}
                        alt={frames[activeFrame].alt}
                        className={styles.landingBannerSlide}
                        width="320"
                        height="250"
                        decoding="async"
                        fetchpriority="high"
                        loading="eager"
                    />
                </div>
            </div>
        </div>
    );
}
