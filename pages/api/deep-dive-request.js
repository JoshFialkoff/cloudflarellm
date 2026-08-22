/**
 * POST /api/deep-dive-request
 *
 * Accepts a user's email + facility context and enqueues or triggers
 * a Dify deep-dive automation. In v1 this captures the request as a lead
 * signal; in v2 it can fire a Dify workflow and email the result.
 *
 * Body:
 *   email          string   — user's email (required)
 *   facilitySlugs  string[] — optional slugs to deep-dive
 *   source         string   — which CTA surface triggered this
 *   deepDive       boolean  — whether deep-dive was explicitly requested
 *
 * Env:
 *   DIFY_API_BASE_URL
 *   DIFY_DEEP_DIVE_API_KEY  — Dify app API key for deep-dive workflow
 */

import { getPosthogServer } from "../../lib/posthogServer";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { email, facilitySlugs = [], source, deepDive = false } = req.body || {};

    if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required." });
    }

    const posthog = getPosthogServer();

    // Capture the deep-dive request event server-side
    posthog.capture({
        distinctId: email,
        event: "deep_dive_requested",
        properties: {
            source: source || "unknown",
            deep_dive: Boolean(deepDive),
            facility_count: Array.isArray(facilitySlugs) ? facilitySlugs.length : 0,
            facility_slugs_preview: Array.isArray(facilitySlugs) ? facilitySlugs.slice(0, 3) : [],
        },
    });

    // Also capture as a lead_submitted event for funnel tracking
    posthog.capture({
        distinctId: email,
        event: "generate_lead",
        properties: {
            lead_source: source || "deep_dive_api",
            deep_dive: Boolean(deepDive),
        },
    });

    await posthog.flush().catch(() => {});

    // Dify deep-dive automation: this is a CHAT APP (not a workflow) that returns
    // top-3 facility recommendations. It requires Location input and a chat query.
    const difyKey = process.env.DEEP_DIVE_AUTOMATION_DIFY_API_KEY || process.env.DIFY_DEEP_DIVE_API_KEY;
    let workflowTriggered = false;

    if (difyKey && Array.isArray(facilitySlugs) && facilitySlugs.length > 0) {
        try {
            const { resolveDifyServiceUrls } = await import("../../lib/difyEndpoints");
            const urls = resolveDifyServiceUrls(process.env.DIFY_API_BASE_URL);

            // Build a query that asks the assistant to analyze the given facilities.
            const facilityList = facilitySlugs.slice(0, 3).join(", ");
            const query = `Please analyze these assisted living facilities and provide a detailed comparison: ${facilityList}.`;

            const difyRes = await fetch(urls.chatMessages, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${difyKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputs: {
                        Location: "Massachusetts",
                        how_urgent: "",
                        monthly_budget: "",
                    },
                    query,
                    response_mode: "blocking",
                    user: email,
                }),
            });

            if (difyRes.ok) workflowTriggered = true;
        } catch {
            // Non-blocking: log but don't fail the request
        }
    }

    return res.status(200).json({
        ok: true,
        deepDive: Boolean(deepDive),
        workflowTriggered,
        message: deepDive
            ? "Your detailed analysis request has been received. Check your email soon."
            : "Request received.",
    });
}
