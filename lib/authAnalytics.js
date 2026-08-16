import posthog from "./posthogClient";
import { getSessionMarketingAttribution } from "./marketingAttribution";
import { pushLandingDataLayer } from "./landingAnalytics";
import { pushConversionDataLayer } from "./conversionDataLayer";

function canCapture() {
    return typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

function mergeProps(properties = {}) {
    return {
        widget: "custom",
        ...getSessionMarketingAttribution(),
        ...properties,
    };
}

function captureEvent(event, properties = {}, { asConversion = false } = {}) {
    const merged = mergeProps(properties);
    if (canCapture()) {
        try {
            posthog.capture(event, merged);
        } catch {
            // Analytics must not break UX.
        }
    }
    if (asConversion) {
        pushConversionDataLayer({ event, ...merged });
    } else {
        pushLandingDataLayer({ event, ...merged });
    }
}

/** Bucket length without exposing email content. */
export function emailLengthBucket(length) {
    const n = Number(length) || 0;
    if (n <= 0) return "empty";
    if (n <= 5) return "1-5";
    if (n <= 15) return "6-15";
    if (n <= 30) return "16-30";
    return "31+";
}

export function trackAuthEmailFocused(props = {}) {
    captureEvent("auth_email_focused", props);
}

export function trackAuthEmailTypingStarted(props = {}) {
    captureEvent("auth_email_typing_started", props);
}

export function trackAuthFormSubmitted(props = {}) {
    captureEvent("auth_form_submitted", props);
}

export function trackAuthMagicLinkSent(props = {}) {
    captureEvent("auth_magic_link_sent", props, { asConversion: true });
    captureEvent("generate_lead", {
        lead_source: props.auth_surface || "magic_link",
        ...props,
    }, { asConversion: true });
    // Standard Nextdoor Universal Pixel: email capture = Lead
    try {
        import("./nextdoorUniversalPixel").then(({ trackNextdoorLead }) => {
            trackNextdoorLead({ lead_source: props.auth_surface || "magic_link", ...props });
        });
    } catch {
        /* silent */
    }
}

export function trackAuthMagicLinkRequestFailed(props = {}) {
    captureEvent("auth_magic_link_request_failed", props);
}

export function trackAuthTestLinkClicked(props = {}) {
    captureEvent("auth_test_link_clicked", props);
}

export function trackAuthMagicLinkVerified(props = {}) {
    captureEvent("auth_magic_link_verified", props, { asConversion: true });
    captureEvent("auth_signed_in", props, { asConversion: true });
    // Standard Nextdoor Universal Pixel: verified auth = SignUp
    try {
        import("./nextdoorUniversalPixel").then(({ trackNextdoorSignUp }) => {
            trackNextdoorSignUp({ auth_surface: props.auth_surface || "magic_link", ...props });
        });
    } catch {
        /* silent */
    }
}

export function trackAuthResultsPageViewed(props = {}) {
    captureEvent("auth_results_page_viewed", props);
}

export function trackAuthResultsDataViewed(props = {}) {
    captureEvent("auth_results_data_viewed", props, { asConversion: true });
}

/** Wizard save/continue analytics */
export function trackWizardSavePromptShown(props = {}) {
    captureEvent("wizard_save_prompt_shown", props);
}

export function trackWizardSaveStarted(props = {}) {
    captureEvent("wizard_save_started", props);
}

export function trackWizardSaveSuccess(props = {}) {
    captureEvent("wizard_save_success", props, { asConversion: true });
    // Standard Nextdoor Universal Pixel: save = sign-up-like action
    try {
        import("./nextdoorUniversalPixel").then(({ trackNextdoorSignUp }) => {
            trackNextdoorSignUp({ save_surface: props.save_surface || "wizard", ...props });
        });
    } catch {
        /* silent */
    }
}

export function trackWizardSaveFailed(props = {}) {
    captureEvent("wizard_save_failed", props);
}

export function trackWizardRestoreAttempted(props = {}) {
    captureEvent("wizard_restore_attempted", props);
}

export function trackWizardRestoreSuccess(props = {}) {
    captureEvent("wizard_restore_success", props);
}

export function trackWizardRestoreFailed(props = {}) {
    captureEvent("wizard_restore_failed", props);
}

export function trackEmailSignupFocused(props = {}) {
    captureEvent("email_signup_focused", props);
}

export function trackEmailSignupTypingStarted(props = {}) {
    captureEvent("email_signup_typing_started", props);
}

export function trackEmailSignupSubmitted(props = {}) {
    captureEvent("email_signup_submitted", props);
}

export function trackEmailSignupFailed(props = {}) {
    captureEvent("email_signup_failed", props);
}
