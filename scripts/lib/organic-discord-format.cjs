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

module.exports = { formatOrganicLeadBlock, engagementText };
