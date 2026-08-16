// ⚠️ CRITICAL_FEATURE: PostHog Client — NEVER REMOVE without !!APPROVED
// Feature flags, session replay, funnel tracking. A/B tests must stay additive.
import posthog from "posthog-js";
import { getSessionMarketingAttribution, getNextdoorAttributionProperties } from "./marketingAttribution";

export { posthog };

export const HOMEPAGE_VIDEO_EXPERIMENT_FLAG = "homepage-video-experiment";

/** Web experiment: toolbar/visual editor + exposure via `useFeatureFlagVariantKey` in `SiteToolsNav`. */
export const TOP_NAV_SEARCH_EXPERIMENT_FLAG = "top-nav-search-box";

/** 50/50: budget form after urgency vs common-scenario choices (skips budget UI). */
export const WIZARD_BUDGET_SCENARIOS_EXPERIMENT_FLAG =
  "homepage-wizard-budget-vs-scenarios";

/** A/B: privacy-first messaging on homepage (control vs privacy). */
export const HOMEPAGE_PRIVACY_EXPERIMENT_FLAG = "homepage-privacy-messaging-2026-08";

/** A/B: free-text chat entry vs step-by-step wizard on homepage hero. */
export const HOMEPAGE_FREE_TEXT_ENTRY_FLAG = "homepage-free-text-entry-2026-08";

/** Multivariate: registration CTA strategy — control | share_family | save_results */
export const REGISTRATION_CTA_EXPERIMENT_FLAG = "registration-cta-experiment-2026-08";

/** Deep-dive automation opt-in per CTA surface */
export const DEEP_DIVE_OPT_IN_FLAG = "deep-dive-opt-in-2026-08";

let clientErrorNoiseFiltersInstalled = false;

const IGNORED_EXCEPTION_PATTERNS = [
  /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/i,
  /'Response' captured as exception with keys/i,
  /Response captured as exception with keys/i,
  /ErrorEvent captured as exception with keys/i,
  /^NetworkError: Load failed$/i,
];

function eventText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (typeof value !== "object") return String(value);

  const parts = [];
  const seen = new Set();
  const visit = (item) => {
    if (!item || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    for (const key of ["message", "name", "type", "value", "$exception_message"]) {
      if (typeof item[key] === "string") parts.push(item[key]);
    }
    if (Array.isArray(item.$exception_list)) {
      item.$exception_list.forEach(visit);
    }
  };
  visit(value);
  return parts.join("\n");
}

function shouldIgnoreException(value) {
  const text = eventText(value);
  return IGNORED_EXCEPTION_PATTERNS.some((pattern) => pattern.test(text));
}

function installClientErrorNoiseFilters() {
  if (typeof window === "undefined" || clientErrorNoiseFiltersInstalled) return;
  clientErrorNoiseFiltersInstalled = true;

  window.addEventListener(
    "error",
    (event) => {
      if (!shouldIgnoreException(event.error || event.message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (!shouldIgnoreException(event.reason)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );
}

function initPosthogOnce() {
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  // Canonical singleton guard (even if imported multiple times)
  if (posthog.__loaded) return;

  installClientErrorNoiseFilters();

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    defaults: "2026-05-30",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    // Session replay loads rrweb workers; in Next dev (Turbopack) their source maps
    // often 404 as GET /image-bitmap-data-url-worker-*.js.map — harmless but noisy.
    disable_session_recording: process.env.NODE_ENV === "development",
    session_recording: {
      recordConsoleLog: true,
    },
    before_send: (event) => {
      if (shouldIgnoreException(event?.properties)) return null;
      // Drop events from localhost / 127.0.0.1 to keep production metrics clean
      if (typeof window !== "undefined") {
        const host = window.location?.hostname || "";
        if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.")) return null;
      }
      return event;
    },
    loaded: (ph) => {
      const touch = getSessionMarketingAttribution();
      if (Object.keys(touch).length) ph.register(touch);
      // NextDoor cohort super-properties: survive for the entire session
      try {
        const ndProps = getNextdoorAttributionProperties();
        ph.register({ traffic_source: ndProps.is_nextdoor_traffic ? "nextdoor" : (touch.utm_source || touch.inferred_source || undefined) });
        if (ndProps.is_nextdoor_traffic) {
          ph.register({
            nd_source: ndProps.nd_source,
            nd_campaign: ndProps.nd_campaign,
            nd_post_id: ndProps.nd_post_id,
            is_nextdoor_traffic: true,
          });
        }
      } catch {
        // Analytics should never block UX
      }
      if (process.env.NODE_ENV === "development") {
        ph.debug();
        ph.opt_out_capturing();
      }
    },
  });
  if (typeof window !== "undefined") {
    window.posthog = posthog;
  }
}

// Init on import (ONE init, many imports)
initPosthogOnce();

// Backwards-compatible export (should no longer be called from components/pages)
export function initPosthog() {
  initPosthogOnce();
}

export default posthog;

export function captureWithExperiment(event, properties) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  try {
    const touch = getSessionMarketingAttribution();
    const nd = getNextdoorAttributionProperties();

    posthog.capture(event, {
      ...touch,
      ...nd,
      ...properties,
      traffic_source: nd.is_nextdoor_traffic ? "nextdoor" : (touch.utm_source || touch.inferred_source || undefined),
      $feature_flag: HOMEPAGE_VIDEO_EXPERIMENT_FLAG,
      $feature_flag_response: posthog.getFeatureFlag(HOMEPAGE_VIDEO_EXPERIMENT_FLAG),
    });
  } catch {
    // Analytics should never break the user flow.
  }
}

/**
 * Dedicated NextDoor campaign event capture.
 * Ensures every NextDoor-tagged event carries nd_* properties for PostHog cohorts + funnels.
 * Also pushes to dataLayer for GA4 / GTM parity.
 *
 * @param {string} event — canonical event name (e.g. "nextdoor_intake_start")
 * @param {Record<string, unknown>} properties
 */
export function captureNextdoorEvent(event, properties = {}) {
  if (typeof window === "undefined") return;

  const touch = getSessionMarketingAttribution();
  const nd = getNextdoorAttributionProperties();

  const merged = {
    ...touch,
    ...nd,
    ...properties,
    traffic_source: nd.is_nextdoor_traffic ? "nextdoor" : (touch.utm_source || touch.inferred_source || undefined),
  };

  try {
    if (posthog.capture) {
      posthog.capture(event, merged);
    }
  } catch {
    /* silent */
  }

  try {
    if (typeof window !== "undefined" && Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: event.replace(/_/g, " "), // GTM-friendly display name
        ...merged,
        conversion: properties.conversion || false,
      });
    }
  } catch {
    /* silent */
  }
}
