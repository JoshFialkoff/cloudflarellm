import { getSessionMarketingAttribution } from "./marketingAttribution";

function newEventId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Pushes a GTM dataLayer object with session marketing context and a stable
 * event_id for deduplication (e.g. Reddit Pixel + Conversions API, GA4).
 * When NEXT_PUBLIC_GA_MEASUREMENT_ID is set, also sends the same conversion
 * via gtag (disable duplicate GA4 Event tags in GTM for the same events).
 */
export function pushConversionDataLayer(payload) {
    if (typeof window === "undefined") return;

    if (!Array.isArray(window.dataLayer)) {
        window.dataLayer = [];
    }
    const event_id = payload.event_id ?? newEventId();
    const attribution = getSessionMarketingAttribution();
    const eventName =
        typeof payload.event === "string" && payload.event.trim()
            ? payload.event.trim()
            : "conversion";

    const dlObject = {
        ...attribution,
        ...payload,
        event: eventName,
        event_id,
        transaction_id: String(event_id),
    };

    window.dataLayer.push(dlObject);

    const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    const gtagFn = typeof globalThis.gtag === "function" ? globalThis.gtag : null;
    if (!gaMeasurementId || !gtagFn) return;

    const { event: _e, event_id: _id, transaction_id: _tx, ...restDl } = dlObject;
    gtagFn("event", eventName, {
        transaction_id: String(event_id),
        ...restDl,
    });
}
