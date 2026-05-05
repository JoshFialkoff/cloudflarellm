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
        care_type: pick(["care_type"], "care_type"),
        region: pick(["region"], "region"),
        monthly_budget: pick(["monthly_budget"], "monthly_budget"),
        estimated_low: pick(["estimated_low"], "estimated_low"),
        estimated_high: pick(["estimated_high"], "estimated_high"),
        tool_intent: pick(["tool_intent"], "tool_intent"),
        wants_hidden_fees: pick(["wants_hidden_fees"], "wants_hidden_fees"),
        wants_tour_questions: pick(["wants_tour_questions"], "wants_tour_questions"),
        wants_lower_cost_options: pick(["wants_lower_cost_options"], "wants_lower_cost_options"),
        lower_cost_strategy: pick(["lower_cost_strategy"], "lower_cost_strategy"),
    };
    /** Omit empty strings so Typebot can treat UTMs as unset. */
    return Object.fromEntries(
        Object.entries(raw).filter(([, v]) => typeof v === "string" && v.length > 0),
    );
}
