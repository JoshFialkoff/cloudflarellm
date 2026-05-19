import styles from "../styles/Home.module.css";

/**
 * Rotating homepage H1: highlights the care type that changes (assisted living vs memory care)
 * so the swap reads as intentional, not a glitch.
 */
export default function HomeHeroHeadline({
    useDementiaHeadline,
    useFallbackRotation,
    rotationStep,
}) {
    const hi = styles.heroHeadlineHighlight;

    if (useDementiaHeadline) {
        return (
            <h1 className={styles.heroTitle}>
                Unbiased AI Finds Best <span className={hi}>Memory Care</span> for Dementia in
                Massachusetts
            </h1>
        );
    }

    if (useFallbackRotation && rotationStep === 1) {
        return (
            <h1 className={styles.heroTitle}>
                Unbiased AI Finds Best <span className={hi}>Memory Care</span> in Massachusetts
            </h1>
        );
    }

    return (
        <h1 className={styles.heroTitle}>
            Unbiased AI Finds Best <span className={hi}>Assisted Living</span> in Massachusetts
        </h1>
    );
}
