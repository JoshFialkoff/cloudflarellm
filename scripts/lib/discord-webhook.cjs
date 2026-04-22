/**
 * Discord incoming webhook helpers (plain `content`, no embeds).
 * @param {string} webhookUrl
 * @param {string} content
 */
async function postDiscordWebhook(webhookUrl, content) {
    const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Discord webhook failed (${res.status}): ${body.slice(0, 300)}`);
    }
}

/**
 * Discord message content max is 2000; stay under with margin.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string[]}
 */
function splitDiscordContent(text, maxLen = 1900) {
    const t = String(text || "").trim();
    if (!t) return [];
    if (t.length <= maxLen) return [t];
    const chunks = [];
    let rest = t;
    while (rest.length) {
        if (rest.length <= maxLen) {
            chunks.push(rest);
            break;
        }
        let slice = rest.slice(0, maxLen);
        const nl = slice.lastIndexOf("\n");
        if (nl > maxLen * 0.6) slice = slice.slice(0, nl);
        chunks.push(slice.trimEnd());
        rest = rest.slice(slice.length).trimStart();
    }
    return chunks;
}

module.exports = { postDiscordWebhook, splitDiscordContent };
