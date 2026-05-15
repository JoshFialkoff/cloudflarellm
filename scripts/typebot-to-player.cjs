#!/usr/bin/env node
/**
 * scripts/typebot-to-player.cjs
 *
 * Converts a Typebot-exported JSON (from the Typebot builder UI)
 * into a TypebotPlayer flow JSON used by components/TypebotPlayer.js.
 *
 * Walks Typebot edges from the start event so step order and branches
 * match the published flow (not group list order).
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

function extractRichText(richText) {
    if (!Array.isArray(richText)) return String(richText ?? "");
    return richText
        .flatMap((block) => (block.children ?? []).map((c) => c.text ?? ""))
        .join(" ")
        .trim();
}

const SKIP_BLOCK_TYPES = new Set([
    "Google Analytics",
    "Webhook",
    "Set variable",
    "Condition",
    "dify-ai",
]);

/** Convert a Typebot builder export (groups/blocks + edges) → player steps */
function convertTypebotExport(data) {
    const groups = data.groups ?? data.typebot?.groups ?? [];
    const edges = data.edges ?? data.typebot?.edges ?? [];
    const edgeById = new Map(edges.map((e) => [e.id, e]));
    const blockById = new Map();
    const groupById = new Map();

    for (const group of groups) {
        groupById.set(group.id, group);
        for (const block of group.blocks ?? []) {
            blockById.set(block.id, {
                block,
                groupId: group.id,
                groupTitle: group.title ?? "",
            });
        }
    }

    function resolveEdge(edgeId) {
        const edge = edgeById.get(edgeId);
        if (!edge?.to?.groupId) return null;
        const group = groupById.get(edge.to.groupId);
        if (!group) return null;
        const blockId = edge.to.blockId ?? group.blocks?.[0]?.id;
        if (!blockId) return null;
        return { groupId: edge.to.groupId, blockId };
    }

    function nextInGroup(groupId, blockId) {
        const group = groupById.get(groupId);
        const blocks = group?.blocks ?? [];
        const idx = blocks.findIndex((b) => b.id === blockId);
        if (idx >= 0 && idx < blocks.length - 1) {
            return { groupId, blockId: blocks[idx + 1].id };
        }
        return null;
    }

    function outgoingFromBlock(blockId) {
        const entry = blockById.get(blockId);
        if (entry?.block?.outgoingEdgeId) {
            return resolveEdge(entry.block.outgoingEdgeId);
        }
        const edge = edges.find(
            (e) => e.from?.blockId === blockId && !e.from?.itemId,
        );
        return edge ? resolveEdge(edge.id) : null;
    }

    function firstRenderable(ref) {
        let current = ref;
        const guard = new Set();
        while (current) {
            const key = `${current.groupId}:${current.blockId}`;
            if (guard.has(key)) return null;
            guard.add(key);
            const entry = blockById.get(current.blockId);
            if (!entry) return null;
            if (!SKIP_BLOCK_TYPES.has(entry.block.type)) return current;
            current =
                outgoingFromBlock(current.blockId) ??
                nextInGroup(current.groupId, current.blockId);
        }
        return null;
    }

    function optionValue(item) {
        if (item.value != null && String(item.value).trim()) {
            return String(item.value).trim();
        }
        return slugify(item.content ?? item.label ?? "");
    }

    function blockToStep(ref, pendingText) {
        const entry = blockById.get(ref.blockId);
        if (!entry) return null;
        const { block, groupTitle } = entry;

        if (block.type === "text" || block.type === "textBubble") {
            const text =
                extractRichText(block.content?.richText) ||
                block.content?.plainText ||
                "";
            if (!text) return null;
            return {
                id: block.id,
                type: "message",
                text,
                buttonLabel: "Continue",
            };
        }

        if (block.type === "choice input" || block.type === "inputChoice") {
            const options = (block.items ?? [])
                .map((item) => ({
                    value: optionValue(item),
                    label: String(item.content ?? item.label ?? "").trim(),
                }))
                .filter((o) => o.label && o.label !== "Click to edit");

            const branches = {};
            for (const item of block.items ?? []) {
                if (!item.outgoingEdgeId) continue;
                const target = firstRenderable(resolveEdge(item.outgoingEdgeId));
                if (target) branches[optionValue(item)] = target.blockId;
            }

            const text =
                pendingText ||
                block.options?.question?.trim() ||
                groupTitle?.trim() ||
                "Choose one:";

            return {
                id: block.id,
                type: "question",
                text,
                options,
                branches: Object.keys(branches).length ? branches : undefined,
            };
        }

        if (
            block.type === "text input" ||
            block.type === "inputText" ||
            block.type === "email input" ||
            block.type === "inputEmail" ||
            block.type === "number input" ||
            block.type === "inputNumber"
        ) {
            const labels = block.options?.labels ?? {};
            const placeholder = labels.placeholder?.trim();
            return {
                id: block.id,
                type: "question",
                text: pendingText || placeholder || "Your answer",
                options: [],
                freeText: true,
                inputType: block.type.includes("email")
                    ? "email"
                    : block.type.includes("number")
                      ? "tel"
                      : "text",
                buttonLabel: labels.button || "Continue",
                isLong: Boolean(block.options?.isLong),
            };
        }

        if (block.type === "rating input") {
            return {
                id: block.id,
                type: "question",
                text:
                    pendingText ||
                    "Please rate your satisfaction with these results.",
                options: ["1", "2", "3", "4", "5"].map((n) => ({
                    value: n,
                    label: n,
                })),
                inputKind: "rating",
            };
        }

        return null;
    }

    const steps = [];
    const stepIndex = new Map();

    function addStep(step) {
        if (!step || stepIndex.has(step.id)) return step.id;
        stepIndex.set(step.id, steps.length);
        steps.push(step);
        return step.id;
    }

    function enqueueNeighbors(ref, queue, seen) {
        const { blockId, groupId } = ref;
        const block = blockById.get(blockId)?.block;
        if (block?.type === "choice input" || block?.type === "inputChoice") {
            for (const item of block.items ?? []) {
                if (!item.outgoingEdgeId) continue;
                const target = resolveEdge(item.outgoingEdgeId);
                if (target && !seen.has(target.blockId)) queue.push(target);
            }
        }
        const sequential = nextInGroup(groupId, blockId);
        if (sequential && !seen.has(sequential.blockId)) queue.push(sequential);
        const outgoing = outgoingFromBlock(blockId);
        if (outgoing && !seen.has(outgoing.blockId)) queue.push(outgoing);
    }

    function collectSteps(startRef) {
        const queue = [startRef];
        const seen = new Set();
        let pendingText = null;
        let pendingGa = null;

        while (queue.length) {
            const ref = queue.shift();
            if (!ref?.blockId || seen.has(ref.blockId)) continue;
            seen.add(ref.blockId);

            const entry = blockById.get(ref.blockId);
            if (!entry) continue;
            const { block } = entry;

            if (block.type === "Google Analytics") {
                const label =
                    block.options?.label?.trim() ||
                    block.options?.category?.trim() ||
                    "";
                if (label) pendingGa = label;
                enqueueNeighbors(ref, queue, seen);
                continue;
            }

            if (SKIP_BLOCK_TYPES.has(block.type)) {
                enqueueNeighbors(ref, queue, seen);
                continue;
            }

            if (block.type === "text" || block.type === "textBubble") {
                pendingText = extractRichText(block.content?.richText);
                enqueueNeighbors(ref, queue, seen);
                continue;
            }

            const step = blockToStep(ref, pendingText);
            pendingText = null;
            if (step) {
                if (pendingGa) {
                    step.gaLabel = pendingGa;
                    pendingGa = null;
                }
                addStep(step);
            }
            enqueueNeighbors(ref, queue, seen);
        }
    }

    function linkSequentialNext() {
        for (const step of steps) {
            if (step.nextStep || step.branches) continue;
            const idx = stepIndex.get(step.id);
            if (idx != null && idx < steps.length - 1) {
                step.nextStep = steps[idx + 1].id;
            }
        }
        for (const step of steps) {
            const entry = blockById.get(step.id);
            if (!entry) continue;
            const defaultNext =
                outgoingFromBlock(step.id) ??
                nextInGroup(entry.groupId, step.id);
            const target = firstRenderable(defaultNext);
            if (target && stepIndex.has(target.blockId) && !step.branches) {
                step.nextStep = target.blockId;
            }
        }
    }

    const startEvent = (data.events ?? []).find((e) => e.type === "start");
    if (startEvent?.outgoingEdgeId) {
        const startRef = resolveEdge(startEvent.outgoingEdgeId);
        if (startRef) collectSteps(startRef);
    }
    linkSequentialNext();

    return {
        id: slugify(data.name ?? data.typebot?.name ?? "bot"),
        name: data.name ?? data.typebot?.name ?? "Bot",
        description: data.description ?? "",
        steps,
    };
}

/** Convert a Dify/DSL workflow node graph → player steps */
function convertDslWorkflow(app, workflow) {
    const nodeMap = {};
    for (const node of workflow.nodes ?? []) {
        nodeMap[node.id] = node;
    }
    const edges = workflow.edges ?? [];

    function successors(fromId) {
        return edges
            .filter((e) => e.source === fromId)
            .map((e) => e.target)
            .filter((id) => id && nodeMap[id]);
    }

    const steps = [];
    const visited = new Set();
    const skippedIds = new Set();

    function visit(nodeId) {
        if (!nodeId) return;
        if (skippedIds.has(nodeId)) {
            if (!visited.has(nodeId)) {
                visited.add(nodeId);
                for (const next of successors(nodeId)) visit(next);
            }
            return;
        }
        if (visited.has(nodeId)) return;
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
                        : {
                              value: o.value ?? slugify(o.label ?? ""),
                              label: o.label ?? o.value ?? "",
                          },
                ),
                branches: node.data?.branches ?? undefined,
                nextStep: successors(nodeId)[0] ?? undefined,
            });
            for (const next of successors(nodeId)) visit(next);
            return;
        }

        if (type === "llm" || type === "answer") {
            if (type === "llm" && node.data?.stream) {
                const nextIds = successors(nodeId);
                const answerId = nextIds.length === 1 ? nextIds[0] : null;
                const answerNode = answerId ? nodeMap[answerId] : null;
                const tpl = String(answerNode?.data?.text ?? "").trim();
                const echoesLlm =
                    answerNode?.type === "answer" &&
                    new RegExp(
                        `^\{\{\s*${node.id}\.text\s*\}\}$`,
                    ).test(tpl);
                const hasMoreQuestions = nextIds.some(
                    (id) => nodeMap[id]?.type === "question",
                );
                if (!hasMoreQuestions && echoesLlm) {
                    skippedIds.add(answerId);
                    steps.push({
                        id: node.id,
                        type: "result",
                        title: app?.name ?? "Your plan",
                        text: "Based on your answers:",
                        stream: true,
                        streamEndpoint:
                            node.data.stream_endpoint ??
                            "/api/bots/llm-stream",
                    });
                    visit(answerId);
                    return;
                }
            }
            const text =
                type === "llm"
                    ? (node.data?.system_prompt ?? "")
                    : (node.data?.text ?? "");
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

function convert(raw) {
    if (raw.app && raw.workflow) {
        return convertDslWorkflow(raw.app, raw.workflow);
    }
    if (raw.groups || raw.typebot?.groups) {
        return convertTypebotExport(raw);
    }
    if (raw.steps) {
        return raw;
    }
    throw new Error(
        "Unrecognised format: expected .app+.workflow, .groups, or .steps",
    );
}

if (require.main === module) {
    const [, , inputPath, outputPath] = process.argv;
    if (!inputPath) {
        process.stderr.write(
            "Usage: node scripts/typebot-to-player.cjs <input.json> [output.json]\n",
        );
        process.exit(1);
    }
    const abs = path.resolve(inputPath);
    let text = fs.readFileSync(abs, "utf8").trim();
    if (text.startsWith("n{")) text = text.slice(1);
    const raw = JSON.parse(text);
    const flow = convert(raw);
    const out = outputPath
        ? path.resolve(outputPath)
        : abs.replace(/\.json$/, ".player.json");
    fs.writeFileSync(out, `${JSON.stringify(flow, null, 2)}\n`);
    process.stdout.write(`Written: ${out} (${flow.steps.length} steps)\n`);
}

module.exports = { convert, convertDslWorkflow, convertTypebotExport };
