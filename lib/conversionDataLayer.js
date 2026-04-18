import { getSessionMarketingAttribution } from "./marketingAttribution";

function newEventId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Pushes a GTM dataLayer object with session marketing context and a stable
 * event_id for deduplication (e.g. Reddit Pixel + Conversions API).
 */
export function pushConversionDataLayer(payload) {
    if (typeof window === "undefined") return;

    if (!Array.isArray(window.dataLayer)) {
        window.dataLayer = [];
    }
    const event_id = payload.event_id ?? newEventId();
    const attribution = getSessionMarketingAttribution();

    window.dataLayer.push({
        ...attribution,
        ...payload,
        event_id,
    });
}
