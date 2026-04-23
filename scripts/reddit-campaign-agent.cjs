#!/usr/bin/env node
/**
 * Continuous Reddit + onsite conversion monitor.
 *
 * Pulls PostHog metrics for Reddit-attributed traffic and outputs:
 * - machine-readable JSON report
 * - human-readable markdown summary with recommended UX actions
 *
 * Required env:
 * - POSTHOG_API_KEY
 * - POSTHOG_PROJECT_ID
 *
 * Optional env:
 * - POSTHOG_HOST (default: https://us.posthog.com)
 * - REDDIT_ATTRIBUTION_DAYS (default: 7)
 * - REDDIT_AGENT_TRANSCRIPT_PATH
 */
const fs = require("fs");
const path = require("path");

const host = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/+$/, "");
const apiKey = process.env.POSTHOG_API_KEY;
const projectId = process.env.POSTHOG_PROJECT_ID;
const days = Number.parseInt(process.env.REDDIT_ATTRIBUTION_DAYS || "7", 10);
const ga4PropertyId = process.env.GA4_PROPERTY_ID || "properties/470773585";
const ga4AccessToken = process.env.GA4_ACCESS_TOKEN || "";
const redditAdsBaseUrl = (process.env.REDDIT_ADS_BASE_URL || "https://ads-api.reddit.com/api/v3").replace(/\/+$/, "");
const transcriptPath =
    process.env.REDDIT_AGENT_TRANSCRIPT_PATH ||
    path.join(
        process.env.HOME || "",
        ".cursor",
        "projects",
        "Users-joshfialkoff-Documents-Cursor-Workspaces-AI-Assist-Living-Finder",
        "agent-transcripts",
        "e530504a-4a0d-4b41-a851-4597e37d195e",
        "e530504a-4a0d-4b41-a851-4597e37d195e.jsonl",
    );

if (!apiKey || !projectId) {
    // eslint-disable-next-line no-console
    console.error(
        "Missing required env vars: POSTHOG_API_KEY and POSTHOG_PROJECT_ID",
    );
    process.exit(1);
}

if (!Number.isFinite(days) || days < 1) {
    // eslint-disable-next-line no-console
    console.error("REDDIT_ATTRIBUTION_DAYS must be a positive integer");
    process.exit(1);
}

function extractTranscriptHints(filePath) {
    if (!fs.existsSync(filePath)) {
        return {
            exists: false,
            path: filePath,
            notes: ["Transcript not found; using default monitoring heuristics."],
        };
    }

    const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
    const notes = [];
    for (const line of lines) {
        if (notes.length >= 5) break;
        if (!line.includes("PostHog") && !line.includes("GA4") && !line.includes("landing_")) {
            continue;
        }
        try {
            const row = JSON.parse(line);
            if (row?.message?.content?.[0]?.text) {
                const text = row.message.content[0].text
                    .split("\n")
                    .filter((s) => s.includes("PostHog") || s.includes("GA4") || s.includes("landing_"))
                    .slice(0, 2)
                    .join(" ");
                if (text) notes.push(text.slice(0, 220));
            }
        } catch {
            continue;
        }
    }

    return {
        exists: true,
        path: filePath,
        notes: notes.length ? notes : ["Transcript loaded, but no analytics hints extracted."],
    };
}

function buildRedditWhereClause() {
    return `
(
    lower(coalesce(properties.$referring_domain, '')) LIKE '%reddit.com%'
    OR lower(coalesce(properties.$current_url, '')) LIKE '%utm_source=reddit%'
    OR lower(coalesce(properties.$current_url, '')) LIKE '%rdt_cid=%'
    OR lower(coalesce(properties.$current_url, '')) LIKE '%qcclkid=%'
)`;
}

function buildPaidSourceWhereClause(source) {
    if (source === "reddit") {
        return `
(
    lower(coalesce(properties.$referring_domain, '')) LIKE '%reddit.com%'
    OR lower(coalesce(properties.$current_url, '')) LIKE '%utm_source=reddit%'
    OR lower(coalesce(properties.utm_source, '')) = 'reddit'
    OR lower(coalesce(properties.$current_url, '')) LIKE '%rdt_cid=%'
    OR lower(coalesce(properties.$current_url, '')) LIKE '%qcclkid=%'
)`;
    }
    if (source === "google") {
        return `
(
    lower(coalesce(properties.$referring_domain, '')) LIKE '%google.%'
    OR lower(coalesce(properties.$current_url, '')) LIKE '%utm_source=google%'
    OR lower(coalesce(properties.utm_source, '')) = 'google'
    OR lower(coalesce(properties.$current_url, '')) LIKE '%gclid=%'
)`;
    }
    if (source === "quantcast") {
        return `
(
    lower(coalesce(properties.$referring_domain, '')) LIKE '%quantcast.%'
    OR lower(coalesce(properties.$current_url, '')) LIKE '%utm_source=quantcast%'
    OR lower(coalesce(properties.utm_source, '')) = 'quantcast'
    OR lower(coalesce(properties.$current_url, '')) LIKE '%qcclkid=%'
)`;
    }
    return "1 = 0";
}

function isoDateDaysAgo(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().slice(0, 10);
}

async function runHogQL(query) {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: {
                kind: "HogQLQuery",
                query,
            },
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`PostHog query failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    return json?.results || [];
}

async function runGa4Report({
    propertyId,
    accessToken,
    startDate,
    endDate,
}) {
    if (!accessToken) {
        return { available: false, reason: "GA4_ACCESS_TOKEN missing" };
    }
    const res = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                dateRanges: [{ startDate, endDate, name: "window" }],
                dimensions: [{ name: "sessionSource" }, { name: "eventName" }],
                metrics: [{ name: "eventCount" }, { name: "sessions" }],
                dimensionFilter: {
                    andGroup: {
                        expressions: [
                            {
                                filter: {
                                    fieldName: "sessionSource",
                                    inListFilter: {
                                        values: ["reddit", "google", "quantcast"],
                                        caseSensitive: false,
                                    },
                                },
                            },
                            {
                                filter: {
                                    fieldName: "eventName",
                                    inListFilter: {
                                        values: [
                                            "typebot_started",
                                            "typebot_completed",
                                            "typebot_abandoned",
                                            "facility_contact_clicked",
                                        ],
                                        caseSensitive: false,
                                    },
                                },
                            },
                        ],
                    },
                },
                limit: 1000,
            }),
        },
    );

    if (!res.ok) {
        const body = await res.text();
        return {
            available: false,
            reason: `GA4 runReport failed (${res.status}): ${body.slice(0, 250)}`,
        };
    }
    const json = await res.json();
    const out = {
        reddit: { typebotStarted: 0, typebotCompleted: 0, typebotAbandoned: 0, contacts: 0 },
        google: { typebotStarted: 0, typebotCompleted: 0, typebotAbandoned: 0, contacts: 0 },
        quantcast: { typebotStarted: 0, typebotCompleted: 0, typebotAbandoned: 0, contacts: 0 },
    };
    for (const row of json.rows || []) {
        const source = row.dimensionValues?.[0]?.value?.toLowerCase?.() || "";
        const eventName = row.dimensionValues?.[1]?.value || "";
        const eventCount = Number(row.metricValues?.[0]?.value || 0);
        if (!out[source]) continue;
        if (eventName === "typebot_started") out[source].typebotStarted += eventCount;
        if (eventName === "typebot_completed") out[source].typebotCompleted += eventCount;
        if (eventName === "typebot_abandoned") out[source].typebotAbandoned += eventCount;
        if (eventName === "facility_contact_clicked") out[source].contacts += eventCount;
    }
    return {
        available: true,
        propertyId,
        startDate,
        endDate,
        bySource: out,
    };
}

async function resolveRedditAdsToken() {
    const direct = String(process.env.REDDIT_ADS_ACCESS_TOKEN || "").trim();
    if (direct) return direct;
    const clientId = String(process.env.REDDIT_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.REDDIT_CLIENT_SECRET || "").trim();
    const refreshToken = String(process.env.REDDIT_REFRESH_TOKEN || "").trim();
    if (!clientId || !clientSecret || !refreshToken) return null;
    const tokenUrl = process.env.REDDIT_OAUTH_TOKEN_URL || "https://www.reddit.com/api/v1/access_token";
    const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });
    const res = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": process.env.REDDIT_USER_AGENT || "aiassistliving-reddit-ads-sync/1.0",
        },
        body: body.toString(),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return json?.access_token || null;
}

async function fetchRedditAdsCampaignSummary(startDate, endDate) {
    const adAccountId = process.env.REDDIT_AD_ACCOUNT_ID || "";
    if (!adAccountId) {
        return { available: false, reason: "REDDIT_AD_ACCOUNT_ID missing" };
    }
    const token = await resolveRedditAdsToken();
    if (!token) {
        return { available: false, reason: "Reddit ads token missing/invalid" };
    }
    const url = new URL(`${redditAdsBaseUrl}/ad_accounts/${adAccountId}/reports`);
    url.searchParams.set("entity", "CAMPAIGN");
    url.searchParams.set("time_unit", "DAY");
    url.searchParams.set("start_time", startDate);
    url.searchParams.set("end_time", endDate);
    url.searchParams.set("metrics", "impressions,clicks,spend");
    url.searchParams.set("breakdowns", "campaign_id");
    const res = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": process.env.REDDIT_USER_AGENT || "aiassistliving-reddit-ads-sync/1.0",
        },
    });
    if (!res.ok) {
        const body = await res.text();
        return {
            available: false,
            reason: `Reddit reports API failed (${res.status}): ${body.slice(0, 250)}`,
        };
    }
    const json = await res.json().catch(() => ({}));
    const rows = Array.isArray(json?.data) ? json.data : [];
    let impressions = 0;
    let clicks = 0;
    let spend = 0;
    for (const row of rows) {
        impressions += Number(row.impressions || 0);
        clicks += Number(row.clicks || 0);
        spend += Number(row.spend || 0);
    }
    return {
        available: true,
        adAccountId,
        startDate,
        endDate,
        campaignRows: rows.length,
        totals: {
            impressions,
            clicks,
            spend,
            ctr: impressions > 0 ? clicks / impressions : 0,
            cpc: clicks > 0 ? spend / clicks : 0,
        },
    };
}

function fmtPct(n) {
    if (!Number.isFinite(n)) return "n/a";
    return `${(n * 100).toFixed(2)}%`;
}

function recommendActions(metrics) {
    const actions = [];
    if (metrics.redditPageviews <= 50) {
        actions.push("Increase Reddit traffic volume before making major UX conclusions.");
    }
    if (metrics.redditContactRate < 0.01) {
        actions.push("Test stronger above-the-fold CTA copy and reduce first-step friction in Typebot.");
    }
    if (metrics.redditSearchRate < 0.05) {
        actions.push("Move primary CTA higher and clarify expected outcome before users click.");
    }
    if (metrics.inlineVariantRate > metrics.facadeVariantRate && metrics.redditContactRate < metrics.sitewideContactRate) {
        actions.push("Route more Reddit traffic to facade hero variant and A/B test inline-video autoplay messaging.");
    }
    if (!actions.length) {
        actions.push("Current funnel is stable; run a new headline + CTA microcopy test for incremental gains.");
    }
    return actions;
}

function buildQuestionUrgencyRanking(questionRows, metrics) {
    const downstreamRate =
        metrics.redditContactRate > 0 ? metrics.redditContactRate : metrics.sitewideContactRate;

    return questionRows
        .map((row) => {
            const questionId = row[0] || "unknown";
            const questionType = row[1] || "unknown";
            const viewed = Number(row[2] || 0);
            const answered = Number(row[3] || 0);
            const stepCompleted = Number(row[4] || 0);
            const dropOff = Math.max(viewed - answered, 0);
            const dropOffRate = viewed > 0 ? dropOff / viewed : 0;
            const recoverableConversions = dropOff * downstreamRate;
            const urgencyScore = dropOff * downstreamRate;

            return {
                questionId,
                questionType,
                viewed,
                answered,
                stepCompleted,
                dropOff,
                dropOffRate,
                recoverableConversions,
                urgencyScore,
            };
        })
        .filter((q) => q.viewed > 0)
        .sort((a, b) => b.urgencyScore - a.urgencyScore)
        .slice(0, 10);
}

async function main() {
    const redditWhere = buildRedditWhereClause();
    const paidSources = ["reddit", "google", "quantcast"];
    const transcriptHints = extractTranscriptHints(transcriptPath);
    const gaStart = `${days}daysAgo`;
    const gaEnd = "yesterday";
    const redditStart = isoDateDaysAgo(days);
    const redditEnd = isoDateDaysAgo(1);

    const [trafficRows, conversionRows, layoutRows, questionRows] = await Promise.all([
        runHogQL(`
            SELECT
                countIf(event = '$pageview') AS reddit_pageviews,
                countIf(event = 'search_submitted') AS reddit_search_submitted,
                countIf(event = 'facility_contact_clicked') AS reddit_contacts
            FROM events
            WHERE timestamp > now() - INTERVAL ${days} DAY
              AND ${redditWhere}
        `),
        runHogQL(`
            SELECT
                countIf(event = 'search_submitted') / nullIf(countIf(event = '$pageview'), 0) AS reddit_search_rate,
                countIf(event = 'facility_contact_clicked') / nullIf(countIf(event = '$pageview'), 0) AS reddit_contact_rate,
                (SELECT countIf(event = 'facility_contact_clicked') / nullIf(countIf(event = '$pageview'), 0)
                 FROM events
                 WHERE timestamp > now() - INTERVAL ${days} DAY) AS sitewide_contact_rate
            FROM events
            WHERE timestamp > now() - INTERVAL ${days} DAY
              AND ${redditWhere}
        `),
        runHogQL(`
            SELECT
                coalesce(properties.homepage_layout, 'unknown') AS homepage_layout,
                countIf(event = '$pageview') AS views,
                countIf(event = 'facility_contact_clicked') AS contacts,
                countIf(event = 'facility_contact_clicked') / nullIf(countIf(event = '$pageview'), 0) AS contact_rate
            FROM events
            WHERE timestamp > now() - INTERVAL ${days} DAY
              AND ${redditWhere}
            GROUP BY homepage_layout
            ORDER BY views DESC
            LIMIT 10
        `),
        runHogQL(`
            SELECT
                coalesce(
                    nullIf(properties.question_id, ''),
                    nullIf(properties.blockId, ''),
                    nullIf(properties.id, ''),
                    'unknown'
                ) AS question_id,
                coalesce(
                    nullIf(properties.question_type, ''),
                    nullIf(properties.type, ''),
                    'unknown'
                ) AS question_type,
                countIf(event = 'typebot_question_viewed') AS viewed,
                countIf(event = 'typebot_answer_submitted') AS answered,
                countIf(event = 'typebot_step_completed') AS step_completed
            FROM events
            WHERE timestamp > now() - INTERVAL ${days} DAY
              AND ${redditWhere}
              AND event IN ('typebot_question_viewed', 'typebot_answer_submitted', 'typebot_step_completed')
            GROUP BY question_id, question_type
            ORDER BY viewed DESC
            LIMIT 100
        `),
    ]);
    const paidSourceRows = await Promise.all(
        paidSources.map((source) =>
            runHogQL(`
                SELECT
                    countIf(event = '$pageview') AS pageviews,
                    countIf(event = 'typebot_started') AS typebot_starts,
                    countIf(event = 'typebot_completed') AS typebot_completions,
                    countIf(event = 'facility_contact_clicked') AS contacts
                FROM events
                WHERE timestamp > now() - INTERVAL ${days} DAY
                  AND ${buildPaidSourceWhereClause(source)}
            `).then((rows) => ({ source, row: rows[0] || [] })),
        ),
    );
    const [ga4Report, redditAdsReport] = await Promise.all([
        runGa4Report({
            propertyId: ga4PropertyId,
            accessToken: ga4AccessToken,
            startDate: gaStart,
            endDate: gaEnd,
        }).catch((e) => ({ available: false, reason: String(e?.message || e) })),
        fetchRedditAdsCampaignSummary(redditStart, redditEnd).catch((e) => ({
            available: false,
            reason: String(e?.message || e),
        })),
    ]);

    const traffic = trafficRows[0] || {};
    const conv = conversionRows[0] || {};
    const layoutByName = {};
    for (const row of layoutRows) {
        layoutByName[row[0]] = {
            views: Number(row[1] || 0),
            contacts: Number(row[2] || 0),
            contactRate: Number(row[3] || 0),
        };
    }

    const metrics = {
        windowDays: days,
        redditPageviews: Number(traffic[0] || 0),
        redditSearchSubmitted: Number(traffic[1] || 0),
        redditContacts: Number(traffic[2] || 0),
        redditSearchRate: Number(conv[0] || 0),
        redditContactRate: Number(conv[1] || 0),
        sitewideContactRate: Number(conv[2] || 0),
        facadeVariantRate: layoutByName.youtube_facade?.contactRate || 0,
        inlineVariantRate: layoutByName.youtube_inline?.contactRate || 0,
    };
    const paidAds = {};
    for (const item of paidSourceRows) {
        const r = item.row;
        paidAds[item.source] = {
            pageviews: Number(r[0] || 0),
            typebotStarts: Number(r[1] || 0),
            typebotCompletions: Number(r[2] || 0),
            contacts: Number(r[3] || 0),
        };
    }
    const questionUrgencyRanking = buildQuestionUrgencyRanking(
        questionRows,
        metrics,
    );

    const actions = recommendActions(metrics);
    const generatedAt = new Date().toISOString();
    const outputDir = path.join(process.cwd(), "reports");
    fs.mkdirSync(outputDir, { recursive: true });

    const stamp = generatedAt.replace(/[:.]/g, "-");
    const jsonPath = path.join(outputDir, `reddit-agent-${stamp}.json`);
    const mdPath = path.join(outputDir, `reddit-agent-${stamp}.md`);

    const payload = {
        generatedAt,
        transcript: transcriptHints,
        metrics,
        paidAds,
        ga4: ga4Report,
        redditAds: redditAdsReport,
        layout: Object.fromEntries(
            Object.entries(layoutByName).map(([k, v]) => [
                k,
                { ...v, contactRatePct: fmtPct(v.contactRate) },
            ]),
        ),
        questionUrgencyRanking: questionUrgencyRanking.map((q) => ({
            ...q,
            dropOffRatePct: fmtPct(q.dropOffRate),
            recoverableConversions: Number(q.recoverableConversions.toFixed(2)),
            urgencyScore: Number(q.urgencyScore.toFixed(2)),
        })),
        recommendedActions: actions,
    };

    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);

    const markdown = [
        "# Reddit Conversion Agent Report",
        "",
        `Generated: ${generatedAt}`,
        `Window: last ${days} days`,
        "",
        "## Core Metrics",
        `- Reddit pageviews: ${metrics.redditPageviews}`,
        `- Reddit search_submitted: ${metrics.redditSearchSubmitted} (${fmtPct(metrics.redditSearchRate)})`,
        `- Reddit facility_contact_clicked: ${metrics.redditContacts} (${fmtPct(metrics.redditContactRate)})`,
        `- Sitewide facility_contact_clicked rate: ${fmtPct(metrics.sitewideContactRate)}`,
        "",
        "## Paid Ads Typebot Activity",
        ...Object.entries(paidAds).map(
            ([source, v]) =>
                `- ${source}: pageviews=${v.pageviews}, typebot_started=${v.typebotStarts}, typebot_completed=${v.typebotCompletions}, contacts=${v.contacts}`,
        ),
        "",
        "## GA4 Paid Source Event Snapshot",
        ...(ga4Report.available
            ? Object.entries(ga4Report.bySource).map(
                ([source, v]) =>
                    `- ${source}: typebot_started=${v.typebotStarted}, typebot_completed=${v.typebotCompleted}, typebot_abandoned=${v.typebotAbandoned}, contacts=${v.contacts}`,
            )
            : [`- unavailable: ${ga4Report.reason}`]),
        "",
        "## Reddit Ads Delivery Snapshot",
        ...(redditAdsReport.available
            ? [
                `- account: ${redditAdsReport.adAccountId}`,
                `- window: ${redditAdsReport.startDate} to ${redditAdsReport.endDate}`,
                `- campaign rows: ${redditAdsReport.campaignRows}`,
                `- impressions: ${redditAdsReport.totals.impressions}`,
                `- clicks: ${redditAdsReport.totals.clicks}`,
                `- spend: ${redditAdsReport.totals.spend.toFixed(2)}`,
                `- ctr: ${fmtPct(redditAdsReport.totals.ctr)}`,
                `- cpc: ${redditAdsReport.totals.cpc.toFixed(4)}`,
            ]
            : [`- unavailable: ${redditAdsReport.reason}`]),
        "",
        "## Homepage Layout Performance (Reddit traffic)",
        ...Object.entries(layoutByName).map(
            ([layout, data]) =>
                `- ${layout}: ${data.contacts}/${data.views} contacts (${fmtPct(data.contactRate)})`,
        ),
        "",
        "## Recommended UX Actions",
        ...actions.map((a) => `- ${a}`),
        "",
        "## Typebot Question Urgency Ranking",
        ...questionUrgencyRanking.map(
            (q, idx) =>
                `- #${idx + 1} ${q.questionId} (${q.questionType}): viewed=${q.viewed}, answered=${q.answered}, drop-off=${q.dropOff} (${fmtPct(q.dropOffRate)}), est recoverable conversions=${q.recoverableConversions.toFixed(2)}`,
        ),
        ...(questionUrgencyRanking.length
            ? []
            : ["- No Typebot question-level events found for Reddit traffic in this window."]),
        "",
        "## Transcript Context Hints",
        `- Source: ${transcriptHints.path}`,
        ...transcriptHints.notes.map((n) => `- ${n}`),
        "",
        "## Next Step",
        "- Re-run daily and compare trends in `reports/` to prioritize UX experiments.",
        "",
    ].join("\n");

    fs.writeFileSync(mdPath, `${markdown}\n`);

    // eslint-disable-next-line no-console
    console.log(`Saved report JSON: ${jsonPath}`);
    // eslint-disable-next-line no-console
    console.log(`Saved report Markdown: ${mdPath}`);
}

main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error.message || error);
    process.exit(1);
});
