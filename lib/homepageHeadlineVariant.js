import { getSessionMarketingAttribution } from "./marketingAttribution";

const DEMENTIA_PATTERN =
    /\b(dementia|alz|alzheimer|memory\s*care|memorycare|cognitive|wandering)\b/i;

function getUrlAttributionText() {
    if (typeof window === "undefined") return "";

    const searchParams = new URLSearchParams(window.location.search);
    const candidates = [
        searchParams.get("creative"),
        searchParams.get("keyword"),
        searchParams.get("adgroup"),
        searchParams.get("utm_content"),
        searchParams.get("utm_campaign"),
        searchParams.get("utm_term"),
    ].filter(Boolean);

    return candidates.join(" ");
}

function getAttributionTextWithSession() {
    if (typeof window === "undefined") return "";

    const searchParams = new URLSearchParams(window.location.search);
    const touch = getSessionMarketingAttribution();
    const candidates = [
        searchParams.get("creative"),
        searchParams.get("keyword"),
        searchParams.get("adgroup"),
        searchParams.get("utm_content"),
        searchParams.get("utm_campaign"),
        searchParams.get("utm_term"),
        touch.utm_content,
        touch.utm_campaign,
        touch.utm_term,
    ].filter(Boolean);

    return candidates.join(" ");
}

export function shouldUseDementiaHeadline() {
    return DEMENTIA_PATTERN.test(getAttributionTextWithSession());
}

export function hasReferralHeadlineHint() {
    return getUrlAttributionText().trim().length > 0;
}
