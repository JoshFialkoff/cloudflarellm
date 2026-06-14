import { posthog } from "./posthogClient";
import { getSessionMarketingAttribution } from "./marketingAttribution";
import { pushLandingDataLayer } from "./landingAnalytics";
import { pushConversionDataLayer } from "./conversionDataLayer";

function canCapture() {
    return typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

function mergeAttribution(properties = {}) {
    return {
        widget: "custom",
        ...getSessionMarketingAttribution(),
        ...properties,
    };
}

function capturePosthog(event, properties) {
    if (!canCapture()) return;
    try {
        posthog.capture(event, mergeAttribution(properties));
    } catch {
        // Analytics must not break UX.
    }
}

function pushChatDataLayer(event, properties) {
    pushLandingDataLayer({
        event,
        ...mergeAttribution(properties),
    });
}

/** Sanitize user text for analytics — max 80 chars, no emails/phones. */
export function messagePreview(text) {
    if (!text) return undefined;
    let s = String(text).trim().slice(0, 80);
    s = s.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]");
    s = s.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]");
    s = s.replace(/\b\d{5}(?:-\d{4})?\b/g, "[zip]");
    return s || undefined;
}

/** Call once when the chat widget mounts/opens. */
export function trackChatStarted(extra = {}) {
    const props = mergeAttribution(extra);
    capturePosthog("typebot_started", props);
    pushChatDataLayer("typebot_started", props);
}

/** Call on every user message (replaces legacy typebot answer events). */
export function trackMessageSent(params = {}) {
    const props = mergeAttribution(params);
    capturePosthog("typebot_question_answered", props);
    pushChatDataLayer("typebot_question_answered", props);
}

/**
 * Call when the user reaches the end of the chat flow.
 * Fires typebot_completed (funnel) and lead_submitted (CPA).
 */
export function trackChatCompleted(params = {}, { leadOnly = false } = {}) {
    const props = mergeAttribution(params);

    if (!leadOnly) {
        capturePosthog("typebot_completed", props);
        pushConversionDataLayer({
            event: "typebot_completed",
            ...props,
        });
    }

    capturePosthog("lead_submitted", {
        source: "ai_chat_widget",
        ...props,
    });
    pushConversionDataLayer({
        event: "lead_submitted",
        source: "ai_chat_widget",
        ...props,
    });
}

/** Call when a user selects a Likert satisfaction rating after seeing results. */
export function trackResultsSatisfactionRated(params = {}) {
    const props = mergeAttribution(params);
    capturePosthog("results_satisfaction_rated", props);
    pushChatDataLayer("results_satisfaction_rated", props);
}

/** Call when a user submits an optional comment after rating results. */
export function trackResultsSatisfactionComment(params = {}) {
    const props = mergeAttribution(params);
    capturePosthog("results_satisfaction_comment", props);
    pushChatDataLayer("results_satisfaction_comment", props);
}

/** Call when a user skips the optional comment step. */
export function trackResultsSatisfactionDismissed(params = {}) {
    const props = mergeAttribution(params);
    capturePosthog("results_satisfaction_dismissed", props);
    pushChatDataLayer("results_satisfaction_dismissed", props);
}
