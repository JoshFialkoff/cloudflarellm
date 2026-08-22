import AuthCapture from "./AuthCapture";
import styles from "../styles/SimpleMagicLinkCTA.module.css";

/**
 * Minimal email → magic-link CTA.
 * Wraps the existing AuthCapture component (handles /api/auth/request-magic-link).
 * Much simpler than ConsumerLeadCapture; no name/town/care-need fields.
 */
export default function SimpleMagicLinkCTA({
  title = "Get free planning tools by email",
  subtitle = "Enter your email and we'll send you a sign-in link so you can save guides, comparisons, and checklists.",
  buttonLabel = "Send my sign-in link",
  authSurface = "trust_center_magic_link",
  redirectTo = "/results",
  page = "",
}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.subtitle}>{subtitle}</p>
      <AuthCapture
        authSurface={authSurface}
        formId={`${authSurface}_form`}
        buttonLabel={buttonLabel}
        redirectTo={redirectTo}
        reason=""
        successMessage="Check your email — your sign-in link is on the way."
      />
    </div>
  );
}
