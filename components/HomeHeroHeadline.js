import { useFeatureFlagVariantKey } from 'posthog-js/react';
import styles from '../styles/Home.module.css';
import { HOMEPAGE_PRIVACY_EXPERIMENT_FLAG } from '../lib/posthogClient';

const HEADLINE_EXPERIMENT_FLAG = 'homepage-headline-2026-06-21';

export default function HomeHeroHeadline({
  useDementiaHeadline,
  useFallbackRotation,
  rotationStep,
}) {
  const hi = styles.heroHeadlineHighlight;
  const headlineVariant = useFeatureFlagVariantKey(HEADLINE_EXPERIMENT_FLAG);
  const privacyVariant = useFeatureFlagVariantKey(HOMEPAGE_PRIVACY_EXPERIMENT_FLAG);

  // Privacy experiment overrides all other headline logic
  if (privacyVariant === 'privacy' || privacyVariant === true) {
    return (
      <h1 className={styles.heroTitle}>
        Keep Your Family&apos;s Questions Private
      </h1>
    );
  }

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
      Find the Right Care<br />for The One You Love
    </h1>
  );
}
