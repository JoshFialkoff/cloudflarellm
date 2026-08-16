const STORAGE_KEY = "ail_marketing_touch";

function readStored() {
    if (typeof window === "undefined") return {};
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeStored(next) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* quota or private mode */
    }
}

/**
 * Extract a NextDoor post ID from a NextDoor URL or share parameters.
 * E.g. https://nextdoor.com/p/R2-y_gzK7cfG → "R2-y_gzK7cfG"
 */
function extractNextdoorPostId(sp) {
    if (typeof window === "undefined") return null;
    // Check for explicit post_id or nd_post_id params
    const explicit = sp.get("nd_post_id") || sp.get("post_id");
    if (explicit) return String(explicit).slice(0, 128);

    // Try to extract from document referrer if it's a nextdoor.com URL
    try {
        const refUrl = new URL(document.referrer);
        if (refUrl.hostname.includes("nextdoor.com")) {
            const pathMatch = refUrl.pathname.match(/\/p\/([A-Za-z0-9_-]+)/);
            if (pathMatch) return pathMatch[1].slice(0, 128);
        }
    } catch {
        /* not a valid referrer URL */
    }
    return null;
}

/**
 * Call once on app load. Merges first-touch marketing params from the URL
 * into sessionStorage so they survive in-page flows (e.g. typebot) without UTMs.
 * Supports Reddit / paid breakdown in PostHog and GTM → Reddit Pixel / CAPI.
 * ADDITIVE: enhanced NextDoor detection for campaign analytics (2026-08-14).
 */
export function syncMarketingTouchFromUrl() {
    if (typeof window === "undefined") return;

    const sp = new URLSearchParams(window.location.search);
    const pick = (key) => {
        const v = sp.get(key);
        if (v == null || v === "") return null;
        const s = String(v).trim();
        return s.length ? s.slice(0, 512) : null;
    };

    const fromUrl = {
        utm_source: pick("utm_source"),
        utm_medium: pick("utm_medium"),
        utm_campaign: pick("utm_campaign"),
        utm_content: pick("utm_content"),
        utm_term: pick("utm_term"),
        campaign_id: pick("campaign_id"),
        adset_id: pick("adset_id"),
        ad_id: pick("ad_id"),
        gclid: pick("gclid"),
        qcclkid: pick("qcclkid"),
        /** Reddit Pixel / CAPI: click id may appear as any of these on the landing URL. */
        click_id:
            pick("click_id") ||
            pick("rdt_click_id") ||
            pick("rdt_cid") ||
            pick("rdclid"),
        rdt_cid: pick("rdt_cid"),
        /** NextDoor-specific params that survive from NextDoor share links */
        nd_share_action_id: pick("share_action_id"),
        nd_share_extras: pick("extras"),
        nd_post_id: extractNextdoorPostId(sp),
    };
    const hasDeterministicTouch = Boolean(
        fromUrl.utm_source ||
            fromUrl.campaign_id ||
            fromUrl.adset_id ||
            fromUrl.ad_id ||
            fromUrl.gclid ||
            fromUrl.qcclkid ||
            fromUrl.rdt_cid ||
            fromUrl.click_id ||
            fromUrl.nd_share_action_id ||
            fromUrl.nd_post_id,
    );

    const prev = readStored();
    const next = { ...prev };
    for (const [k, v] of Object.entries(fromUrl)) {
        if (!v) continue;
        if (!next[k]) next[k] = v;
    }

    if (!next.first_landing_url && typeof window.location?.href === "string") {
        next.first_landing_url = window.location.href.slice(0, 1024);
    }

    if (!next.attribution_confidence) {
        next.attribution_confidence = hasDeterministicTouch ? "confirmed" : "inferred";
    }

    // Enhanced referrer inference for NextDoor (app WebView, mobile, desktop)
    if (!next.utm_source && !hasDeterministicTouch && !next.inferred_source) {
        const ref = String(document.referrer || "").toLowerCase();
        if (ref.includes("reddit.")) next.inferred_source = "reddit";
        else if (ref.includes("nextdoor.") || ref.includes("nextdoorapp.")) next.inferred_source = "nextdoor";
        else if (ref.includes("google.")) next.inferred_source = "google";
        else if (ref.includes("quantcast.")) next.inferred_source = "quantcast";
        else if (ref) next.inferred_source = "other";
    }

    // NextDoor-specific enrichment: if referrer or params point to NextDoor, set canonical source
    const isNextdoorTraffic = Boolean(
        next.utm_source === "nextdoor" ||
            next.inferred_source === "nextdoor" ||
            next.nd_post_id ||
            next.nd_share_action_id,
    );
    if (isNextdoorTraffic) {
        next.traffic_source = "nextdoor";
        if (!next.utm_medium) next.inferred_medium = "social";
    }

    next.attribution_model = "first_touch_session";

    if (Object.keys(next).length) writeStored(next);
}

/**
 * Get normalized marketing attribution useful for GA4 / PostHog event properties.
 * Returns a flat object of string values — safe to spread into capture() / gtag().
 */
export function getSessionMarketingAttribution() {
    const o = readStored();
    const out = {};
    for (const [k, v] of Object.entries(o)) {
        if (typeof v === "string" && v) out[k] = v;
    }
    return out;
}

/**
 * Return NextDoor-specific enriched properties for PostHog $set / super props.
 * Use this to build cohorts of NextDoor-acquired users.
 */
export function getNextdoorAttributionProperties() {
    const o = readStored();
    const isNextdoor = Boolean(
        o.utm_source === "nextdoor" ||
            o.inferred_source === "nextdoor" ||
            o.nd_post_id ||
            o.nd_share_action_id,
    );
    return {
        is_nextdoor_traffic: isNextdoor,
        nd_source: isNextdoor ? (o.utm_source || "nextdoor") : null,
        nd_medium: isNextdoor ? (o.utm_medium || o.inferred_medium || "social") : null,
        nd_campaign: isNextdoor ? (o.utm_campaign || null) : null,
        nd_content: isNextdoor ? (o.utm_content || null) : null,
        nd_post_id: o.nd_post_id || null,
        nd_share_action_id: o.nd_share_action_id || null,
        nd_attribution_confidence: o.attribution_confidence || null,
    };
}
