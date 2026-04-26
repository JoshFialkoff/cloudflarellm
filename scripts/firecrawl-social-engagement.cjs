#!/usr/bin/env node
/**
 * Unified Firecrawl social engagement: organic discovery (tracking link + optional DataForSEO)
 * plus founder community-first posts — one run, one report, coordinated Discord.
 *
 * Env:
 *   FIRECRAWL_ENGAGEMENT_MODE — both | organic | founder (default: both)
 *   FIRECRAWL_API_KEY (required)
 *   FIRECRAWL_ORGANIC_MODEL (default: spark-1-mini or FIRECRAWL_AGENT_MODEL)
 *   FIRECRAWL_FOUNDER_MODEL (default: spark-1-pro or FIRECRAWL_AGENT_MODEL)
 *   DATAFORSEO_* — when organic runs; loads .env.dataforseo.local
 *   Discord: ORGANIC_DISCORD_AUTO_SEND=1 for organic blocks; founder uses FOUNDER_DISCORD_AUTO_SEND
 *     (default on when DISCORD_WEBHOOK_URL set — see founderDiscordShouldSend)
 *   Firecrawl CLI plugin bridge: scripts/lib/firecrawl-plugin-cli.cjs
 *
 * Output: reports/social-engagement-<iso>.json (+ .md)
 */
const fs = require("fs");
const https = require("https");
const path = require("path");
const {
    maybeRunFirecrawlPluginBeforeAgent,
    maybeRunFirecrawlPluginSearchAfterAgent,
    formatPluginMarkdown,
} = require("./lib/firecrawl-plugin-cli.cjs");

const MODE = String(process.env.FIRECRAWL_ENGAGEMENT_MODE || "both")
    .trim()
    .toLowerCase();

const TRACKING_LINK =
    "https://www.reddit.com/user/joshfialkoff/trends/?keyword=419266225";

const BLOG_URL = "https://aiassistliving.com/blog/";

const UNIFIED_SEED_URLS = [
    "https://aiassistliving.com",
    BLOG_URL,
    "https://www.reddit.com/r/AgingParents/",
    "https://www.reddit.com/r/AssistedLiving/",
    "https://www.reddit.com/r/dementia/",
    "https://www.reddit.com/r/eldercare/",
    "https://www.reddit.com/r/massachusetts/",
    "https://www.reddit.com/r/boston/",
    "https://www.reddit.com/r/Alzheimers/",
    "https://www.agingcare.com/discussions",
];

function loadDotEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        if (!key || process.env[key] !== undefined) continue;
        let value = line.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
}

function runOrganic() {
    return MODE === "both" || MODE === "organic";
}

function runFounder() {
    return MODE === "both" || MODE === "founder";
}

function isLeadLikeRow(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Boolean(value.url && value.title);
}

function normalizeLead(row) {
    if (!row || typeof row !== "object") return row;
    const engagement = String(
        row.engagement_strategy || row.founder_engagement_strategy || "",
    ).trim();
    const citation =
        row.engagement_strategy_citation ||
        row.founder_engagement_strategy_citation ||
        "";
    return {
        ...row,
        founder_engagement_strategy: engagement,
        engagement_strategy: row.engagement_strategy || engagement,
        founder_engagement_strategy_citation: citation,
    };
}

function normalizeOfferAsLead(row) {
    if (!row || typeof row !== "object") return null;
    const title = String(row.title || "").trim();
    const url = String(row.source_url || row.url || "").trim();
    if (!title || !url) return null;
    return normalizeLead({
        title,
        url,
        post_date: String(row.start_date || row.post_date || "").trim(),
        pain_point_summary: String(
            row.description || row.pain_point_summary || "",
        ).trim(),
        engagement_strategy: String(
            row.terms || row.engagement_strategy || row.founder_engagement_strategy || "",
        ).trim(),
    });
}

function extractLeadsFromAgentResult(result) {
    const mapNorm = (rows) => rows.map(normalizeLead);

    if (Array.isArray(result?.data?.leads)) {
        const rows = result.data.leads.filter(isLeadLikeRow);
        if (rows.length) return mapNorm(rows);
    }
    if (Array.isArray(result?.leads)) {
        const rows = result.leads.filter(isLeadLikeRow);
        if (rows.length) return mapNorm(rows);
    }

    const data = result?.data;
    if (Array.isArray(data)) {
        const rows = data.filter(isLeadLikeRow);
        if (rows.length) return mapNorm(rows);
    }

    if (data && typeof data === "object" && !Array.isArray(data)) {
        if (Array.isArray(data.offers)) {
            const rows = data.offers.map(normalizeOfferAsLead).filter(Boolean);
            if (rows.length) return rows;
        }
        const numericKeys = Object.keys(data).filter((k) => /^\d+$/.test(k));
        if (numericKeys.length) {
            const rows = numericKeys
                .sort((a, b) => Number(a) - Number(b))
                .map((k) => data[k])
                .filter(isLeadLikeRow);
            if (rows.length) return mapNorm(rows);
        }
    }

    return [];
}

function isPostLikeRow(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Boolean(value.url && value.title);
}

function extractPostsFromAgentResult(result) {
    if (Array.isArray(result?.data?.posts)) {
        const rows = result.data.posts.filter(isPostLikeRow);
        if (rows.length) return rows;
    }
    if (Array.isArray(result?.posts)) {
        const rows = result.posts.filter(isPostLikeRow);
        if (rows.length) return rows;
    }
    const data = result?.data;
    if (Array.isArray(data)) {
        const rows = data.filter(isPostLikeRow);
        if (rows.length) return rows;
    }
    if (data && typeof data === "object" && !Array.isArray(data)) {
        const numericKeys = Object.keys(data).filter((k) => /^\d+$/.test(k));
        if (numericKeys.length) {
            return numericKeys
                .sort((a, b) => Number(a) - Number(b))
                .map((k) => data[k])
                .filter(isPostLikeRow);
        }
    }
    return [];
}

function dataForSeoCredentialsFromEnv() {
    const user = String(
        process.env.DATAFORSEO_USERNAME ||
            process.env.DATAFORSEO_LOGIN ||
            process.env.DATAFORSEO_API_LOGIN ||
            "",
    ).trim();
    const pass = String(
        process.env.DATAFORSEO_PASSWORD ||
            process.env.DATAFORSEO_API_PASSWORD ||
            "",
    ).trim();
    if (!user || !pass) return null;
    return { user, pass };
}

async function fetchDataForSeoKeywordHints(seedKeywords, locationCode, languageCode) {
    const creds = dataForSeoCredentialsFromEnv();
    if (!creds) return null;

    const tasks = seedKeywords.slice(0, 5).map((keyword) => ({
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        limit: 15,
    }));

    const auth = Buffer.from(`${creds.user}:${creds.pass}`, "utf8").toString("base64");
    const body = JSON.stringify(tasks);

    const json = await new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: "api.dataforseo.com",
                path: "/v3/dataforseo_labs/google/keyword_suggestions/live",
                method: "POST",
                headers: {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body),
                },
                timeout: 45_000,
            },
            (res) => {
                let buf = "";
                res.on("data", (c) => {
                    buf += c;
                });
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(buf));
                    } catch {
                        reject(new Error(`DataForSEO: non-JSON response (${res.statusCode})`));
                    }
                });
            },
        );
        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("DataForSEO: request timeout"));
        });
        req.write(body);
        req.end();
    });

    const keywords = [];
    const tasksOut = json?.tasks || [];
    for (const t of tasksOut) {
        const blocks = t?.result;
        const flat = Array.isArray(blocks) ? blocks.flat(2) : [];
        for (const item of flat) {
            if (item && typeof item === "object" && item.keyword) {
                keywords.push({
                    keyword: String(item.keyword),
                    search_volume:
                        typeof item.search_volume === "number" ? item.search_volume : null,
                });
            }
        }
    }

    const dedup = [];
    const seen = new Set();
    for (const k of keywords) {
        const key = k.keyword.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(k);
        if (dedup.length >= 40) break;
    }

    return {
        keywords: dedup,
        raw_note: tasksOut[0]?.status_message || undefined,
    };
}

function toMarkdownOrganic(leads) {
    const lines = [
        "# Organic social discovery (Firecrawl Agent)",
        "",
        `Generated: ${new Date().toISOString()}`,
        "",
        "| # | Title | URL | Post date |",
        "|---|-------|-----|-----------|",
    ];
    leads.forEach((row, i) => {
        const t = String(row.title || "").replace(/\|/g, "\\|").slice(0, 80);
        const u = String(row.url || "").replace(/\|/g, "\\|");
        const d = String(row.post_date || "").replace(/\|/g, "\\|");
        lines.push(`| ${i + 1} | ${t} | ${u} | ${d} |`);
    });
    lines.push("");
    lines.push("## Pain points & engagement (see JSON for full text + citations)");
    leads.forEach((row, i) => {
        const strategy = String(
            row.founder_engagement_strategy || row.engagement_strategy || "",
        );
        lines.push(`### ${i + 1}. ${row.title || "Untitled"}`);
        lines.push("");
        lines.push(`- **URL:** ${row.url || ""}`);
        lines.push(`- **Pain point:** ${(row.pain_point_summary || "").slice(0, 400)}`);
        lines.push(`- **Strategy:** ${strategy.slice(0, 500)}`);
        lines.push("");
    });
    return `${lines.join("\n")}\n`;
}

function toMarkdownFounder(posts) {
    const lines = [
        "# Founder community engagement (Firecrawl Agent)",
        "",
        `Generated: ${new Date().toISOString()}`,
        "",
        "| # | Title | URL | Post date |",
        "|---|-------|-----|-----------|",
    ];
    posts.forEach((row, i) => {
        const t = String(row.title || "").replace(/\|/g, "\\|").slice(0, 80);
        const u = String(row.url || "").replace(/\|/g, "\\|");
        const d = String(row.post_date || "").replace(/\|/g, "\\|");
        lines.push(`| ${i + 1} | ${t} | ${u} | ${d} |`);
    });
    lines.push("");
    lines.push("## Pain points, advice, and disclosure (JSON has full text + citations)");
    posts.forEach((row, i) => {
        lines.push(`### ${i + 1}. ${row.title || "Untitled"}`);
        lines.push("");
        lines.push(`- **URL:** ${row.url || ""}`);
        lines.push(`- **Pain point:** ${(row.pain_point_summary || "").slice(0, 500)}`);
        lines.push(`- **Community-first advice:** ${(row.community_engagement_advice || "").slice(0, 700)}`);
        lines.push(`- **Transparency:** ${(row.transparency_disclosure || "").slice(0, 400)}`);
        lines.push("");
    });
    return `${lines.join("\n")}\n`;
}

function appendDataForSeoMarkdown(base, hints) {
    if (!hints?.keywords?.length) return base;
    const lines = [
        "",
        "## DataForSEO keyword hints (organic + ads)",
        "",
        "High-level US search suggestions from your seeds — use for Reddit ad headlines, body copy, and landing-page SEO.",
        "",
        "| Keyword | Search volume |",
        "|---------|----------------|",
    ];
    hints.keywords.slice(0, 25).forEach((k) => {
        const vol = k.search_volume == null ? "—" : String(k.search_volume);
        const kw = String(k.keyword || "").replace(/\|/g, "\\|");
        lines.push(`| ${kw} | ${vol} |`);
    });
    lines.push("");
    return `${base.replace(/\n$/, "")}\n${lines.join("\n")}\n`;
}

function founderDiscordShouldSend() {
    const webhook = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
    if (!webhook) {
        return { send: false, reason: "DISCORD_WEBHOOK_URL not set" };
    }
    const founder = String(process.env.FOUNDER_DISCORD_AUTO_SEND ?? "").trim();
    if (/^(0|false|no)$/i.test(founder)) {
        return { send: false, reason: "FOUNDER_DISCORD_AUTO_SEND disabled" };
    }
    if (/^(1|true|yes)$/i.test(founder)) {
        return { send: true, reason: "FOUNDER_DISCORD_AUTO_SEND" };
    }
    if (/^(1|true|yes)$/i.test(String(process.env.ORGANIC_DISCORD_AUTO_SEND || "").trim())) {
        return { send: true, reason: "ORGANIC_DISCORD_AUTO_SEND" };
    }
    return { send: true, reason: "default (webhook set, FOUNDER_DISCORD_AUTO_SEND unset)" };
}

function buildUnifiedMarkdown(generatedAt, leads, posts, dataforseoHints, pluginBundle) {
    const parts = [
        "# Social engagement (Firecrawl — unified)",
        "",
        `Generated: ${generatedAt}`,
        "",
        `Mode: ${MODE}`,
        "",
    ];
    if (runOrganic() && leads.length) {
        parts.push(
            toMarkdownOrganic(leads).replace(
                /^#\s+Organic social discovery[^\n]*\n+/,
                "## Organic social discovery\n\n",
            ),
        );
    } else if (runOrganic()) {
        parts.push("## Organic social discovery\n\n_(no leads returned)_\n\n");
    }

    if (runFounder() && posts.length) {
        parts.push(
            toMarkdownFounder(posts).replace(
                /^#\s+Founder community engagement[^\n]*\n+/,
                "## Founder community engagement\n\n",
            ),
        );
    } else if (runFounder()) {
        parts.push("## Founder community engagement\n\n_(no posts returned)_\n\n");
    }

    let md = parts.join("");
    md = appendDataForSeoMarkdown(md, dataforseoHints);
    md += formatPluginMarkdown(pluginBundle || {});
    return md;
}

async function sendUnifiedDiscord(webhookUrl, { leads, posts, meta }) {
    const delayMs = Math.max(
        0,
        Number.parseInt(process.env.ORGANIC_DISCORD_MESSAGE_DELAY_MS || "600", 10) || 0,
    );
    const { postDiscordWebhook, splitDiscordContent } = require("./lib/discord-webhook.cjs");
    const { formatOrganicLeadBlock, formatCommunityFirstLeadBlock } = require("./lib/organic-discord-format.cjs");

    const organicSend =
        runOrganic() &&
        /^(1|true|yes)$/i.test(String(process.env.ORGANIC_DISCORD_AUTO_SEND || "").trim()) &&
        leads.length > 0;
    const founderDecision = founderDiscordShouldSend();
    const founderSend = runFounder() && founderDecision.send && posts.length > 0;

    if (!organicSend && !founderSend) {
        if (leads.length || posts.length) {
            const reasons = [];
            if (runOrganic() && leads.length && !organicSend) {
                reasons.push("organic Discord off (set ORGANIC_DISCORD_AUTO_SEND=1)");
            }
            if (runFounder() && posts.length && !founderSend) {
                reasons.push(`founder Discord: ${founderDecision.reason}`);
            }
            // eslint-disable-next-line no-console
            console.log(`Discord: skipped — ${reasons.join("; ") || "nothing to send"}`);
        }
        return { organic: 0, founder: 0 };
    }

    const topHeader = [
        "**Assistedly.ai — social engagement (unified)**",
        "Organic leads + founder / community-first (Firecrawl)",
        `Saved: ${meta.jsonBasename || "report"}`,
        `Generated: ${meta.generatedAt || "unknown"}`,
        "",
    ].join("\n");

    for (const chunk of splitDiscordContent(topHeader)) {
        // eslint-disable-next-line no-await-in-loop
        await postDiscordWebhook(webhookUrl, chunk);
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));

    const maxOrg = Math.min(
        8,
        Math.max(
            1,
            Number.parseInt(process.env.ORGANIC_DISCORD_MAX_LEADS || "5", 10) || 5,
        ),
    );
    const maxFounder = Math.min(
        8,
        Math.max(
            1,
            Number.parseInt(
                process.env.FOUNDER_DISCORD_MAX_LEADS || process.env.ORGANIC_DISCORD_MAX_LEADS || "5",
                10,
            ) || 5,
        ),
    );
    const organicSlice = organicSend ? leads.slice(0, maxOrg) : [];
    const founderSlice = founderSend ? posts.slice(0, maxFounder) : [];

    let organicCount = 0;
    let founderCount = 0;

    if (organicSend) {
        for (const chunk of splitDiscordContent("**Organic leads**\n")) {
            // eslint-disable-next-line no-await-in-loop
            await postDiscordWebhook(webhookUrl, chunk);
        }
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        for (let i = 0; i < organicSlice.length; i += 1) {
            const block = formatOrganicLeadBlock(organicSlice[i], i);
            for (const chunk of splitDiscordContent(block)) {
                // eslint-disable-next-line no-await-in-loop
                await postDiscordWebhook(webhookUrl, chunk);
            }
            if (delayMs && i < organicSlice.length - 1) await new Promise((r) => setTimeout(r, delayMs));
        }
        organicCount = organicSlice.length;
    }

    if (organicSend && founderSend && delayMs) await new Promise((r) => setTimeout(r, delayMs));

    if (founderSend) {
        for (const chunk of splitDiscordContent("**Founder / community-first**\n")) {
            // eslint-disable-next-line no-await-in-loop
            await postDiscordWebhook(webhookUrl, chunk);
        }
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        for (let i = 0; i < founderSlice.length; i += 1) {
            const block = formatCommunityFirstLeadBlock(founderSlice[i], i);
            for (const chunk of splitDiscordContent(block)) {
                // eslint-disable-next-line no-await-in-loop
                await postDiscordWebhook(webhookUrl, chunk);
            }
            if (delayMs && i < founderSlice.length - 1) await new Promise((r) => setTimeout(r, delayMs));
        }
        founderCount = founderSlice.length;
    }

    // eslint-disable-next-line no-console
    console.log(
        `Discord: unified — organic lead message(s): ${organicCount}, founder post message(s): ${founderCount}`,
    );
    return { organic: organicCount, founder: founderCount };
}

async function main() {
    if (!["both", "organic", "founder"].includes(MODE)) {
        throw new Error(
            `Invalid FIRECRAWL_ENGAGEMENT_MODE="${MODE}" (use both, organic, or founder).`,
        );
    }

    loadDotEnvFile(path.join(process.cwd(), ".env.local"));
    loadDotEnvFile(path.join(process.cwd(), ".env"));
    loadDotEnvFile(path.join(process.cwd(), ".env.dataforseo.local"));

    const apiKey = String(process.env.FIRECRAWL_API_KEY || "").trim();
    if (!apiKey) {
        throw new Error("Set FIRECRAWL_API_KEY in .env.local (get a key at https://firecrawl.dev).");
    }

    const defaultModel = String(process.env.FIRECRAWL_AGENT_MODEL || "").trim();
    const organicModel = String(
        process.env.FIRECRAWL_ORGANIC_MODEL || defaultModel || "spark-1-mini",
    ).trim();
    const founderModel = String(
        process.env.FIRECRAWL_FOUNDER_MODEL || defaultModel || "spark-1-pro",
    ).trim();

    const generatedAt = new Date().toISOString();
    const stamp = generatedAt.replace(/[:.]/g, "-");
    const pluginPre = maybeRunFirecrawlPluginBeforeAgent(process.cwd());
    if (pluginPre.setup_hint) {
        // eslint-disable-next-line no-console
        console.log(`Firecrawl CLI: ${pluginPre.setup_hint}`);
    }

    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const { z } = await import("zod");
    const firecrawl = new Firecrawl({ apiKey });

    let organicResult = null;
    let leads = [];
    if (runOrganic()) {
        const leadSchema = z.object({
            title: z.string(),
            title_citation: z.string().describe("Source URL for title").optional(),
            url: z.string(),
            url_citation: z.string().describe("Source URL for url").optional(),
            post_date: z.string(),
            post_date_citation: z.string().describe("Source URL for post_date").optional(),
            pain_point_summary: z.string(),
            pain_point_summary_citation: z.string().describe("Source URL for pain_point_summary").optional(),
            engagement_strategy: z.string().optional(),
            founder_engagement_strategy: z.string().optional(),
            engagement_strategy_citation: z.string().optional(),
            founder_engagement_strategy_citation: z
                .string()
                .describe("Source URL for engagement copy")
                .optional(),
        });
        const organicSchema = z.object({
            leads: z.array(leadSchema).min(4).max(8),
        });
        const organicPrompt = [
            "Identify recent posts (within the past 3 months) on Reddit, Facebook, and high-quality public forums.",
            "Focus on eldercare, assisted living, memory care, and smart-home support for seniors in Massachusetts.",
            "Exclude irrelevant topics (real estate investing, FIRE financial independence, non-care use-cases).",
            "For each post provide title, URL, post date, pain point summary, and non-spammy founder engagement strategy (structured field: engagement_strategy).",
            "Include optional *_citation fields with the exact source URL supporting each field when available.",
            `Every engagement strategy must include this tracking link exactly once: ${TRACKING_LINK}`,
            "Return between 4 and 8 distinct high-quality leads, prioritized by relevance to Massachusetts families navigating care decisions.",
        ].join(" ");

        // eslint-disable-next-line no-console
        console.log(`Firecrawl agent (organic) model=${organicModel} …`);
        organicResult = await firecrawl.agent({
            prompt: organicPrompt,
            schema: organicSchema,
            urls: UNIFIED_SEED_URLS,
            model: organicModel,
        });
        leads = extractLeadsFromAgentResult(organicResult);
        // eslint-disable-next-line no-console
        console.log(`Organic leads: ${leads.length}`);
    }

    let founderResult = null;
    let posts = [];
    if (runFounder()) {
        const postSchema = z.object({
            title: z.string(),
            title_citation: z.string().describe("Source URL for title").optional(),
            url: z.string(),
            url_citation: z.string().describe("Source URL for url").optional(),
            post_date: z.string(),
            post_date_citation: z.string().describe("Source URL for post_date").optional(),
            pain_point_summary: z.string(),
            pain_point_summary_citation: z.string().describe("Source URL for pain_point_summary").optional(),
            community_engagement_advice: z.string(),
            community_engagement_advice_citation: z
                .string()
                .describe("Source URL for community_engagement_advice")
                .optional(),
            transparency_disclosure: z.string(),
            transparency_disclosure_citation: z
                .string()
                .describe("Source URL for transparency_disclosure")
                .optional(),
        });
        const founderSchema = z.object({
            posts: z.array(postSchema).min(3).max(10),
        });
        const founderPrompt = [
            "Identify recent posts (within the past 3 months) on Reddit, Facebook, and high-quality public forums.",
            "Focus on eldercare, assisted living, memory care, and smart-home support for seniors in Massachusetts.",
            "Exclude irrelevant topics (real estate investing, FIRE, non-care use-cases).",
            "For each post provide title, URL, post date, and a pain point summary.",
            "",
            "Develop a 'Community-First Engagement Strategy' for each post that follows these rules:",
            "1. Lead with helpful, neutral advice (e.g., staffing ratios, pricing, MA-specific regulations).",
            "2. Avoid salesy language and direct link-dropping.",
            "3. Include a specific 'Transparency Disclosure' on how to mention the affiliation with aiassistliving.com naturally.",
            "4. Only suggest sharing a resource if it directly solves the user's problem.",
            "",
            `Target URLs for context (do not spam): ${BLOG_URL}`,
            "Return between 3 and 10 distinct posts, prioritized by relevance to Massachusetts families navigating care decisions.",
            "Include optional *_citation fields with the exact source URL supporting each field when available.",
        ].join(" ");

        // eslint-disable-next-line no-console
        console.log(`Firecrawl agent (founder) model=${founderModel} …`);
        founderResult = await firecrawl.agent({
            prompt: founderPrompt,
            schema: founderSchema,
            urls: UNIFIED_SEED_URLS,
            model: founderModel,
        });
        posts = extractPostsFromAgentResult(founderResult);
        // eslint-disable-next-line no-console
        console.log(`Founder posts: ${posts.length}`);
    }

    const pluginSearch = maybeRunFirecrawlPluginSearchAfterAgent(process.cwd(), stamp);

    const locationCode = parseInt(process.env.DATAFORSEO_LOCATION_CODE || "2840", 10);
    const languageCode = String(process.env.DATAFORSEO_LANG || "en").trim() || "en";
    const seedFromLeads = leads
        .map((r) => String(r.title || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 2);
    const seedKeywords = [
        ...seedFromLeads,
        "assisted living massachusetts",
        "memory care boston",
        "masshealth nursing home",
    ].filter((k, i, a) => a.indexOf(k) === i);

    let dataforseoHints = null;
    if (runOrganic()) {
        try {
            dataforseoHints = await fetchDataForSeoKeywordHints(seedKeywords, locationCode, languageCode);
        } catch (e) {
            dataforseoHints = { error: e.message || String(e), keywords: [] };
        }
    }

    const outDir = path.join(process.cwd(), "reports");
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, `social-engagement-${stamp}.json`);
    const mdPath = path.join(outDir, `social-engagement-${stamp}.md`);

    const pluginBundle = { pre_agent: pluginPre, post_agent_search: pluginSearch };

    const payload = {
        generated_at: generatedAt,
        mode: MODE,
        models: { organic: runOrganic() ? organicModel : null, founder: runFounder() ? founderModel : null },
        tracking_link: TRACKING_LINK,
        blog_url: BLOG_URL,
        firecrawl_plugin: pluginBundle,
        organic: runOrganic()
            ? { raw_agent_response: organicResult, leads }
            : { raw_agent_response: null, leads: [] },
        founder: runFounder()
            ? { raw_agent_response: founderResult, posts }
            : { raw_agent_response: null, posts: [] },
        dataforseo: dataforseoHints,
    };

    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(
        mdPath,
        buildUnifiedMarkdown(generatedAt, leads, posts, dataforseoHints, pluginBundle),
    );

    // eslint-disable-next-line no-console
    console.log(`Saved: ${jsonPath}`);
    // eslint-disable-next-line no-console
    console.log(`Saved: ${mdPath}`);

    if (dataforseoHints?.keywords?.length) {
        // eslint-disable-next-line no-console
        console.log(`DataForSEO: ${dataforseoHints.keywords.length} keyword hints`);
    } else if (dataforseoHints?.error) {
        // eslint-disable-next-line no-console
        console.log(`DataForSEO: skipped or error (${dataforseoHints.error})`);
    } else if (runOrganic() && !dataForSeoCredentialsFromEnv()) {
        // eslint-disable-next-line no-console
        console.log("DataForSEO: no credentials (set DATAFORSEO_USERNAME + DATAFORSEO_PASSWORD)");
    }

    const discordWebhook = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
    if (discordWebhook && (leads.length || posts.length)) {
        try {
            await sendUnifiedDiscord(discordWebhook, {
                leads,
                posts,
                meta: { jsonBasename: path.basename(jsonPath), generatedAt },
            });
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`Discord: ${err.message || err}`);
        }
    } else if (!discordWebhook && (leads.length || posts.length)) {
        // eslint-disable-next-line no-console
        console.log("Discord: skipped — DISCORD_WEBHOOK_URL not set");
    }
}

module.exports = { main };

if (require.main === module) {
    main().catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e.message || e);
        process.exit(1);
    });
}
