import { useFeatureFlagVariantKey } from 'posthog-js/react';
import styles from '../styles/Home.module.css';

const HEADLINE_EXPERIMENT_FLAG = 'homepage-headline-2026-06-21';

export default function HomeHeroHeadline({
  useDementiaHeadline,
  useFallbackRotation,
  rotationStep,
}) {
  const hi = styles.heroHeadlineHighlight;
  const headlineVariant = useFeatureFlagVariantKey(HEADLINE_EXPERIMENT_FLAG);

  if (headlineVariant === 'variant' || headlineVariant === true) {
    return (
      <h1 className={styles.heroTitle}>
        Use data, not stock photos, like these to make life-changing decisions.
      </h1>
    );
  }

  if (useDementiaHeadline) {
    return (
      <h1 className={styles.heroTitle}>
        Unbiased AI Finds Best <span className={hi}>Memory Care</span> for
        Dementia in Massachusetts
      </h1>
    );
  }

  if (useFallbackRotation && rotationStep === 1) {
    return (
      <h1 className={styles.heroTitle}>
        Unbiased AI Finds Best <span className={hi}>Memory Care</span> in
        Massachusetts
      </h1>
    );
  }

  return (
    <h1 className={styles.heroTitle}>
      Unbiased AI Finds Best <span className={hi}>Assisted Living</span> in
      Massachusetts
    </h1>
  );
}
