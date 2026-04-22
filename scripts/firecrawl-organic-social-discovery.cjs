#!/usr/bin/env node
/**
 * Organic social discovery via Firecrawl Agent (no Reddit Ads OAuth).
 *
 * Env:
 *   FIRECRAWL_API_KEY (required)
 * Optional:
 *   FIRECRAWL_AGENT_MODEL (default: spark-1-mini)
 *   DATAFORSEO_USERNAME + DATAFORSEO_PASSWORD — keyword_suggestions hints (US search)
 *     (aliases: DATAFORSEO_LOGIN, DATAFORSEO_API_PASSWORD; also loads .env.dataforseo.local)
 *
 * Loads .env.local, .env, and .env.dataforseo.local if present.
 *
 * Output: reports/organic-social-discovery-<iso>.json (+ .md summary)
 *
 * Optional Discord (same DISCORD_WEBHOOK_URL as other scripts):
 *   ORGANIC_DISCORD_AUTO_SEND=1 — after a successful run, post top leads to the webhook
 *   ORGANIC_DISCORD_MAX_LEADS (default 5), ORGANIC_DISCORD_MESSAGE_DELAY_MS (default 600)
 * Manual post: npm run social:organic:discord (or --stdin / --text / --report)
 */
const fs = require("fs");
const https = require("https");
const path = require("path");

const TRACKING_LINK =
    "https://www.reddit.com/user/joshfialkoff/trends/?keyword=419266225";

const DEFAULT_SEED_URLS = [
    "https://aiassistliving.com",
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

function isLeadLikeRow(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Boolean(value.url && value.title);
}

/** Firecrawl often returns `engagement_strategy`; our markdown expects `founder_engagement_strategy`. */
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

/** Some agent runs return a coupon/offers shape instead of lead fields. */
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

/**
 * Firecrawl Agent structured output varies: { leads: [...] }, a bare array on `data`,
 * or a numeric-key object ({ "0": {...}, "1": {...} }) possibly alongside other keys.
 */
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

/**
 * Keyword suggestions for ad copy + organic targeting (DataForSEO Labs).
 * @returns {Promise<{ keywords: { keyword: string, search_volume: number|null }[], raw_note?: string }|null>}
 */
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

function toMarkdown(leads) {
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

async function sendOrganicDiscordIfEnabled(webhookUrl, leads, meta) {
    const { postDiscordWebhook, splitDiscordContent } = require("./lib/discord-webhook.cjs");
    const { formatOrganicLeadBlock } = require("./lib/organic-discord-format.cjs");

    const delayMs = Math.max(
        0,
        Number.parseInt(process.env.ORGANIC_DISCORD_MESSAGE_DELAY_MS || "600", 10) || 0,
    );
    const maxRaw = Number.parseInt(process.env.ORGANIC_DISCORD_MAX_LEADS || "5", 10);
    const maxLeads = Math.min(8, Math.max(1, Number.isFinite(maxRaw) ? maxRaw : 5));
    const slice = leads.slice(0, maxLeads);

    const header = [
        "**Organic social discovery** (Firecrawl)",
        `Saved: ${meta.jsonBasename || "report"}`,
        `Generated: ${meta.generatedAt || "unknown"}`,
        "",
    ].join("\n");

    for (const chunk of splitDiscordContent(header)) {
        // eslint-disable-next-line no-await-in-loop
        await postDiscordWebhook(webhookUrl, chunk);
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));

    for (let i = 0; i < slice.length; i += 1) {
        const block = formatOrganicLeadBlock(slice[i], i);
        for (const chunk of splitDiscordContent(block)) {
            // eslint-disable-next-line no-await-in-loop
            await postDiscordWebhook(webhookUrl, chunk);
        }
        if (delayMs && i < slice.length - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
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

async function main() {
    loadDotEnvFile(path.join(process.cwd(), ".env.local"));
    loadDotEnvFile(path.join(process.cwd(), ".env"));
    loadDotEnvFile(path.join(process.cwd(), ".env.dataforseo.local"));

    const apiKey = String(process.env.FIRECRAWL_API_KEY || "").trim();
    if (!apiKey) {
        throw new Error("Set FIRECRAWL_API_KEY in .env.local (get a key at https://firecrawl.dev).");
    }

    const model = String(process.env.FIRECRAWL_AGENT_MODEL || "spark-1-mini").trim();

    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const { z } = await import("zod");

    const leadSchema = z.object({
        title: z.string(),
        title_citation: z.string().describe("Source URL for title").optional(),
        url: z.string(),
        url_citation: z.string().describe("Source URL for url").optional(),
        post_date: z.string(),
        post_date_citation: z.string().describe("Source URL for post_date").optional(),
        pain_point_summary: z.string(),
        pain_point_summary_citation: z.string().describe("Source URL for pain_point_summary").optional(),
        /** Model output often uses this name even when the prompt says "founder". */
        engagement_strategy: z.string().optional(),
        founder_engagement_strategy: z.string().optional(),
        engagement_strategy_citation: z.string().optional(),
        founder_engagement_strategy_citation: z
            .string()
            .describe("Source URL for engagement copy")
            .optional(),
    });

    /** Array schema is more reliable than numeric keys (0..5) for structured agent output. */
    const schema = z.object({
        leads: z.array(leadSchema).min(4).max(8),
    });

    const prompt = [
        "Identify recent posts (within the past 3 months) on Reddit, Facebook, and high-quality public forums.",
        "Focus on eldercare, assisted living, memory care, and smart-home support for seniors in Massachusetts.",
        "Exclude irrelevant topics (real estate investing, FIRE financial independence, non-care use-cases).",
        "For each post provide title, URL, post date, pain point summary, and non-spammy founder engagement strategy (structured field: engagement_strategy).",
        "Include optional *_citation fields with the exact source URL supporting each field when available.",
        `Every engagement strategy must include this tracking link exactly once: ${TRACKING_LINK}`,
        "Return between 4 and 8 distinct high-quality leads, prioritized by relevance to Massachusetts families navigating care decisions.",
    ].join(" ");

    const firecrawl = new Firecrawl({ apiKey });

    const result = await firecrawl.agent({
        prompt,
        schema,
        urls: DEFAULT_SEED_URLS,
        model,
    });

    const leads = extractLeadsFromAgentResult(result);

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
    try {
        dataforseoHints = await fetchDataForSeoKeywordHints(seedKeywords, locationCode, languageCode);
    } catch (e) {
        dataforseoHints = { error: e.message || String(e), keywords: [] };
    }

    const generatedAt = new Date().toISOString();
    const stamp = generatedAt.replace(/[:.]/g, "-");
    const outDir = path.join(process.cwd(), "reports");
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, `organic-social-discovery-${stamp}.json`);
    const mdPath = path.join(outDir, `organic-social-discovery-${stamp}.md`);

    const payload = {
        generated_at: generatedAt,
        model,
        tracking_link: TRACKING_LINK,
        raw_agent_response: result,
        leads,
        dataforseo: dataforseoHints,
    };

    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    const mdBase = toMarkdown(leads);
    fs.writeFileSync(mdPath, appendDataForSeoMarkdown(mdBase, dataforseoHints));

    // eslint-disable-next-line no-console
    console.log(`Saved: ${jsonPath}`);
    // eslint-disable-next-line no-console
    console.log(`Saved: ${mdPath}`);
    // eslint-disable-next-line no-console
    console.log(`Leads: ${leads.length}`);
    if (dataforseoHints?.keywords?.length) {
        // eslint-disable-next-line no-console
        console.log(`DataForSEO: ${dataforseoHints.keywords.length} keyword hints`);
    } else if (dataforseoHints?.error) {
        // eslint-disable-next-line no-console
        console.log(`DataForSEO: skipped or error (${dataforseoHints.error})`);
    } else if (!dataForSeoCredentialsFromEnv()) {
        // eslint-disable-next-line no-console
        console.log("DataForSEO: no credentials (set DATAFORSEO_USERNAME + DATAFORSEO_PASSWORD)");
    }

    const discordWebhook = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
    const discordAuto = /^(1|true|yes)$/i.test(
        String(process.env.ORGANIC_DISCORD_AUTO_SEND || "").trim(),
    );
    if (discordWebhook && discordAuto && leads.length) {
        try {
            await sendOrganicDiscordIfEnabled(discordWebhook, leads, {
                jsonBasename: path.basename(jsonPath),
                generatedAt,
            });
            const maxD = Math.min(
                8,
                Math.max(
                    1,
                    Number.parseInt(process.env.ORGANIC_DISCORD_MAX_LEADS || "5", 10) || 5,
                ),
            );
            // eslint-disable-next-line no-console
            console.log(`Discord: posted header + ${Math.min(leads.length, maxD)} lead(s).`);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`Discord: ${err.message || err}`);
        }
    } else if (discordAuto && !discordWebhook) {
        // eslint-disable-next-line no-console
        console.error("ORGANIC_DISCORD_AUTO_SEND is set but DISCORD_WEBHOOK_URL is missing.");
    }
}

main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e.message || e);
    process.exit(1);
});
