// ⚠️ CRITICAL_FEATURE: Registration CTA Analytics — wire into PostHog + dataLayer
// Track all registration CTA surfaces: share_family, save_results, chat_email_capture
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
            // Analytics must not break UX
        }
    }
    if (asConversion) {
        pushConversionDataLayer({ event, ...merged });
    } else {
        pushLandingDataLayer({ event, ...merged });
    }
}

/* ───────────────────────── Tier 1: Share with Family ─────────────────────── */

export function trackShareResultsCTAShown(props = {}) {
    captureEvent("share_results_cta_shown", props);
}

export function trackShareResultsCTAExpanded(props = {}) {
    captureEvent("share_results_cta_expanded", props);
}

export function trackShareResultsFormFocused(props = {}) {
    captureEvent("share_results_form_focused", props);
}

export function trackShareResultsFormTypingStarted(props = {}) {
    captureEvent("share_results_form_typing_started", props);
}

export function trackShareResultsSubmitted(props = {}) {
    captureEvent("share_results_submitted", props, { asConversion: true });
    captureEvent("generate_lead", {
        lead_source: "share_results_family",
        ...props,
    }, { asConversion: true });
}

export function trackShareResultsFailed(props = {}) {
    captureEvent("share_results_failed", props);
}

/* ────────────────────── Tier 2: Save / Loss-Aversion ─────────────────────── */

export function trackSaveResultsCTAShown(props = {}) {
    captureEvent("save_results_cta_shown", props);
}

export function trackSaveResultsCTAClicked(props = {}) {
    captureEvent("save_results_cta_clicked", props);
}

export function trackSaveResultsSubmitted(props = {}) {
    captureEvent("save_results_submitted", props, { asConversion: true });
    captureEvent("generate_lead", {
        lead_source: "save_results",
        ...props,
    }, { asConversion: true });
}

/* ────────────────────────── Tier 3: Chat Email ───────────────────────────── */

export function trackChatEmailCaptureShown(props = {}) {
    captureEvent("chat_email_capture_shown", props);
}

export function trackChatEmailCaptureFocused(props = {}) {
    captureEvent("chat_email_capture_focused", props);
}

export function trackChatEmailCaptureTypingStarted(props = {}) {
    captureEvent("chat_email_capture_typing_started", props);
}

export function trackChatEmailCaptureSubmitted(props = {}) {
    captureEvent("chat_email_capture_submitted", props, { asConversion: true });
    captureEvent("generate_lead", {
        lead_source: "chat_email_capture",
        ...props,
    }, { asConversion: true });
}

/* ────────────────────────── Tier 4: Find Safest ─────────────────────────── */

export function trackFindSafestSubmitted(props = {}) {
    captureEvent("find_safest_submitted", props, { asConversion: true });
    captureEvent("generate_lead", {
        lead_source: "find_safest",
        ...props,
    }, { asConversion: true });
}
