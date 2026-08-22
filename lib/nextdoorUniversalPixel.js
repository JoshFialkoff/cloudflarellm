/**
 * Nextdoor Universal Pixel — standard event wrappers.
 *
 * Fires Nextdoor-standard events (PageView, Lead, SignUp, Search, ViewContent,
 * CustomConversion) to:
 *   1) window.ndp — direct pixel (if base code is present)
 *   2) window.dataLayer — GTM / GA4 routing
 *
 * The Nextdoor Universal Pixel base code should be loaded via either:
 *   • Google Tag Manager (official Nextdoor Tag Template — recommended)
 *   • A manual script tag in pages/_document.js (paste exact base code from NAM)
 *
 * Env:
 *   NEXT_PUBLIC_NEXTDOOR_PIXEL_ID — optional; used only if loading manually.
 *
 * GTM setup (recommended):
 *   1. Add the "Nextdoor Pixel" tag template from the GTM Template Gallery.
 *   2. Create a tag "Nextdoor – PageView" triggered on `nd_page_view`.
 *   3. Create a tag "Nextdoor – Lead" triggered on `nd_lead`.
 *   4. Create a tag "Nextdoor – SignUp" triggered on `nd_sign_up`.
 *   5. Map Custom Event Name in the template to the dataLayer `event` value.
 *   6. Use `event_id` variable for deduplication.
 */

import { getSessionMarketingAttribution } from "./marketingAttribution";
import { newEventId } from "./conversionDataLayer";

function ndpAvailable() {
    return typeof window !== "undefined" && typeof window.ndp === "function";
}

function ensureNdpQueue() {
    if (typeof window === "undefined") return;
    if (!window.ndp) {
        window.ndp = [];
    }
}

function pushDataLayer(eventName, params) {
    if (typeof window === "undefined" || !Array.isArray(window.dataLayer)) return;
    try {
        window.dataLayer.push({
            event: eventName,
            ...params,
        });
    } catch {
        /* silent */
    }
}

/**
 * Fire a Nextdoor Universal Pixel event.
 * @param {string} eventName — Nextdoor standard event: PageView, Lead, SignUp, Search, ViewContent, CustomConversion
 * @param {Record<string, unknown>} params — optional extra params
 */
export function trackUniversalNextdoorEvent(eventName, params = {}) {
    if (typeof window === "undefined") return;

    const event_id = params.event_id || newEventId();
    const merged = {
        event_id,
        transaction_id: String(event_id),
        ...getSessionMarketingAttribution(),
        ...params,
    };

    // 1. Direct ndp pixel (if base code loaded elsewhere — GTM template or manual)
    try {
        ensureNdpQueue();
        if (ndpAvailable()) {
            window.ndp("track", eventName, merged);
        } else if (Array.isArray(window.ndp)) {
            window.ndp.push(["track", eventName, merged]);
        }
    } catch {
        /* silent — never block UX */
    }

    // 2. dataLayer for GTM → Nextdoor Tag Template + GA4 + PostHog (via GTM reverse-proxy if desired)
    const dlEventName = `nd_${eventName.replace(/([A-Z])/g, "_$1").toLowerCase()}`;
    pushDataLayer(dlEventName, merged);
}

/** PageView — fire on every page load (global audience + retargeting). */
export function trackNextdoorPageView(params = {}) {
    trackUniversalNextdoorEvent("PageView", params);
}

/** Lead — intake complete, inquiry submit, deep-dive request. */
export function trackNextdoorLead(params = {}) {
    trackUniversalNextdoorEvent("Lead", { conversion: true, ...params });
}

/** SignUp — email capture, magic-link verify, registration. */
export function trackNextdoorSignUp(params = {}) {
    trackUniversalNextdoorEvent("SignUp", { conversion: true, ...params });
}

/** Search — any site search. */
export function trackNextdoorSearch(params = {}) {
    trackUniversalNextdoorEvent("Search", params);
}

/** ViewContent — facility page, tool page, blog article. */
export function trackNextdoorViewContent(params = {}) {
    trackUniversalNextdoorEvent("ViewContent", params);
}

/** CustomConversion — use when none of the standard events fit.
 * @param {string} nickname — human-friendly name shown in NAM (e.g. "shortlist_add")
 */
export function trackNextdoorCustomConversion(nickname, params = {}) {
    trackUniversalNextdoorEvent("CustomConversion", {
        custom_conversion_nickname: nickname,
        conversion: true,
        ...params,
    });
}
