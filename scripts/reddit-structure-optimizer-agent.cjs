#!/usr/bin/env node
/**
 * Reddit Ads Structure Optimizer Agent
 *
 * Goal:
 * - identify top-performing ads
 * - enforce ad-group targeting hygiene (communities-only vs keywords-only)
 * - propose deployable ad variation recommendations per ad group
 *
 * Output:
 * - reports/reddit-structure-optimizer-<timestamp>.json
 * - reports/reddit-structure-optimizer-<timestamp>.md
 *
 * Required env:
 * - REDDIT_AD_ACCOUNT_ID
 * - REDDIT_ADS_ACCESS_TOKEN OR REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET + REDDIT_REFRESH_TOKEN
 *
 * Optional env:
 * - REDDIT_ADS_BASE_URL (default: https://ads-api.reddit.com/api/v3)
 * - REDDIT_USER_AGENT
 * - REDDIT_OPTIMIZER_DAYS (default: 7)
 * - REDDIT_BENCHMARK_ADS_JSON (JSON array of ads with metrics)
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { parseArgs } = require("node:util");

const DEFAULT_REDDIT_BASE = "https://ads-api.reddit.com/api/v3";
const DEFAULT_USER_AGENT = "aiassistliving-reddit-optimizer/1.0";
const DEFAULT_DAYS = Number.parseInt(process.env.REDDIT_OPTIMIZER_DAYS || "7", 10);

const DEFAULT_BENCHMARK_ADS = [
    {
        name: "4-25-26 Keywords Conversions Max",
        status: "pending_approval",
        impressions: 247,
        spendUsd: 33.44,
        clicks: 7,
        cpcUsd: 1.18,
        ctrPct: 2.834,
        cpaUsd: 8.26,
    },
    {
        name: "Unbiased AI Finds Best Memory Care for Dementia in Massachusetts",
        status: "active",
        impressions: 672,
        spendUsd: 12.6,
        clicks: 10,
        cpcUsd: 0.85,
        ctrPct: 1.488,
        cpaUsd: 8.47,
    },
    {
        name: "Help for Caregivers! AI Assisted Living Selector",
        status: "active",
        impressions: 719,
        spendUsd: 14.19,
        clicks: 9,
        cpcUsd: 1.13,
        ctrPct: 1.252,
        cpaUsd: 10.21,
    },
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

function resolveBenchmarkAds() {
    const raw = process.env.REDDIT_BENCHMARK_ADS_JSON;
    if (!raw) return DEFAULT_BENCHMARK_ADS;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_BENCHMARK_ADS;
    } catch {
        return DEFAULT_BENCHMARK_ADS;
    }
}

function normalizeSpendUsd(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n >= 100000 ? n / 1_000_000 : n;
}

function pct(num) {
    if (!Number.isFinite(num)) return "n/a";
    return `${(num * 100).toFixed(2)}%`;
}

async function postDiscordSummary({ payload, mdPath }) {
    const webhook = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
    if (!webhook) return { sent: false, reason: "DISCORD_WEBHOOK_URL missing" };
    const topAds = (payload.topAds || []).slice(0, 3);
    const remediation = payload.execution?.remediationResults || [];
    const planned = remediation.filter((r) => r.status === "planned").length;
    const applied = remediation.filter((r) => r.status === "applied").length;
    const failed = remediation.filter((r) => r.status === "failed").length;
    const lines = [
        "Reddit Structure Optimizer",
        `- Mode: ${payload.execution?.mode || "plan"}`,
        `- Account: ${payload.adAccountId}`,
        `- Inventory: campaigns=${payload.inventory?.campaigns || 0}, ad_groups=${payload.inventory?.adGroups || 0}, ads=${payload.inventory?.ads || 0}`,
        `- Delivery: impressions=${payload.totals?.impressions || 0}, clicks=${payload.totals?.clicks || 0}, spend=$${Number(payload.totals?.spendUsd || 0).toFixed(2)}`,
        `- Remediation: planned=${planned}, applied=${applied}, failed=${failed}`,
        "",
        "Top benchmark winners:",
        ...(topAds.length
            ? topAds.map(
                (ad, i) =>
                    `- #${i + 1} ${ad.name || "(unnamed)"} | CTR ${((ad.ctr || 0) * 100).toFixed(3)}% | CPC $${Number(ad.cpcUsd || 0).toFixed(2)}`,
            )
            : ["- none"]),
        "",
        `Report: ${mdPath}`,
    ];
    const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: lines.join("\n").slice(0, 1900) }),
    });
    if (!res.ok) {
        const body = await res.text();
        return { sent: false, reason: `Discord webhook failed (${res.status}): ${body.slice(0, 220)}` };
    }
    return { sent: true };
}

async function fetchRedditAccessTokenFromRefresh() {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    const refreshToken = process.env.REDDIT_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) return null;
    const tokenUrl = process.env.REDDIT_OAUTH_TOKEN_URL || "https://www.reddit.com/api/v1/access_token";
    const auth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });
    const response = await axios.post(tokenUrl, body.toString(), {
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": process.env.REDDIT_USER_AGENT || DEFAULT_USER_AGENT,
        },
        validateStatus: () => true,
    });
    if (response.status !== 200) {
        const snippet =
            typeof response.data === "string" ? response.data : JSON.stringify(response.data);
        throw new Error(`Reddit OAuth refresh failed (${response.status}): ${snippet.slice(0, 300)}`);
    }
    return response.data?.access_token || null;
}

async function resolveRedditToken() {
    const direct = String(process.env.REDDIT_ADS_ACCESS_TOKEN || "").trim();
    if (direct) return direct;
    return fetchRedditAccessTokenFromRefresh();
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
        pagination.next_page?.token ||
        pagination.nextPage?.token ||
        pagination.next_page_token ||
        pagination.nextPageToken ||
        null
    );
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
            throw new Error(`Reddit Ads GET /${resourceName} failed (${res.status}): ${body.slice(0, 400)}`);
        }
        const payload = res.data || {};
        rows.push(...unwrapDataArray(payload));
        pageToken = nextPageToken(payload.pagination);
    } while (pageToken);
    return rows;
}

async function fetchAccountTotals(adAccountId, token, days) {
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
        return {
            available: false,
            reason: `Reddit reports API failed (${res.status}): ${body.slice(0, 250)}`,
        };
    }
    const metrics = Array.isArray(res.data?.data?.metrics) ? res.data.data.metrics : [];
    const totals = metrics.reduce(
        (acc, m) => {
            acc.impressions += Number(m.impressions || 0);
            acc.clicks += Number(m.clicks || 0);
            acc.spendUsd += normalizeSpendUsd(m.spend);
            return acc;
        },
        { impressions: 0, clicks: 0, spendUsd: 0 },
    );
    return {
        available: true,
        windowDays: days,
        ...totals,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        cpcUsd: totals.clicks > 0 ? totals.spendUsd / totals.clicks : 0,
    };
}

function inferGroupType(groupName, targeting) {
    const name = String(groupName || "").toLowerCase();
    const communityHints = /(community|communit|subreddit|forum|thread|founder)/.test(name);
    const keywordHints = /(keyword|search|intent|query)/.test(name);
    const interestHints = /(interest|audience|affinity)/.test(name);
    const hasKeywords = Array.isArray(targeting?.keywords) && targeting.keywords.length > 0;
    const hasCommunities =
        (Array.isArray(targeting?.subreddits) && targeting.subreddits.length > 0) ||
        (Array.isArray(targeting?.communities) && targeting.communities.length > 0);
    const hasInterests = Array.isArray(targeting?.interests) && targeting.interests.length > 0;

    if (keywordHints || (hasKeywords && !hasCommunities)) return "keyword";
    if (interestHints || (hasInterests && !hasKeywords && !hasCommunities)) return "interest";
    if (communityHints || (hasCommunities && !hasKeywords)) return "community";
    if (hasKeywords && hasCommunities) return "mixed";
    return "unknown";
}

function evaluateGroupPolicy(group, adsInGroup) {
    const configuredStatus = String(group.configured_status || "").toUpperCase();
    if (configuredStatus === "DELETED" || configuredStatus === "ARCHIVED") {
        return {
            adGroupId: group.id || "",
            adGroupName: group.name || "(unnamed)",
            inferredType: "inactive",
            hasKeywords: false,
            hasCommunities: false,
            hasInterests: false,
            issueCount: 0,
            findings: [],
            configuredStatus,
        };
    }
    const targeting = group.targeting || {};
    const hasKeywords = Array.isArray(targeting.keywords) && targeting.keywords.length > 0;
    const hasCommunities =
        (Array.isArray(targeting.subreddits) && targeting.subreddits.length > 0) ||
        (Array.isArray(targeting.communities) && targeting.communities.length > 0);
    const hasInterests = Array.isArray(targeting.interests) && targeting.interests.length > 0;
    const groupType = inferGroupType(group.name, targeting);
    const findings = [];

    if (groupType === "community" && hasKeywords) {
        findings.push("Community ad group includes keywords; remove keywords and keep subreddit/community targeting only.");
    }
    if (groupType === "keyword" && hasCommunities) {
        findings.push("Keyword ad group includes communities; remove subreddit targeting and keep keyword intent only.");
    }
    if (groupType === "mixed") {
        findings.push("Ad group mixes community and keyword targets; split into two dedicated ad groups.");
    }
    if (!hasKeywords && !hasCommunities && !hasInterests) {
        findings.push("Ad group has no explicit keyword/community/interest targeting; verify targeting strategy.");
    }
    if (!adsInGroup.length) {
        findings.push("Ad group has no ads; pause or populate with variants from top performers.");
    }

    return {
        adGroupId: group.id || "",
        adGroupName: group.name || "(unnamed)",
        inferredType: groupType,
        hasKeywords,
        hasCommunities,
        hasInterests,
        issueCount: findings.length,
        findings,
        configuredStatus: configuredStatus || "UNKNOWN",
    };
}

function scoreAd(ad) {
    const impressions = Number(ad.impressions || 0);
    const clicks = Number(ad.clicks || 0);
    const spendUsd = normalizeSpendUsd(ad.spendUsd ?? ad.spend);
    const ctr = ad.ctrPct != null ? Number(ad.ctrPct) / 100 : impressions > 0 ? clicks / impressions : 0;
    const cpc = ad.cpcUsd != null ? Number(ad.cpcUsd) : clicks > 0 ? spendUsd / clicks : null;
    const cpa = ad.cpaUsd != null ? Number(ad.cpaUsd) : null;
    const score =
        (Number.isFinite(ctr) ? ctr * 100 : 0) +
        (Number.isFinite(cpc) && cpc > 0 ? 2 / cpc : 0) +
        (Number.isFinite(cpa) && cpa > 0 ? 3 / cpa : 0) +
        (impressions >= 500 ? 1.5 : 0);

    return {
        ...ad,
        impressions,
        clicks,
        spendUsd,
        ctr,
        cpcUsd: Number.isFinite(cpc) ? cpc : null,
        cpaUsd: Number.isFinite(cpa) ? cpa : null,
        score: Number(score.toFixed(4)),
    };
}

function topAdsFromBenchmarks(benchmarkAds, limit = 3) {
    return benchmarkAds.map(scoreAd).sort((a, b) => b.score - a.score).slice(0, limit);
}

function buildVariationRecommendations(topAds, policies) {
    const healthyGroups = policies.filter((p) => p.issueCount === 0);
    const fallbackGroups = policies;
    const groups = healthyGroups.length ? healthyGroups : fallbackGroups;
    const recommendations = [];

    for (const group of groups) {
        for (const ad of topAds) {
            const variantName = `${ad.name} - ${group.inferredType || "general"} variant`;
            const guidance =
                group.inferredType === "community"
                    ? "Keep subreddit/community intent language; do not add keyword lists."
                    : group.inferredType === "keyword"
                        ? "Keep keyword intent framing and search-style phrasing; do not add community targeting."
                        : "Clarify this ad group's targeting first, then adapt winner creative to the cleaned structure.";
            recommendations.push({
                adGroupName: group.adGroupName,
                adGroupType: group.inferredType,
                sourceWinningAd: ad.name,
                variantName,
                copyDirection: [
                    "Preserve core promise from winner creative.",
                    "Localize value proposition to Massachusetts caregiver intent.",
                    "Use direct CTA to start Typebot and compare facilities.",
                    guidance,
                ],
            });
        }
    }
    return recommendations.slice(0, 18);
}

function buildTopPriorityActions(policyFindings, topAds) {
    const actions = [];
    const withIssues = policyFindings.filter((x) => x.issueCount > 0);
    if (withIssues.length) {
        actions.push(
            `Fix targeting hygiene in ${withIssues.length} ad group(s): split mixed groups and enforce communities-only or keywords-only structure.`,
        );
    }
    if (topAds.length) {
        actions.push(
            `Promote top ${topAds.length} winning ads into structured variants across relevant ad groups to maximize CTR and conversion efficiency.`,
        );
    }
    actions.push("Pause empty or misconfigured ad groups until corrected to avoid spend leakage.");
    return actions;
}

function buildRemediationPlan(policyFindings) {
    const actions = [];
    for (const finding of policyFindings) {
        if (!finding.adGroupId) continue;
        if (finding.findings.some((f) => f.includes("no ads"))) {
            actions.push({
                type: "pause_empty_ad_group",
                adGroupId: finding.adGroupId,
                adGroupName: finding.adGroupName,
                reason: "Ad group has no ads; pause to prevent spend drift.",
            });
        }
        if (
            finding.findings.some(
                (f) =>
                    f.includes("no explicit keyword/subreddit targeting") ||
                    f.includes("mixes community and keyword targets") ||
                    f.includes("includes keywords") ||
                    f.includes("includes communities"),
            )
        ) {
            actions.push({
                type: "manual_restructure_required",
                adGroupId: finding.adGroupId,
                adGroupName: finding.adGroupName,
                reason:
                    "Targeting structure needs human validation/split (community vs keyword) before safe mutation.",
            });
        }
    }
    return actions;
}

async function pauseAdGroup(adAccountId, adGroupId, token) {
    const base = (process.env.REDDIT_ADS_BASE_URL || DEFAULT_REDDIT_BASE).replace(/\/+$/, "");
    const url = `${base}/ad_accounts/${adAccountId}/ad_groups/${adGroupId}`;
    const res = await axios.patch(
        url,
        { data: { status: "PAUSED" } },
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
        throw new Error(`Pause ad group failed (${res.status}): ${body.slice(0, 220)}`);
    }
    return true;
}

async function applyRemediationPlan({ adAccountId, token, plan, applyMutations }) {
    const results = [];
    for (const action of plan) {
        if (action.type !== "pause_empty_ad_group") {
            results.push({
                ...action,
                status: "planned",
                note: "Manual step required.",
            });
            continue;
        }
        if (!applyMutations) {
            results.push({
                ...action,
                status: "planned",
                note: "Run with --apply to execute.",
            });
            continue;
        }
        try {
            await pauseAdGroup(adAccountId, action.adGroupId, token);
            results.push({
                ...action,
                status: "applied",
                note: "Ad group paused.",
            });
        } catch (error) {
            results.push({
                ...action,
                status: "failed",
                note: String(error?.message || error),
            });
        }
    }
    return results;
}

async function main() {
    loadDotEnvFile(path.join(process.cwd(), ".env.local"));
    loadDotEnvFile(path.join(process.cwd(), ".env"));

    const { values } = parseArgs({
        options: {
            apply: { type: "boolean", default: false },
            plan: { type: "boolean", default: false },
        },
        allowPositionals: false,
    });
    const mode = values.apply ? "apply" : "plan";
    const adAccountId = String(process.env.REDDIT_AD_ACCOUNT_ID || "").trim();
    if (!adAccountId) {
        throw new Error("REDDIT_AD_ACCOUNT_ID missing.");
    }
    const token = await resolveRedditToken();
    if (!token) {
        throw new Error(
            "Reddit token missing. Set REDDIT_ADS_ACCESS_TOKEN or REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET + REDDIT_REFRESH_TOKEN.",
        );
    }

    const [campaigns, adGroups, ads, totals] = await Promise.all([
        listAdsResource("campaigns", adAccountId, token),
        listAdsResource("ad_groups", adAccountId, token),
        listAdsResource("ads", adAccountId, token),
        fetchAccountTotals(adAccountId, token, DEFAULT_DAYS),
    ]);

    const adsByGroup = new Map();
    for (const ad of ads) {
        const gid = ad.ad_group_id || ad.adGroupId || ad.ad_group || "";
        if (!adsByGroup.has(gid)) adsByGroup.set(gid, []);
        adsByGroup.get(gid).push(ad);
    }

    const policyFindings = adGroups.map((group) =>
        evaluateGroupPolicy(group, adsByGroup.get(group.id) || []),
    );

    const benchmarkAds = resolveBenchmarkAds();
    const topAds = topAdsFromBenchmarks(benchmarkAds, 3);
    const recommendations = buildVariationRecommendations(topAds, policyFindings);
    const actions = buildTopPriorityActions(policyFindings, topAds);
    const remediationPlan = buildRemediationPlan(policyFindings);
    const remediationResults = await applyRemediationPlan({
        adAccountId,
        token,
        plan: remediationPlan,
        applyMutations: mode === "apply",
    });

    const generatedAt = new Date().toISOString();
    const outputDir = path.join(process.cwd(), "reports");
    fs.mkdirSync(outputDir, { recursive: true });
    const stamp = generatedAt.replace(/[:.]/g, "-");
    const jsonPath = path.join(outputDir, `reddit-structure-optimizer-${stamp}.json`);
    const mdPath = path.join(outputDir, `reddit-structure-optimizer-${stamp}.md`);

    const payload = {
        generatedAt,
        adAccountId,
        windowDays: DEFAULT_DAYS,
        totals,
        inventory: {
            campaigns: campaigns.length,
            adGroups: adGroups.length,
            ads: ads.length,
        },
        topAds,
        policyFindings,
        recommendations,
        topPriorityActions: actions,
        execution: {
            mode,
            remediationResults,
        },
    };
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);

    const markdown = [
        "# Reddit Ads Structure Optimizer",
        "",
        `Generated: ${generatedAt}`,
        `Ad account: ${adAccountId}`,
        `Window: last ${DEFAULT_DAYS} days`,
        `Mode: ${mode}`,
        "",
        "## Account Snapshot",
        `- Campaigns: ${campaigns.length}`,
        `- Ad groups: ${adGroups.length}`,
        `- Ads: ${ads.length}`,
        ...(totals.available
            ? [
                `- Impressions: ${totals.impressions}`,
                `- Clicks: ${totals.clicks}`,
                `- Spend (USD): ${totals.spendUsd.toFixed(2)}`,
                `- CTR: ${pct(totals.ctr)}`,
                `- CPC: ${totals.cpcUsd.toFixed(2)}`,
            ]
            : [`- Delivery unavailable: ${totals.reason}`]),
        "",
        "## Top Performing Ad Benchmarks",
        ...topAds.map(
            (ad, index) =>
                `- #${index + 1} ${ad.name} | CTR ${(ad.ctr * 100).toFixed(3)}% | CPC ${ad.cpcUsd ? `$${ad.cpcUsd.toFixed(2)}` : "n/a"} | CPA ${ad.cpaUsd ? `$${ad.cpaUsd.toFixed(2)}` : "n/a"}`,
        ),
        "",
        "## Targeting Hygiene Findings",
        ...policyFindings.flatMap((f) =>
            f.issueCount
                ? [`- ${f.adGroupName} (${f.inferredType}): ${f.findings.join(" ")}`]
                : [`- ${f.adGroupName} (${f.inferredType}): OK`],
        ),
        "",
        "## Priority Actions",
        ...actions.map((a) => `- ${a}`),
        "",
        "## Remediation Plan",
        ...(remediationResults.length
            ? remediationResults.map(
                (r) =>
                    `- [${r.status}] ${r.type} | ${r.adGroupName} (${r.adGroupId}): ${r.note}`,
            )
            : ["- No remediation actions generated."]),
        "",
        "## Recommended Winner Variations",
        ...recommendations.map(
            (r) =>
                `- ${r.variantName} -> ${r.adGroupName} (${r.adGroupType}): ${r.copyDirection.join(" ")}`,
        ),
        "",
    ].join("\n");

    fs.writeFileSync(mdPath, `${markdown}\n`);
    const discord = await postDiscordSummary({ payload, mdPath });
    // eslint-disable-next-line no-console
    console.log(`Saved report JSON: ${jsonPath}`);
    // eslint-disable-next-line no-console
    console.log(`Saved report Markdown: ${mdPath}`);
    // eslint-disable-next-line no-console
    console.log(
        discord.sent
            ? "Posted optimizer summary to Discord."
            : `Discord post skipped: ${discord.reason}`,
    );
}

main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error.message || error);
    process.exit(1);
});
