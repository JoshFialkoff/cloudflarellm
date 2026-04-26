function engagementText(lead) {
    return String(lead.founder_engagement_strategy || lead.engagement_strategy || "").trim();
}

/**
 * Plain-text block for Discord (matches hand-written outreach layout).
 * @param {Record<string, unknown>} lead
 * @param {number} [index] 0-based; adds bold index prefix when set.
 */
function formatOrganicLeadBlock(lead, index) {
    const title = String(lead.title || "Untitled").trim();
    const url = String(lead.url || "").trim();
    const pain = String(lead.pain_point_summary || "").trim();
    const strategy = engagementText(lead);
    const prefix = index != null ? `**${index + 1}.** ` : "";
    return [
        `${prefix}${title}`,
        "",
        `URL: ${url}`,
        "",
        `Pain point: ${pain}`,
        "",
        `Strategy: ${strategy}`,
    ].join("\n");
}

/**
 * Community-first Firecrawl run (posts + disclosure fields).
 * @param {Record<string, unknown>} post
 * @param {number} [index]
 */
function formatCommunityFirstLeadBlock(post, index) {
    const title = String(post.title || "Untitled").trim();
    const url = String(post.url || "").trim();
    const postDate = String(post.post_date || "").trim();
    const pain = String(
        post.post_summary || post.pain_point_summary || "",
    ).trim();
    const advice = String(
        post.founder_optimized_response || post.community_engagement_advice || "",
    ).trim();
    const disclosure = String(post.transparency_disclosure || "").trim();
    const prefix = index != null ? `**${index + 1}.** ` : "";
    const lines = [
        `${prefix}${title}`,
        "",
        `Post date: ${postDate || "—"}`,
        "",
        `URL: ${url}`,
        "",
        `Post summary: ${pain}`,
        "",
        `Founder reply (Josh Fialkoff, Assistedly.ai — MA assisted living data): ${advice}`,
    ];
    if (disclosure) {
        lines.push("", `Transparency / affiliation: ${disclosure}`);
    }
    return lines.join("\n");
}

module.exports = {
    formatOrganicLeadBlock,
    formatCommunityFirstLeadBlock,
    engagementText,
};
