/**
 * Streams OpenAI chat completions for typebots whose DSL declares `stream: true`
 * on an `llm` node (in-house assistant — no Typebot.io embed).
 *
 * POST JSON: { slug: string, answersText: string }
 * Response: OpenAI-compatible text/event-stream (forwarded chunks).
 */

const fs = require("fs");
const path = require("path");

const ALLOWED_SLUGS = new Set([
    "lowest-cost-assisted-living-finder",
    "homepage-ai-assistant",
]);

function loadDsl(slug) {
    const file = path.join(process.cwd(), "typebots", `${slug}.dsl`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function firstStreamingLlm(workflow) {
    for (const node of workflow?.nodes ?? []) {
        if (node.type === "llm" && node.data?.stream) {
            return node;
        }
    }
    return null;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "method_not_allowed" });
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        return res.status(503).json({
            error: "openai_not_configured",
            message: "Streaming guidance is temporarily unavailable.",
        });
    }

    let body;
    try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
        return res.status(400).json({ error: "invalid_json" });
    }

    const slug = String(body?.slug ?? "").trim();
    const answersText = String(body?.answersText ?? "").trim();

    if (!ALLOWED_SLUGS.has(slug)) {
        return res.status(400).json({ error: "invalid_slug" });
    }
    if (!answersText || answersText.length > 12000) {
        return res.status(400).json({ error: "invalid_answers_text" });
    }

    const dsl = loadDsl(slug);
    const llm = dsl ? firstStreamingLlm(dsl.workflow) : null;
    if (!llm?.data?.system_prompt) {
        return res.status(500).json({ error: "dsl_misconfigured" });
    }

    const userTemplate = String(llm.data.user_prompt ?? "{{inputs}}");
    const userContent = userTemplate.replace(
        /\{\{\s*inputs\s*\}\}/gi,
        answersText,
    );

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            model: llm.data.model ?? "gpt-4o-mini",
            temperature:
                typeof llm.data.temperature === "number"
                    ? llm.data.temperature
                    : 0.25,
            stream: true,
            messages: [
                { role: "system", content: llm.data.system_prompt },
                { role: "user", content: userContent },
            ],
        }),
    });

    if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => "");
        return res.status(502).json({
            error: "openai_upstream_error",
            status: upstream.status,
            detail: errText.slice(0, 500),
        });
    }

    res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
    });

    const reader = upstream.body.getReader();
    try {
        let readResult = await reader.read();
        while (!readResult.done) {
            res.write(Buffer.from(readResult.value));
            readResult = await reader.read();
        }
    } catch {
        res.write(`data: ${JSON.stringify({ error: "stream_interrupted" })}\n\n`);
    } finally {
        res.end();
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "128kb",
        },
    },
};
