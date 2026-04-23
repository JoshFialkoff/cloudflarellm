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
 * Call once on app load. Merges first-touch marketing params from the URL
 * into sessionStorage so they survive in-page flows (e.g. typebot) without UTMs.
 * Supports Reddit / paid breakdown in PostHog and GTM → Reddit Pixel / CAPI.
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
    };
    const hasDeterministicTouch = Boolean(
        fromUrl.utm_source ||
            fromUrl.campaign_id ||
            fromUrl.adset_id ||
            fromUrl.ad_id ||
            fromUrl.gclid ||
            fromUrl.qcclkid ||
            fromUrl.rdt_cid ||
            fromUrl.click_id,
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

    // Infer source only when deterministic source is not present.
    if (!next.utm_source && !hasDeterministicTouch && !next.inferred_source) {
        const ref = String(document.referrer || "").toLowerCase();
        if (ref.includes("reddit.")) next.inferred_source = "reddit";
        else if (ref.includes("google.")) next.inferred_source = "google";
        else if (ref.includes("quantcast.")) next.inferred_source = "quantcast";
        else if (ref) next.inferred_source = "other";
    }

    next.attribution_model = "first_touch_session";

    if (Object.keys(next).length) writeStored(next);
}

export function getSessionMarketingAttribution() {
    const o = readStored();
    const out = {};
    for (const [k, v] of Object.entries(o)) {
        if (typeof v === "string" && v) out[k] = v;
    }
    return out;
}
