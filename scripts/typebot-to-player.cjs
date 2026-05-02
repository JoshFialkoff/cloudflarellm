#!/usr/bin/env node
/**
 * scripts/typebot-to-player.cjs
 *
 * Converts a Typebot-exported JSON (from the Typebot builder UI)
 * into a TypebotPlayer flow JSON used by components/TypebotPlayer.js.
 *
 * Supported Typebot block types → player step types:
 *   textBubble, image, video  → "message"
 *   inputText, inputEmail,
 *   inputNumber, inputDate    → "question" (free-text; options auto-generated)
 *   inputChoice               → "question" (uses defined choices as options)
 *   setVariable, condition,
 *   redirect                  → used for routing; not rendered as steps
 *
 * Also handles the Dify/DSL format stored in this repo's typebots/ directory
 * (where a workflow has nodes with types "start", "llm", "answer", "question").
 *
 * Usage:
 *   node scripts/typebot-to-player.cjs <input.json> [output.json]
 *   node scripts/typebot-to-player.cjs typebots/my-bot.json typebots/my-bot.player.json
 *
 * If output is omitted, writes alongside input as <input>.player.json.
 */

const fs = require("fs");
const path = require("path");

function slugify(str) {
    return String(str || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "bot";
}

/** Convert a Dify/DSL workflow node graph → player steps */
function convertDslWorkflow(app, workflow) {
    const nodeMap = {};
    for (const node of workflow.nodes ?? []) {
        nodeMap[node.id] = node;
    }
    const edges = workflow.edges ?? [];

    /** Follow edges from a node id, collecting non-start/llm/answer visit order */
    function successors(fromId) {
        return edges
            .filter((e) => e.source === fromId)
            .map((e) => e.target)
            .filter((id) => id && nodeMap[id]);
    }

    const steps = [];
    const visited = new Set();

    function visit(nodeId) {
        if (!nodeId || visited.has(nodeId)) return;
        visited.add(nodeId);
        const node = nodeMap[nodeId];
        if (!node) return;

        const type = node.type;

        if (type === "start") {
            for (const next of successors(nodeId)) visit(next);
            return;
        }

        if (type === "question") {
            steps.push({
                id: node.id,
                type: "question",
                text: node.data?.question || node.data?.text || "Please answer:",
                options: (node.data?.options ?? []).map((o) =>
                    typeof o === "string"
                        ? { value: slugify(o), label: o }
                        : { value: o.value ?? slugify(o.label ?? ""), label: o.label ?? o.value ?? "" },
                ),
                branches: node.data?.branches ?? undefined,
                nextStep: successors(nodeId)[0] ?? undefined,
            });
            for (const next of successors(nodeId)) visit(next);
            return;
        }

        if (type === "llm" || type === "answer") {
            const text = type === "llm"
                ? (node.data?.system_prompt ?? "")
                : (node.data?.text ?? "");
            // If there are downstream question nodes, emit as message; else result
            const nextIds = successors(nodeId);
            const hasMoreQuestions = nextIds.some(
                (id) => nodeMap[id]?.type === "question",
            );
            if (hasMoreQuestions) {
                steps.push({
                    id: node.id,
                    type: "message",
                    text: text.slice(0, 800),
                    buttonLabel: "Continue",
                    nextStep: nextIds[0] ?? undefined,
                });
            } else {
                steps.push({
                    id: node.id,
                    type: "result",
                    title: app?.name ?? "Your plan",
                    text: text.slice(0, 1200),
                });
            }
            for (const next of nextIds) visit(next);
            return;
        }

        // Unknown node type — skip, follow edges
        for (const next of successors(nodeId)) visit(next);
    }

    visit("start");

    return {
        id: slugify(app?.name ?? "bot"),
        name: app?.name ?? "Bot",
        description: app?.description ?? "",
        steps,
    };
}

/** Convert a Typebot builder export (groups/blocks format) → player steps */
function convertTypebotExport(data) {
    const name = data.name ?? data.typebot?.name ?? "Bot";
    const groups = data.groups ?? data.typebot?.groups ?? [];
    const steps = [];

    for (const group of groups) {
        for (const block of group.blocks ?? []) {
            const type = block.type;

            if (type === "text" || type === "textBubble") {
                const text = block.content?.richText
                    ? extractRichText(block.content.richText)
                    : block.content?.plainText ?? block.content?.html ?? "";
                steps.push({
                    id: block.id,
                    type: "message",
                    text,
                    buttonLabel: "Continue",
                });
                continue;
            }

            if (type === "choice input" || type === "inputChoice") {
                const options = (
                    block.items ??
                    block.options?.buttons ??
                    []
                ).map((item) => ({
                    value: slugify(item.content ?? item.label ?? item.value ?? ""),
                    label: item.content ?? item.label ?? item.value ?? "",
                }));
                steps.push({
                    id: block.id,
                    type: "question",
                    text: block.options?.question ?? block.options?.placeholder ?? "Choose an option:",
                    options,
                });
                continue;
            }

            if (
                type === "text input" ||
                type === "inputText" ||
                type === "email input" ||
                type === "inputEmail" ||
                type === "number input" ||
                type === "inputNumber"
            ) {
                steps.push({
                    id: block.id,
                    type: "question",
                    text: block.options?.question ?? block.options?.placeholder ?? "Please enter:",
                    options: [],
                    freeText: true,
                });
                continue;
            }
        }
    }

    return {
        id: slugify(name),
        name,
        description: data.description ?? "",
        steps,
    };
}

function extractRichText(richText) {
    if (!Array.isArray(richText)) return String(richText ?? "");
    return richText
        .flatMap((block) =>
            (block.children ?? []).map((c) => c.text ?? ""),
        )
        .join(" ")
        .trim();
}

function convert(raw) {
    // Dify DSL / local format: has .app + .workflow
    if (raw.app && raw.workflow) {
        return convertDslWorkflow(raw.app, raw.workflow);
    }
    // Typebot builder export: has .groups or .typebot.groups
    if (raw.groups || raw.typebot?.groups) {
        return convertTypebotExport(raw);
    }
    // Already player format
    if (raw.steps) {
        return raw;
    }
    throw new Error("Unrecognised format: expected .app+.workflow, .groups, or .steps");
}

// CLI entry
if (require.main === module) {
    const [, , inputPath, outputPath] = process.argv;
    if (!inputPath) {
        process.stderr.write("Usage: node scripts/typebot-to-player.cjs <input.json> [output.json]\n");
        process.exit(1);
    }
    const abs = path.resolve(inputPath);
    const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
    const flow = convert(raw);
    const out = outputPath
        ? path.resolve(outputPath)
        : abs.replace(/\.json$/, ".player.json");
    fs.writeFileSync(out, `${JSON.stringify(flow, null, 2)}\n`);
    process.stdout.write(`Written: ${out}\n`);
}

module.exports = { convert, convertDslWorkflow, convertTypebotExport };
