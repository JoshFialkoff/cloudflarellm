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
        ai_source: pick("ai_source"),
        ai_prompt: pick("ai_prompt"),
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
            fromUrl.nd_post_id ||
            fromUrl.ai_source,
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

    // AI referrer detection: explicit URL param > referrer inference
    if (!next.ai_source) {
        const inferredAI = getAIReferrer();
        if (inferredAI) next.ai_source = inferredAI;
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

    // AI traffic enrichment
    const isAITraffic = Boolean(next.ai_source);
    if (isAITraffic) {
        next.traffic_source = next.ai_source;
        next.is_ai_referred = true;
        if (!next.utm_medium) next.inferred_medium = "ai_referral";
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
    // Normalize ai_source to ai_referrer for GA4 / PostHog parity
    if (out.ai_source && !out.ai_referrer) {
        out.ai_referrer = out.ai_source;
    }
    return out;
}

/**
 * Return NextDoor-specific enriched properties for PostHog $set / super props.
 * Use this to build cohorts of NextDoor-acquired users.
 */
/**
 * Detect if the visitor arrived from an AI chatbot / LLM platform.
 * Used by AIReferrerBanner for contextual welcome messaging.
 * @returns {string|null} canonical referrer key or null
 */
/**
 * Detect if the visitor arrived from an AI chatbot / LLM platform.
 * Used by AIReferrerBanner for contextual welcome messaging and analytics.
 * @returns {string|null} canonical referrer key or null
 */
export function getAIReferrer() {
    if (typeof window === "undefined") return null;
    const ref = document.referrer;
    if (!ref) return null;
    try {
        const url = new URL(ref);
        const host = url.hostname.toLowerCase();
        const full = ref.toLowerCase();

        // ChatGPT / OpenAI
        if (host === "chat.openai.com" || host === "chatgpt.com" || host === "searchgpt.com") return "chatgpt";
        if (host === "openai.com" && full.includes("/chat")) return "chatgpt";

        // Perplexity
        if (host === "perplexity.ai") return "perplexity";

        // Claude
        if (host === "claude.ai") return "claude";

        // Gemini / Bard
        if (host === "gemini.google.com" || host === "bard.google.com") return "gemini";

        // Copilot (Microsoft)
        if (host === "copilot.microsoft.com") return "copilot";
        if (host === "bing.com" && full.includes("/chat")) return "copilot";

        // Meta AI
        if (host === "meta.ai") return "meta_ai";

        // Grok (xAI)
        if (host === "grok.com" || host === "x.ai" || host === "grok.x.ai") return "grok";

        // Poe
        if (host === "poe.com") return "poe";

        // You.com
        if (host === "you.com") return "you";

        // Phind
        if (host === "phind.com" || host === "phind.ai") return "phind";

        // Kagi
        if (host === "kagi.com") return "kagi";

        // DuckDuckGo AI (duckai path)
        if (host === "duckduckgo.com" && full.includes("/duckai")) return "duckduckgo_ai";

        // HuggingChat
        if (host === "huggingchat.com" || host === "chat.huggingface.co") return "huggingchat";

        // Pi (Inflection)
        if (host === "pi.ai") return "pi";

        // Character.AI
        if (host === "character.ai") return "character_ai";

        // Brave Leo
        if (host === "search.brave.com" || (host === "brave.com" && full.includes("/leo"))) return "brave_leo";
    } catch {
        return null;
    }
    return null;
}

/**
 * Get the AI prompt / query that led the user here, if available via URL param.
 * @returns {string|null}
 */
export function getAIPrompt() {
    if (typeof window === "undefined") return null;
    try {
        const sp = new URLSearchParams(window.location.search);
        const prompt = sp.get("ai_prompt");
        if (prompt && prompt.trim()) return prompt.trim().slice(0, 512);
    } catch {
        return null;
    }
    return null;
}

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
