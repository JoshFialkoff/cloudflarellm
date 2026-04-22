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
    const transcriptHints = extractTranscriptHints(transcriptPath);

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
