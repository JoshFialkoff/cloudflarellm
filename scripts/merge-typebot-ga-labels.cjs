#!/usr/bin/env node
/**
 * Attach gaLabel from Typebot export GA blocks to player steps (by block id).
 * Does not emit Typebot GA hits — labels are used for deduped GTM conversion_label.
 */
const fs = require("fs");
const path = require("path");

const [, , exportPath, playerPath] = process.argv;
if (!exportPath || !playerPath) {
    process.stderr.write(
        "Usage: node scripts/merge-typebot-ga-labels.cjs <export.json> <player.json>\n",
    );
    process.exit(1);
}

let raw = fs.readFileSync(path.resolve(exportPath), "utf8").trim();
if (raw.startsWith("n{")) raw = raw.slice(1);
const data = JSON.parse(raw);
const player = JSON.parse(fs.readFileSync(path.resolve(playerPath), "utf8"));

const gaByNextBlock = new Map();

for (const group of data.groups ?? []) {
    let pendingLabel = null;
    for (const block of group.blocks ?? []) {
        if (block.type === "Google Analytics") {
            const label =
                block.options?.label?.trim() ||
                block.options?.category?.trim() ||
                "";
            if (label) pendingLabel = label;
            continue;
        }
        const renderable =
            block.type === "choice input" ||
            block.type === "text input" ||
            block.type === "email input" ||
            block.type === "number input" ||
            block.type === "rating input";
        if (renderable && pendingLabel) {
            gaByNextBlock.set(block.id, pendingLabel);
            pendingLabel = null;
        }
    }
}

let merged = 0;
for (const step of player.steps ?? []) {
    const label = gaByNextBlock.get(step.id);
    if (label) {
        step.gaLabel = label;
        merged += 1;
    }
}

fs.writeFileSync(
    path.resolve(playerPath),
    `${JSON.stringify(player, null, 2)}\n`,
);
process.stdout.write(`Merged gaLabel onto ${merged} steps\n`);
