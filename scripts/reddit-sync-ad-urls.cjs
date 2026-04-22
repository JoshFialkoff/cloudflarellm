#!/usr/bin/env node
/**
 * Download Reddit ads metadata and generate updated destination URLs
 * using explicit, resolved UTM values.
 *
 * Usage:
 *   node scripts/reddit-sync-ad-urls.cjs --input ./data/reddit-ads.csv
 *   node scripts/reddit-sync-ad-urls.cjs --discover-ad-accounts
 *   node scripts/reddit-sync-ad-urls.cjs --download --ad-account-id t2_xxxxxxx
 *
 * Env for --download mode (either):
 *   REDDIT_ADS_ACCESS_TOKEN   (bearer from Reddit; short-lived)
 *   OR refresh flow (POST https://www.reddit.com/api/v1/access_token):
 *   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN
 *   REDDIT_OAUTH_TOKEN_URL    (optional, default: https://www.reddit.com/api/v1/access_token)
 *   REDDIT_USER_AGENT         (recommended; Reddit may reject generic agents)
 *   REDDIT_ADS_BASE_URL       (optional, default: https://ads-api.reddit.com/api/v3)
 *
 * Optional args:
 *   --base-url      Default: https://aiassistliving.com/
 *   --campaign-tag  Default: reddit_caregiver_q2_2026
 *   --output        Default: ./reports/reddit-ads-url-updates-<timestamp>.csv
 */
const fs = require("fs");
const path = require("path");
const { parseArgs } = require("node:util");
const axios = require("axios");

const DEFAULT_BASE_URL = "https://aiassistliving.com/";
const DEFAULT_CAMPAIGN_TAG = "reddit_caregiver_q2_2026";

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

function slugify(value, fallback) {
    const cleaned = String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return cleaned || fallback;
}

function csvEscape(value) {
    const s = String(value ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function parseCsv(text) {
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        const next = text[i + 1];
        if (inQuotes) {
            if (ch === '"' && next === '"') {
                current += '"';
                i += 1;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
        } else if (ch === ",") {
            row.push(current);
            current = "";
        } else if (ch === "\n") {
            row.push(current);
            rows.push(row);
            row = [];
            current = "";
        } else if (ch !== "\r") {
            current += ch;
        }
    }

    if (current.length || row.length) {
        row.push(current);
        rows.push(row);
    }
    return rows;
}

function buildUrl({ baseUrl, campaignTag, ad }) {
    const url = new URL(baseUrl);
    const subredditValue = ad.subreddit
        ? `r_${slugify(ad.subreddit, "unknown")}`
        : "r_unknown";
    const adGroup = slugify(ad.adGroupName, "adgroup_unknown");
    const placement = slugify(ad.placement, "unknown");
    const adId = ad.adId || slugify(ad.adName, "ad_unknown");
    const keyword = ad.keyword ? slugify(ad.keyword, "na") : "na";

    url.searchParams.set("utm_source", "reddit");
    url.searchParams.set("utm_medium", "paid_social");
    url.searchParams.set("utm_campaign", campaignTag);
    url.searchParams.set("utm_term", subredditValue);
    url.searchParams.set("utm_content", `${adGroup}_${placement}`);
    url.searchParams.set("utm_id", adId);
    url.searchParams.set("utm_keyword", keyword);
    return url.toString();
}

async function fetchRedditAccessTokenFromRefresh() {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    const refreshToken = process.env.REDDIT_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
        return null;
    }
    const tokenUrl =
        (process.env.REDDIT_OAUTH_TOKEN_URL || "https://www.reddit.com/api/v1/access_token").replace(/\/+$/, "");
    const userAgent = process.env.REDDIT_USER_AGENT || "aiassistliving-reddit-ads-sync/1.0";
    const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });
    const res = await axios.post(tokenUrl, body.toString(), {
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": userAgent,
        },
        validateStatus: () => true,
    });
    if (res.status !== 200) {
        const snippet = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        throw new Error(`Reddit OAuth token request failed (${res.status}): ${snippet.slice(0, 400)}`);
    }
    const access = res.data?.access_token;
    if (!access) {
        throw new Error("Reddit OAuth response missing access_token.");
    }
    return access;
}

async function resolveRedditAdsAccessToken() {
    const direct = process.env.REDDIT_ADS_ACCESS_TOKEN;
    if (direct && String(direct).trim()) {
        return String(direct).trim();
    }
    return fetchRedditAccessTokenFromRefresh();
}

function adsApiHeaders(token) {
    const userAgent = process.env.REDDIT_USER_AGENT || "aiassistliving-reddit-ads-sync/1.0";
    return {
        Authorization: `Bearer ${token}`,
        "User-Agent": userAgent,
    };
}

function unwrapDataArray(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload?.data?.children)) {
        return payload.data.children.map((c) => c?.data || c);
    }
    return [];
}

function nextAdsPageToken(pagination) {
    if (!pagination || typeof pagination !== "object") return null;
    return (
        pagination.next_page?.token ||
        pagination.nextPage?.token ||
        pagination.next_page_token ||
        pagination.nextPageToken ||
        pagination.token ||
        null
    );
}

async function redditAdsGetJson(urlPath, token) {
    const baseUrl = (process.env.REDDIT_ADS_BASE_URL || "https://ads-api.reddit.com/api/v3").replace(/\/+$/, "");
    const url = `${baseUrl}${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;
    const res = await axios.get(url, {
        headers: adsApiHeaders(token),
        validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
        const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        throw new Error(`Reddit Ads API GET ${urlPath} failed (${res.status}): ${body.slice(0, 500)}`);
    }
    return res.data;
}

function warnAdAccountIdFormat(adAccountId) {
    if (!adAccountId) return;
    if (!/^(t2|a2)_/i.test(String(adAccountId))) {
        // eslint-disable-next-line no-console
        console.warn(
            `Warning: REDDIT_AD_ACCOUNT_ID "${adAccountId}" does not look like an Ads API id (expected t2_* or a2_*). ` +
                `Run: npm run ads:reddit:sync-urls -- --discover-ad-accounts`,
        );
    }
}

async function discoverAdAccounts() {
    const token = await resolveRedditAdsAccessToken();
    if (!token) {
        throw new Error(
            "Missing auth: set REDDIT_ADS_ACCESS_TOKEN or REDDIT_CLIENT_ID+REDDIT_CLIENT_SECRET+REDDIT_REFRESH_TOKEN.",
        );
    }
    const businessesPayload = await redditAdsGetJson("/me/businesses", token);
    const businesses = unwrapDataArray(businessesPayload);
    const rows = [];
    for (const b of businesses) {
        const businessId = b.id || b.business_id || b.businessId;
        if (!businessId) continue;
        const acctPayload = await redditAdsGetJson(`/businesses/${businessId}/ad_accounts`, token);
        const accounts = unwrapDataArray(acctPayload);
        for (const a of accounts) {
            const id = a.id || a.ad_account_id;
            const name = a.name || a.account_name || "";
            rows.push({ businessId, adAccountId: id, name });
        }
    }
    if (!rows.length) {
        // eslint-disable-next-line no-console
        console.log("No ad accounts found. Raw /me/businesses (truncated):");
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(businessesPayload, null, 2).slice(0, 2000));
        return;
    }
    // eslint-disable-next-line no-console
    console.log("business_id\tad_account_id\tname");
    for (const r of rows) {
        // eslint-disable-next-line no-console
        console.log(`${r.businessId}\t${r.adAccountId}\t${r.name}`);
    }
    // eslint-disable-next-line no-console
    console.log("\nSet REDDIT_AD_ACCOUNT_ID to the ad_account_id column (usually t2_... or a2_...).");
}

function normalizeCsvRow(row, indexByName) {
    return {
        adId:
            row[indexByName.ad_id] ||
            row[indexByName.id] ||
            row[indexByName.adid] ||
            "",
        adName: row[indexByName.ad_name] || row[indexByName.name] || "",
        adGroupName:
            row[indexByName.ad_group] ||
            row[indexByName.ad_group_name] ||
            row[indexByName.adgroup] ||
            "",
        subreddit:
            row[indexByName.subreddit_name] ||
            row[indexByName.subreddit] ||
            row[indexByName.placement_subreddit] ||
            "",
        placement: row[indexByName.placement] || row[indexByName.inventory] || "",
        keyword: row[indexByName.keyword] || "",
        destinationUrl:
            row[indexByName.destination_url] ||
            row[indexByName.url] ||
            row[indexByName.click_url] ||
            "",
    };
}

async function downloadAdsFromReddit(adAccountId) {
    const token = await resolveRedditAdsAccessToken();
    if (!token) {
        throw new Error(
            "Missing auth for --download: set REDDIT_ADS_ACCESS_TOKEN, or set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET + REDDIT_REFRESH_TOKEN (OAuth POST to REDDIT_OAUTH_TOKEN_URL).",
        );
    }
    if (!adAccountId) {
        throw new Error("--ad-account-id is required with --download mode.");
    }
    warnAdAccountIdFormat(adAccountId);

    const baseUrl = (process.env.REDDIT_ADS_BASE_URL || "https://ads-api.reddit.com/api/v3").replace(/\/+$/, "");
    const ads = [];
    let pageToken = null;
    do {
        const params = { "page.size": 100 };
        if (pageToken) params["page.token"] = pageToken;
        const response = await axios.get(`${baseUrl}/ad_accounts/${adAccountId}/ads`, {
            headers: adsApiHeaders(token),
            params,
            validateStatus: () => true,
        });
        if (response.status < 200 || response.status >= 300) {
            const body = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
            let hint = "";
            if (response.status === 401) {
                hint =
                    " Token rejected (401): regenerate OAuth access_token with scope adsread; REDDIT_ADS_ACCESS_TOKEN expires ~1h.";
            }
            if (response.status === 403 || response.status === 404) {
                hint +=
                    " Wrong ad account id? API expects t2_* or a2_* (see npm run ads:reddit:discover).";
            }
            throw new Error(`List Ads failed (${response.status}): ${body.slice(0, 500)}${hint}`);
        }
        const payload = response.data || {};
        const items = unwrapDataArray(payload);
        for (const data of items) {
            ads.push({
                adId: data.id || "",
                adName: data.name || data.creative_name || "",
                adGroupName: data.ad_group_name || data.ad_group_id || "",
                subreddit:
                    data.subreddit_name ||
                    data.subreddit ||
                    (Array.isArray(data.targeting?.subreddits) ? data.targeting.subreddits[0] : "") ||
                    "",
                placement: data.placement || data.inventory_type || "",
                keyword:
                    Array.isArray(data.targeting?.keywords) && data.targeting.keywords[0]
                        ? data.targeting.keywords[0]
                        : "",
                destinationUrl: data.destination_url || data.click_url || "",
            });
        }
        pageToken = nextAdsPageToken(payload.pagination);
    } while (pageToken);

    return ads;
}

function writeOutput(outputPath, rows) {
    const header = [
        "ad_id",
        "ad_name",
        "ad_group_name",
        "subreddit",
        "placement",
        "keyword",
        "existing_destination_url",
        "updated_destination_url",
    ];
    const body = rows.map((r) =>
        [
            r.adId,
            r.adName,
            r.adGroupName,
            r.subreddit,
            r.placement,
            r.keyword,
            r.destinationUrl,
            r.updatedUrl,
        ]
            .map(csvEscape)
            .join(","),
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${header.join(",")}\n${body.join("\n")}\n`);
}

async function main() {
    loadDotEnvFile(path.join(process.cwd(), ".env.local"));
    loadDotEnvFile(path.join(process.cwd(), ".env"));

    const { values } = parseArgs({
        options: {
            input: { type: "string" },
            output: { type: "string" },
            "base-url": { type: "string" },
            "campaign-tag": { type: "string" },
            download: { type: "boolean", default: false },
            "discover-ad-accounts": { type: "boolean", default: false },
            "ad-account-id": { type: "string" },
        },
        allowPositionals: false,
    });

    const baseUrl =
        values["base-url"] ||
        process.env.REDDIT_SYNC_BASE_URL ||
        DEFAULT_BASE_URL;
    const campaignTag =
        values["campaign-tag"] ||
        process.env.REDDIT_SYNC_CAMPAIGN_TAG ||
        DEFAULT_CAMPAIGN_TAG;
    const defaultOut = path.join(
        process.cwd(),
        "reports",
        `reddit-ads-url-updates-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
    );
    const outputPath = values.output || defaultOut;

    if (values["discover-ad-accounts"]) {
        await discoverAdAccounts();
        return;
    }

    let ads = [];
    if (values.download) {
        const adAccountId = values["ad-account-id"] || process.env.REDDIT_AD_ACCOUNT_ID;
        ads = await downloadAdsFromReddit(adAccountId);
    } else {
        if (!values.input) {
            throw new Error("Provide --input <csv>, --download, or --discover-ad-accounts.");
        }
        const csvText = fs.readFileSync(path.resolve(values.input), "utf8");
        const rows = parseCsv(csvText);
        if (!rows.length) {
            throw new Error("Input CSV is empty.");
        }
        const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());
        const indexByName = Object.fromEntries(headers.map((h, i) => [h, i]));
        ads = rows.slice(1).filter((r) => r.length).map((r) => normalizeCsvRow(r, indexByName));
    }

    const updatedRows = ads.map((ad) => ({
        ...ad,
        updatedUrl: buildUrl({ baseUrl, campaignTag, ad }),
    }));
    writeOutput(outputPath, updatedRows);

    // eslint-disable-next-line no-console
    console.log(`Processed ads: ${updatedRows.length}`);
    // eslint-disable-next-line no-console
    console.log(`Output CSV: ${outputPath}`);
}

main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error.message || error);
    process.exit(1);
});
