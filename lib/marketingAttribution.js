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
        /** Reddit Pixel / CAPI: click id may appear as any of these on the landing URL. */
        click_id:
            pick("click_id") ||
            pick("rdt_click_id") ||
            pick("rdt_cid") ||
            pick("rdclid"),
        rdt_cid: pick("rdt_cid"),
    };

    const prev = readStored();
    const next = { ...prev };
    for (const [k, v] of Object.entries(fromUrl)) {
        if (!v) continue;
        if (!next[k]) next[k] = v;
    }

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
