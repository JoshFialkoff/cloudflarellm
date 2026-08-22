// GA4 event utility — pushes to GTM dataLayer ONLY.
// GTM Custom Event triggers match on the top-level `event` field.
// No Measurement IDs or direct gtag() calls belong here; GTM owns GA4 config.

function dataLayerAvailable() {
    return typeof window !== "undefined" && Array.isArray(window.dataLayer);
}

/**
 * Push a GA4-friendly event to dataLayer.
 * GTM Custom Event triggers read `dataLayer.event === <eventName>`.
 *
 * @param {string} eventName — GA4 event name (snake_case recommended)
 * @param {Record<string, unknown>} params — event parameters (max 25 keys, scalar values only)
 */
export function pushGevent(eventName, params = {}) {
    if (typeof window === "undefined") return;

    const safe = {};
    for (const [key, value] of Object.entries(params)) {
        const t = typeof value;
        if (t === "string" || t === "number" || t === "boolean") {
            safe[key] = value;
        }
    }

    try {
        if (dataLayerAvailable()) {
            window.dataLayer.push({
                event: eventName,
                event_category: "engagement",
                ...safe,
            });
        }
    } catch {
        // Silently fail — analytics must never break UX
    }
}

/**
 * Mark a conversion explicitly (e.g. email capture, lead form).
 * Under Option A (GTM-only), this is identical to pushGevent.
 */
export function pushGconversion(eventName, params = {}) {
    pushGevent(eventName, { ...params, conversion: true });
}

/**
 * Push a GA4 event specifically tagged for AI-referred traffic.
 * Use this for GEO (Generative Engine Optimization) funnel tracking.
 *
 * @param {string} eventName — GA4 event name (snake_case recommended)
 * @param {Record<string, unknown>} params — event parameters
 */
export function pushAIEvent(eventName, params = {}) {
    if (typeof window === "undefined") return;

    const ref = String(document.referrer || "").toLowerCase();
    const aiReferrer =
        ref.includes("chatgpt.com") || ref.includes("openai.com") || ref.includes("chat.openai.com") || ref.includes("searchgpt.com") ? "chatgpt" :
        ref.includes("perplexity.ai") ? "perplexity" :
        ref.includes("claude.ai") ? "claude" :
        ref.includes("gemini.google.com") || ref.includes("bard.google.com") ? "gemini" :
        ref.includes("copilot.microsoft.com") || ref.includes("bing.com/chat") ? "copilot" :
        ref.includes("poe.com") ? "poe" :
        ref.includes("you.com") ? "you" :
        ref.includes("phind.com") || ref.includes("phind.ai") ? "phind" :
        ref.includes("kagi.com") ? "kagi" :
        ref.includes("duckduckgo.com/duckai") ? "duckduckgo_ai" :
        "unknown_ai";

    pushGevent(eventName, {
        ...params,
        event_category: "ai_referral",
        ai_referrer: aiReferrer,
        traffic_source: aiReferrer,
        is_ai_referred: true,
    });
}

/**
 * Mark an AI-referred conversion explicitly (e.g. email capture, lead form).
 */
export function pushAIConversion(eventName, params = {}) {
    pushAIEvent(eventName, { ...params, conversion: true });
}
