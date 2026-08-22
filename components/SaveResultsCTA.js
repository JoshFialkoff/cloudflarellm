// ⚠️ CRITICAL_FEATURE: Save Results CTA — additive loss-aversion CTA for matched page
// NEVER remove without !!APPROVED. Wraps AuthCapture; results remain visible first.
import AuthCapture from "./AuthCapture";
import {
    trackSaveResultsCTAShown,
    trackSaveResultsCTAClicked,
    trackSaveResultsSubmitted,
} from "../lib/registrationCTAAnalytics";
import { useEffect } from "react";
import styles from "../styles/SaveResultsCTA.module.css";

export default function SaveResultsCTA({ resultSnapshot, redirectTo = "/matched", ctaVariant = "save_results" }) {
    useEffect(() => {
        trackSaveResultsCTAShown({
            cta_variant: ctaVariant,
            has_result_snapshot: Boolean(resultSnapshot),
        });
    }, [resultSnapshot, ctaVariant]);

    return (
        <div className={styles.ctaContainer}>
            <div className={styles.formCard}>
                <h3>🔒 Save Your Personalized Report</h3>
                <p className={styles.urgencyCopy}>
                    <strong>Your results disappear if you close this tab.</strong>
                </p>
                <p className={styles.subtitle}>
                    Enter your email to save, edit, compare, and share these matches
                    — plus get a detailed AI compliance analysis sent to your inbox.
                </p>
                <AuthCapture
                    authSurface="matched_page_save_results"
                    formId="matched_save_results_magic_link"
                    reason="Save your matches and get a detailed compliance analysis."
                    redirectTo={redirectTo}
                    buttonLabel="Save my results + analysis"
                    resultSnapshot={resultSnapshot}
                    onSubmitStart={() =>
                        trackSaveResultsCTAClicked({
                            cta_variant: ctaVariant,
                            has_result_snapshot: Boolean(resultSnapshot),
                        })
                    }
                    onSuccess={(email, data) => {
                        trackSaveResultsSubmitted({
                            cta_variant: ctaVariant,
                            email,
                            ...data,
                        });
                    }}
                    successMessage="Check your email — your saved results + analysis link is on the way."
                />
            </div>
        </div>
    );
}
