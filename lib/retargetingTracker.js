// Retargeting eligibility tracker — fires when a user visits 2+ pages
// in a session without converting.
import posthog from "./posthogClient";
import { getSessionMarketingAttribution } from "./marketingAttribution";

const PAGES_VISITED_KEY = "ph_pages_visited";
const HAS_CONVERTED_KEY = "ph_has_converted";
const ELIGIBILITY_FIRED_KEY = "ph_ret_eligible_fired";

function canCapture() {
  return typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

function getCount() {
  const raw = sessionStorage.getItem(PAGES_VISITED_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function setCount(n) {
  sessionStorage.setItem(PAGES_VISITED_KEY, String(n));
}

function hasConverted() {
  return sessionStorage.getItem(HAS_CONVERTED_KEY) === "true";
}

function alreadyFired() {
  return sessionStorage.getItem(ELIGIBILITY_FIRED_KEY) === "true";
}

export function trackRetargetingEligibility() {
  if (!canCapture()) return;
  if (hasConverted() || alreadyFired()) return;

  const visited = getCount() + 1;
  setCount(visited);

  if (visited === 2) {
    sessionStorage.setItem(ELIGIBILITY_FIRED_KEY, "true");
    try {
      posthog.capture("retargeting_eligible", {
        pages_visited: visited,
        last_page: window.location.pathname,
        ...getSessionMarketingAttribution(),
      });
    } catch {
      // Analytics must never break UX
    }
  }
}

export function markConverted() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(HAS_CONVERTED_KEY, "true");
}

export function resetRetargetingTracker() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PAGES_VISITED_KEY);
  sessionStorage.removeItem(ELIGIBILITY_FIRED_KEY);
  sessionStorage.removeItem(HAS_CONVERTED_KEY);
}
