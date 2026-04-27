/**
 * Variables passed into Typebot embed (`prefilledVariables`) so one published bot
 * can branch on campaign / Reddit context. Define matching variables in Typebot
 * (e.g. `campaign_entry`, `ad_text`, `ad_community`, `utm_source`).
 */

function cleanToken(value, limit = 120) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.replace(/\s+/g, " ").slice(0, limit);
}

/**
 * @param {{
 *   segmentKey: string,
 *   adText: string,
 *   community: string,
 *   adGraphicPresent: boolean,
 *   sp: URLSearchParams,
 *   attribution: Record<string, string>,
 * }} ctx
 * @returns {Record<string, string>}
 */
export function buildTypebotPrefillFromContext(ctx) {
    const {
        segmentKey,
        adText,
        community,
        adGraphicPresent,
        sp,
        attribution,
    } = ctx;

    const entryOverride = cleanToken(
        sp.get("typebot_entry") || sp.get("campaign_entry"),
        80,
    );
    const pick = (urlKeys, attrKey) => {
        for (const k of urlKeys) {
            const v = sp.get(k);
            if (v != null && String(v).trim()) return cleanToken(v, 200);
        }
        const a = attribution[attrKey];
        if (typeof a === "string" && a.trim()) return cleanToken(a, 200);
        return "";
    };

    const raw = {
        campaign_entry: entryOverride || segmentKey,
        campaign_segment: segmentKey,
        ad_text: adText,
        ad_community: community,
        has_ad_graphic: adGraphicPresent ? "yes" : "no",
        utm_source: pick(["utm_source"], "utm_source"),
        utm_medium: pick(["utm_medium"], "utm_medium"),
        utm_campaign: pick(["utm_campaign"], "utm_campaign"),
        utm_content: pick(["utm_content"], "utm_content"),
        utm_term: pick(["utm_term"], "utm_term"),
    };
    /** Omit empty strings so Typebot can treat UTMs as unset. */
    return Object.fromEntries(
        Object.entries(raw).filter(([, v]) => typeof v === "string" && v.length > 0),
    );
}
