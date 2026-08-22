/**
 * NextDoor campaign analytics module.
 *
 * Provides dedicated event helpers for NextDoor traffic funnels.
 * Every event fires to BOTH PostHog (with nd_* super-properties) and GA4 via dataLayer.
 * Use these helpers when tracking NextDoor-specific flows (intake, search, compare, inquiry).
 *
 * To create PostHog cohorts:
 *   - Person property `is_nextdoor_traffic` = true
 *   - Or: `traffic_source` = "nextdoor"
 *
 * To build funnels:
 *   - nextdoor_intake_start → nextdoor_intake_step → nextdoor_intake_complete
 *   - nextdoor_pageview → nextdoor_search → nextdoor_shortlist_add → nextdoor_inquiry_submit
 */

import { captureNextdoorEvent } from "./posthogClient";
import { getSessionMarketingAttribution, getNextdoorAttributionProperties } from "./marketingAttribution";
import {
    trackNextdoorPageView,
    trackNextdoorViewContent,
    trackNextdoorLead as ndTrackLead,
    trackNextdoorSignUp as ndTrackSignUp,
    trackNextdoorSearch as ndTrackSearch,
    trackNextdoorCustomConversion as ndTrackCustomConversion,
} from "./nextdoorUniversalPixel";

/**
 * Enrich any payload with NextDoor marketing context.
 */
function ndPayload(extra = {}) {
    const touch = getSessionMarketingAttribution();
    const nd = getNextdoorAttributionProperties();
    return {
        ...touch,
        ...nd,
        traffic_source: nd.is_nextdoor_traffic ? "nextdoor" : (touch.utm_source || touch.inferred_source || undefined),
        ...extra,
    };
}

/**
 * Push to dataLayer for GA4 / GTM parity.
 */
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

// ---------------------------------------------------------------------------
// Page / Session events
// ---------------------------------------------------------------------------

/** Fire when a NextDoor-sourced user lands on a tracked page (including first pageview). */
export function trackNextdoorPageview(url, extra = {}) {
    const props = ndPayload({ page_url: url, ...extra });
    captureNextdoorEvent("nextdoor_pageview", props);
    pushDataLayer("nextdoor_pageview", props);
    // Standard Nextdoor Universal Pixel event (for GTM template + direct ndp)
    trackNextdoorPageView({ page_url: url, ...extra });
}

/** Fire when a NextDoor user performs a site search. */
export function trackNextdoorSearch(query, resultCount, extra = {}) {
    const props = ndPayload({ search_query: String(query).slice(0, 256), result_count: resultCount, ...extra });
    captureNextdoorEvent("nextdoor_search", props);
    pushDataLayer("nextdoor_search", props);
    // Standard Nextdoor Universal Pixel event
    ndTrackSearch({ search_query: String(query).slice(0, 256), result_count: resultCount, ...extra });
}

// ---------------------------------------------------------------------------
// Intake funnel events
// ---------------------------------------------------------------------------

/** User from NextDoor started the intake wizard. */
export function trackNextdoorIntakeStart(extra = {}) {
    const props = ndPayload(extra);
    captureNextdoorEvent("nextdoor_intake_start", props);
    pushDataLayer("nextdoor_intake_start", props);
}

/** User from NextDoor completed an intake step. */
export function trackNextdoorIntakeStep(stepName, value, extra = {}) {
    const props = ndPayload({
        intake_step: stepName,
        intake_value: Array.isArray(value) ? value.join(",") : String(value ?? ""),
        ...extra,
    });
    captureNextdoorEvent("nextdoor_intake_step", props);
    pushDataLayer("nextdoor_intake_step", props);
}

/** User from NextDoor completed the entire intake. */
export function trackNextdoorIntakeComplete(answers, extra = {}) {
    const props = ndPayload({
        care_needs: answers.care_needs || "",
        budget: answers.budget || "",
        location: answers.location || "",
        timing: answers.timing || "",
        priorities: Array.isArray(answers.priorities) ? answers.priorities.join(",") : "",
        conversion: true,
        ...extra,
    });
    captureNextdoorEvent("nextdoor_intake_complete", props);
    pushDataLayer("nextdoor_intake_complete", props);
    // Also fire a generic conversion tag for GA4 / GTM custom conversion triggers
    pushDataLayer("nextdoor_conversion", { conversion_name: "intake_complete", ...props });
    // Standard Nextdoor Universal Pixel: intake complete = Lead
    ndTrackLead({ intake_step: "complete", ...answers, ...extra });
}

// ---------------------------------------------------------------------------
// Results & shortlist events
// ---------------------------------------------------------------------------

/** NextDoor user clicked a matched facility result. */
export function trackNextdoorMatchedResultClick(facilitySlug, rank, score, extra = {}) {
    const props = ndPayload({ facility_slug: facilitySlug, match_rank: rank, match_score: score, ...extra });
    captureNextdoorEvent("nextdoor_matched_result_click", props);
    pushDataLayer("nextdoor_matched_result_click", props);
    // Standard Nextdoor Universal Pixel
    trackNextdoorViewContent({ facility_slug: facilitySlug, content_type: "matched_result", ...extra });
}

/** NextDoor user added a facility to their shortlist. */
export function trackNextdoorShortlistAdd({ facilityId, slug, source = "nextdoor" }) {
    const props = ndPayload({ facility_id: facilityId, slug, source, action: "shortlist_add" });
    captureNextdoorEvent("nextdoor_shortlist_add", props);
    pushDataLayer("nextdoor_shortlist_add", props);
    // Standard Nextdoor Universal Pixel custom conversion
    ndTrackCustomConversion("shortlist_add", { facility_id: facilityId, slug, source });
}

/** NextDoor user opened the compare tool. */
export function trackNextdoorCompareOpen({ count, slugs }) {
    const props = ndPayload({ facility_count: count, slugs: slugs?.join(",") });
    captureNextdoorEvent("nextdoor_compare_open", props);
    pushDataLayer("nextdoor_compare_open", props);
    // Standard Nextdoor Universal Pixel custom conversion
    ndTrackCustomConversion("compare_open", { facility_count: count, slugs: slugs?.join(",") });
}

// ---------------------------------------------------------------------------
// Inquiry / conversion events
// ---------------------------------------------------------------------------

/** NextDoor user submitted an inquiry (matched flow, compare, or facility page). */
export function trackNextdoorInquirySubmit(facilitySlug, surface = "unknown", extra = {}) {
    const props = ndPayload({
        facility_slug: facilitySlug,
        inquiry_surface: surface,
        conversion: true,
        ...extra,
    });
    captureNextdoorEvent("nextdoor_inquiry_submit", props);
    pushDataLayer("nextdoor_inquiry_submit", props);
    pushDataLayer("nextdoor_conversion", { conversion_name: "inquiry_submit", ...props });
    // Standard Nextdoor Universal Pixel: inquiry = Lead
    ndTrackLead({ facility_slug: facilitySlug, inquiry_surface: surface, ...extra });
}

/** NextDoor user verified auth (magic link). */
export function trackNextdoorAuthVerified(surface, redirectTo, extra = {}) {
    const props = ndPayload({ auth_surface: surface, redirect_to: redirectTo, ...extra });
    captureNextdoorEvent("nextdoor_auth_verified", props);
    pushDataLayer("nextdoor_auth_verified", props);
    // Standard Nextdoor Universal Pixel: verified auth = SignUp
    ndTrackSignUp({ auth_surface: surface, redirect_to: redirectTo, ...extra });
}
