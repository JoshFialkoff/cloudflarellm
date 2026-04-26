#!/usr/bin/env node
/**
 * Autonomous near-real-time Reddit optimizer loop.
 *
 * What it does each cycle:
 * - refresh Reddit token
 * - fetch ads + account totals
 * - auto-pause underperforming ads based on response-rate thresholds
 * - emit live landing-page override payload consumed by the web app
 * - post summary/actions to Discord
 *
 * NOTE:
 * Reddit Ads API schemas vary by account/feature flags; this script applies
 * only "safe" actions when required fields are present.
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const DEFAULT_REDDIT_BASE = "https://ads-api.reddit.com/api/v3";
const DEFAULT_USER_AGENT = "aiassistliving-reddit-realtime-optimizer/1.0";

const LOOP_SECONDS = Number.parseInt(process.env.REDDIT_OPTIMIZER_LOOP_SEC || "300", 10);
const MIN_IMPRESSIONS = Number.parseInt(process.env.REDDIT_AUTONOMOUS_MIN_IMPRESSIONS || "500", 10);
const MIN_CTR = Number.parseFloat(process.env.REDDIT_AUTONOMOUS_MIN_CTR || "0.0075");
const MAX_CPC = Number.parseFloat(process.env.REDDIT_AUTONOMOUS_MAX_CPC_USD || "6.0");
const MAX_PAUSES_PER_CYCLE = Number.parseInt(process.env.REDDIT_AUTONOMOUS_MAX_PAUSES_PER_CYCLE || "2", 10);
const DRY_RUN = /^(1|true|yes)$/i.test(String(process.env.REDDIT_AUTONOMOUS_DRY_RUN || "").trim());

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
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
}

function normalizeSpendUsd(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n >= 100000 ? n / 1_000_000 : n;
}

function adsHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        "User-Agent": process.env.REDDIT_USER_AGENT || DEFAULT_USER_AGENT,
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

function nextPageToken(pagination) {
    if (!pagination || typeof pagination !== "object") return null;
    return (
        pagination.next_page?.token
        || pagination.nextPage?.token
        || pagination.next_page_token
        || pagination.nextPageToken
        || null
    );
}

async function fetchRedditAccessTokenFromRefresh() {
    const clientId = String(process.env.REDDIT_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.REDDIT_CLIENT_SECRET || "").trim();
    const refreshToken = String(process.env.REDDIT_REFRESH_TOKEN || "").trim();
    if (!clientId || !clientSecret || !refreshToken) return null;
    const tokenUrl = process.env.REDDIT_OAUTH_TOKEN_URL || "https://www.reddit.com/api/v1/access_token";
    const auth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });
    const res = await axios.post(tokenUrl, body.toString(), {
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": process.env.REDDIT_USER_AGENT || DEFAULT_USER_AGENT,
        },
        validateStatus: () => true,
    });
    if (res.status !== 200) {
        const bodyText = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        throw new Error(`OAuth refresh failed (${res.status}): ${bodyText.slice(0, 240)}`);
    }
    return res.data?.access_token || null;
}

async function resolveRedditToken() {
    const direct = String(process.env.REDDIT_ADS_ACCESS_TOKEN || "").trim();
    if (direct) return direct;
    return fetchRedditAccessTokenFromRefresh();
}

async function listAdsResource(resourceName, adAccountId, token) {
    const base = (process.env.REDDIT_ADS_BASE_URL || DEFAULT_REDDIT_BASE).replace(/\/+$/, "");
    const rows = [];
    let pageToken = null;
    do {
        const params = { "page.size": 100 };
        if (pageToken) params["page.token"] = pageToken;
        const res = await axios.get(`${base}/ad_accounts/${adAccountId}/${resourceName}`, {
            headers: adsHeaders(token),
            params,
            validateStatus: () => true,
        });
        if (res.status < 200 || res.status >= 300) {
            const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
            throw new Error(`GET /${resourceName} failed (${res.status}): ${body.slice(0, 260)}`);
        }
        rows.push(...unwrapDataArray(res.data || {}));
        pageToken = nextPageToken(res.data?.pagination);
    } while (pageToken);
    return rows;
}

async function fetchAccountTotals(adAccountId, token, days = 7) {
    const base = (process.env.REDDIT_ADS_BASE_URL || DEFAULT_REDDIT_BASE).replace(/\/+$/, "");
    const end = new Date();
    end.setUTCMinutes(0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);
    const payload = {
        data: {
            starts_at: start.toISOString().replace(".000Z", "Z"),
            ends_at: end.toISOString().replace(".000Z", "Z"),
            fields: ["impressions", "clicks", "spend"],
        },
    };
    const res = await axios.post(`${base}/ad_accounts/${adAccountId}/reports`, payload, {
        headers: {
            ...adsHeaders(token),
            "Content-Type": "application/json",
        },
        validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
        const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        return { available: false, reason: `reports failed (${res.status}): ${body.slice(0, 220)}` };
    }
    const metrics = Array.isArray(res.data?.data?.metrics) ? res.data.data.metrics : [];
    const totals = metrics.reduce(
        (acc, row) => {
            acc.impressions += Number(row.impressions || 0);
            acc.clicks += Number(row.clicks || 0);
            acc.spend += normalizeSpendUsd(row.spend);
            return acc;
        },
        { impressions: 0, clicks: 0, spend: 0 },
    );
    return {
        available: true,
        ...totals,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    };
}

function adMetrics(ad) {
    const impressions = Number(ad.impressions || ad.stats?.impressions || 0);
    const clicks = Number(ad.clicks || ad.stats?.clicks || 0);
    const spend = normalizeSpendUsd(ad.spend || ad.stats?.spend || 0);
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    return { impressions, clicks, spend, ctr, cpc };
}

function chooseLandingOverride(ads) {
    const scored = ads
        .map((ad) => {
            const m = adMetrics(ad);
            const score = (m.ctr * 100) + (m.clicks / 20) - (m.cpc > 0 ? m.cpc * 0.4 : 0);
            return { ad, m, score };
        })
        .filter((x) => x.m.impressions > 0)
        .sort((a, b) => b.score - a.score);
    const winner = scored[0];
    if (!winner) return null;
    const ad = winner.ad || {};
    const community =
        (Array.isArray(ad?.targeting?.communities) && ad.targeting.communities[0])
        || (Array.isArray(ad?.targeting?.subreddits) && ad.targeting.subreddits[0])
        || "";
    return {
        updated_at: new Date().toISOString(),
        source: "autonomous-reddit-optimizer",
        community: String(community || ""),
        ad_text: String(ad.name || "").slice(0, 180),
        ad_graphic: String(ad.image_url || ad.thumbnail_url || ""),
        performance: {
            impressions: winner.m.impressions,
            clicks: winner.m.clicks,
            ctr: Number(winner.m.ctr.toFixed(6)),
            cpc: Number(winner.m.cpc.toFixed(4)),
        },
    };
}

async function pauseAd(adId, token) {
    const base = (process.env.REDDIT_ADS_BASE_URL || DEFAULT_REDDIT_BASE).replace(/\/+$/, "");
    const url = `${base}/ads/${adId}`;
    if (DRY_RUN) return { applied: false, dryRun: true };
    const res = await axios.patch(
        url,
        { data: { configured_status: "PAUSED" } },
        {
            headers: {
                ...adsHeaders(token),
                "Content-Type": "application/json",
            },
            validateStatus: () => true,
        },
    );
    if (res.status < 200 || res.status >= 300) {
        const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        throw new Error(`pause ad failed (${res.status}): ${body.slice(0, 200)}`);
    }
    return { applied: true, dryRun: false };
}

function selectAutoPauseCandidates(ads) {
    return ads
        .map((ad) => ({ ad, m: adMetrics(ad) }))
        .filter(({ ad, m }) => {
            const status = String(ad.configured_status || ad.status || "").toUpperCase();
            return status === "ACTIVE"
                && m.impressions >= MIN_IMPRESSIONS
                && ((m.ctr > 0 && m.ctr < MIN_CTR) || (m.cpc > 0 && m.cpc > MAX_CPC));
        })
        .sort((a, b) => {
            const failA = (MIN_CTR - a.m.ctr) + (a.m.cpc - MAX_CPC);
            const failB = (MIN_CTR - b.m.ctr) + (b.m.cpc - MAX_CPC);
            return failB - failA;
        })
        .slice(0, Math.max(0, MAX_PAUSES_PER_CYCLE));
}

function writeLandingOverride(override) {
    const outDir = path.join(process.cwd(), "public", "runtime");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "reddit-live-override.json");
    fs.writeFileSync(outPath, `${JSON.stringify(override || {}, null, 2)}\n`);
    return outPath;
}

async function postDiscord(lines) {
    const webhook = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
    if (!webhook) return;
    const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: lines.join("\n").slice(0, 1900) }),
    });
    if (!res.ok) {
        const body = await res.text();
        // eslint-disable-next-line no-console
        console.error(`Discord post failed (${res.status}): ${body.slice(0, 160)}`);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCycle(adAccountId) {
    const token = await resolveRedditToken();
    if (!token) throw new Error("Reddit token missing");
    const [ads, totals] = await Promise.all([
        listAdsResource("ads", adAccountId, token),
        fetchAccountTotals(adAccountId, token, 7),
    ]);
    const candidates = selectAutoPauseCandidates(ads);
    const actions = [];
    for (const c of candidates) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const out = await pauseAd(c.ad.id, token);
            actions.push({
                adId: c.ad.id,
                adName: c.ad.name || "(unnamed)",
                impressions: c.m.impressions,
                ctr: c.m.ctr,
                cpc: c.m.cpc,
                status: out.dryRun ? "dry-run" : "paused",
            });
        } catch (error) {
            actions.push({
                adId: c.ad.id,
                adName: c.ad.name || "(unnamed)",
                impressions: c.m.impressions,
                ctr: c.m.ctr,
                cpc: c.m.cpc,
                status: "failed",
                error: String(error?.message || error),
            });
        }
    }
    const override = chooseLandingOverride(ads);
    const overridePath = writeLandingOverride(override);
    const lines = [
        "Reddit Autonomous Optimizer",
        `- account: ${adAccountId}`,
        `- loop seconds: ${LOOP_SECONDS}`,
        `- dry run: ${DRY_RUN ? "yes" : "no"}`,
        ...(totals.available
            ? [
                `- totals: impressions=${totals.impressions}, clicks=${totals.clicks}, spend=$${totals.spend.toFixed(2)}, ctr=${(totals.ctr * 100).toFixed(2)}%, cpc=$${totals.cpc.toFixed(2)}`,
            ]
            : [`- totals unavailable: ${totals.reason}`]),
        `- landing override: ${overridePath}`,
        `- actions this cycle: ${actions.length}`,
        ...actions.map(
            (a) =>
                `  - [${a.status}] ${a.adName} (${a.adId}) impressions=${a.impressions} ctr=${(a.ctr * 100).toFixed(3)}% cpc=$${a.cpc.toFixed(2)}${a.error ? ` err=${a.error}` : ""}`,
        ),
    ];
    await postDiscord(lines);
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
}

async function main() {
    loadDotEnvFile(path.join(process.cwd(), ".env.local"));
    loadDotEnvFile(path.join(process.cwd(), ".env"));
    const adAccountId = String(process.env.REDDIT_AD_ACCOUNT_ID || "").trim();
    if (!adAccountId) {
        throw new Error("REDDIT_AD_ACCOUNT_ID missing.");
    }
    if (!Number.isFinite(LOOP_SECONDS) || LOOP_SECONDS < 20) {
        throw new Error("REDDIT_OPTIMIZER_LOOP_SEC must be >= 20");
    }
    // eslint-disable-next-line no-console
    console.log(
        `Starting autonomous Reddit optimizer loop (every ${LOOP_SECONDS}s, dryRun=${DRY_RUN})`,
    );
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await runCycle(adAccountId);
        } catch (error) {
            const msg = `Autonomous cycle failed: ${String(error?.message || error)}`;
            // eslint-disable-next-line no-console
            console.error(msg);
            // eslint-disable-next-line no-await-in-loop
            await postDiscord(["Reddit Autonomous Optimizer", `- error: ${msg}`]);
        }
        // eslint-disable-next-line no-await-in-loop
        await sleep(LOOP_SECONDS * 1000);
    }
}

main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error.message || error);
    process.exit(1);
});
