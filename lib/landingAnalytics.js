import { captureWithExperiment } from "./posthogClient";

/** Matches pages/index.js (lazy YouTube) vs pages/index-video.js (inline iframe). */
export const HOMEPAGE_LAYOUT = {
    youtube_facade: "youtube_facade",
    youtube_inline: "youtube_inline",
};

/**
 * Pushes a GTM-friendly object (GA4 can subscribe via GTM tags).
 * Never include PII in payload.
 */
export function pushLandingDataLayer(payload) {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
}

export function captureLandingEvent(event, properties) {
    if (typeof window === "undefined") return;
    captureWithExperiment(event, properties);
    pushLandingDataLayer({
        event,
        ...properties,
    });
}

/**
 * Typebot passes rich objects; only forward safe metadata (no answers / labels).
 * @param {unknown} block
 */
export function typebotBlockMeta(block) {
    if (!block || typeof block !== "object") return {};
    /** @type {Record<string, string | number | boolean>} */
    const out = {};
    for (const key of [
        "id",
        "type",
        "groupId",
        "blockId",
        "outgoingEdgeId",
    ]) {
        if (!(key in block)) continue;
        const v = /** @type {Record<string, unknown>} */ (block)[key];
        const t = typeof v;
        if (t === "string" || t === "number" || t === "boolean") {
            out[key] = v;
        }
    }
    return out;
}
