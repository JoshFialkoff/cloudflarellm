import posthog from "./posthogClient";
import { getSessionMarketingAttribution } from "./marketingAttribution";
import { pushLandingDataLayer } from "./landingAnalytics";
import { pushConversionDataLayer } from "./conversionDataLayer";

const GTM_BLOCKED_FIELDS = new Set([
    "message_preview",
    "text",
    "email",
    "phone",
    "phone_number",
    "zip_code",
]);

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

function normalizeBotFunnelContext(properties = {}) {
    const homepage_layout =
        typeof properties.homepage_layout === "string" && properties.homepage_layout.trim()
            ? properties.homepage_layout.trim()
            : undefined;
    const bot_surface =
        typeof properties.bot_surface === "string" && properties.bot_surface.trim()
            ? properties.bot_surface.trim()
            : homepage_layout
              ? "homepage"
              : "unknown";
    const assistant_mode =
        typeof properties.assistant_mode === "string" && properties.assistant_mode.trim()
            ? properties.assistant_mode.trim()
            : bot_surface === "homepage"
              ? "assistedly_wizard"
              : "unknown";
    const bot_id =
        typeof properties.bot_id === "string" && properties.bot_id.trim()
            ? properties.bot_id.trim()
            : assistant_mode === "assistedly_wizard"
              ? "homepage-assistedly-wizard"
              : "unknown";
    const lead_source =
        typeof properties.lead_source === "string" && properties.lead_source.trim()
            ? properties.lead_source.trim()
            : `${bot_surface}_${assistant_mode}`;

    return {
        ...properties,
        ...(homepage_layout ? { homepage_layout } : {}),
        bot_surface,
        assistant_mode,
        bot_id,
        lead_source,
    };
}

function sanitizeForDataLayer(properties = {}) {
    const out = {};
    for (const [key, value] of Object.entries(properties)) {
        if (GTM_BLOCKED_FIELDS.has(key) || value == null) continue;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            out[key] = value;
        }
    }
    return out;
}

function capturePosthog(event, properties) {
    if (!canCapture()) return;
    try {
        posthog.capture(event, mergeAttribution(properties));
    } catch {
        // Analytics must not break UX.
    }
}

export function pushChatDataLayer(event, properties) {
    pushLandingDataLayer({
        event,
        ...sanitizeForDataLayer(mergeAttribution(properties)),
    });
}

function pushConversionDataLayerSafe(payload) {
    pushConversionDataLayer({
        ...sanitizeForDataLayer(payload),
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
    const props = normalizeBotFunnelContext({
        ...extra,
        funnel_stage: extra.funnel_stage || "chat_started",
    });
    capturePosthog("typebot_started", props);
    pushChatDataLayer("typebot_started", props);
}

/** Call on every user message (replaces legacy typebot answer events). */
export function trackMessageSent(params = {}) {
    const props = normalizeBotFunnelContext({
        ...params,
        funnel_stage: params.funnel_stage || "step_answered",
    });
    capturePosthog("typebot_question_answered", props);
    pushChatDataLayer("typebot_question_answered", props);
}

/**
 * Call when the user reaches the end of the chat flow.
 * Fires typebot_completed (funnel) and lead_submitted (CPA).
 */
export function trackChatCompleted(params = {}, { leadOnly = false } = {}) {
    const props = normalizeBotFunnelContext({
        ...params,
        funnel_stage: params.funnel_stage || "chat_completed",
    });

    if (!leadOnly) {
        capturePosthog("typebot_completed", props);
        pushConversionDataLayerSafe({
            event: "typebot_completed",
            ...props,
        });
    }

    const leadProps = {
        source: "ai_chat_widget",
        ...props,
        funnel_stage: "lead_submitted",
    };
    capturePosthog("lead_submitted", leadProps);
    pushConversionDataLayerSafe({
        event: "lead_submitted",
        ...leadProps,
    });

    // Standard Nextdoor Universal Pixel: chat lead = Lead
    try {
        import("./nextdoorUniversalPixel").then(({ trackNextdoorLead }) => {
            trackNextdoorLead({ lead_source: "ai_chat_widget", ...leadProps });
        });
    } catch {
        /* silent */
    }
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
