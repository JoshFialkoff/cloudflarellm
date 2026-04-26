#!/usr/bin/env node
/**
 * Reddit optimizer approval loop:
 * 1) posts approval request to Discord channel
 * 2) monitors channel for YES/NO reply
 * 3) executes plan/apply action
 *
 * Required env:
 * - DISCORD_WEBHOOK_URL
 * - DISCORD_BOT_TOKEN
 * - DISCORD_APPROVAL_CHANNEL_ID
 *
 * Optional env:
 * - REDDIT_APPROVAL_TIMEOUT_SEC (default 1800)
 * - REDDIT_APPROVAL_POLL_SEC (default 10)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

async function postWebhook(content) {
    const webhook = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
    if (!webhook) throw new Error("DISCORD_WEBHOOK_URL missing.");
    const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Discord webhook failed (${res.status}): ${body.slice(0, 250)}`);
    }
}

async function fetchChannelMessages(limit = 25) {
    const token = String(process.env.DISCORD_BOT_TOKEN || "").trim();
    const channelId = await resolveApprovalChannelId();
    if (!token) throw new Error("DISCORD_BOT_TOKEN missing.");
    const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
        },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Discord API messages failed (${res.status}): ${body.slice(0, 250)}`);
    }
    const json = await res.json();
    return Array.isArray(json) ? json : [];
}

async function resolveApprovalChannelId() {
    const explicit = String(process.env.DISCORD_APPROVAL_CHANNEL_ID || "").trim();
    if (/^\d+$/.test(explicit)) return explicit;

    const webhook = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
    if (!webhook) {
        throw new Error("DISCORD_APPROVAL_CHANNEL_ID missing and DISCORD_WEBHOOK_URL missing.");
    }

    // Try webhook metadata endpoint; this returns channel_id for the webhook target.
    const res = await fetch(webhook, { method: "GET" });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(
            `Unable to resolve approval channel id from webhook (${res.status}): ${body.slice(0, 200)}`,
        );
    }
    const json = await res.json();
    const channelId = String(json?.channel_id || "").trim();
    if (!/^\d+$/.test(channelId)) {
        throw new Error("Resolved webhook channel_id is invalid.");
    }
    return channelId;
}

function getLatestOptimizerReport() {
    const reportsDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) return null;
    const files = fs
        .readdirSync(reportsDir)
        .filter((f) => f.startsWith("reddit-structure-optimizer-") && f.endsWith(".json"))
        .map((f) => ({
            name: f,
            fullPath: path.join(reportsDir, f),
            mtimeMs: fs.statSync(path.join(reportsDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return files[0] || null;
}

function buildApprovalMessage(reportPath, reportData, approvalId) {
    const execInfo = reportData.execution || {};
    const mode = execInfo.mode || "plan";
    const results = execInfo.remediationResults || [];
    const plannedPause = results.filter((r) => r.type === "pause_empty_ad_group").length;
    const manual = results.filter((r) => r.type === "manual_restructure_required").length;
    const topAds = (reportData.topAds || []).slice(0, 3);
    const lines = [
        "Reddit Structure Optimizer Approval Request",
        `Approval ID: ${approvalId}`,
        `Report: ${path.basename(reportPath)}`,
        `Mode run: ${mode}`,
        `Empty ad groups eligible to auto-pause: ${plannedPause}`,
        `Manual restructure items: ${manual}`,
        "",
        "Top benchmark winners:",
    ];
    for (let i = 0; i < topAds.length; i += 1) {
        const ad = topAds[i];
        lines.push(
            `- #${i + 1} ${ad.name || "(unnamed)"} | CTR ${((ad.ctr || 0) * 100).toFixed(3)}% | CPC $${Number(ad.cpcUsd || 0).toFixed(2)}`,
        );
    }
    lines.push(
        "",
        `Reply with: ${approvalId} YES  (to run --apply)`,
        `Reply with: ${approvalId} NO   (to keep plan-only)`,
    );
    return lines.join("\n");
}

function parseApproval(messages, approvalId) {
    const idUpper = approvalId.toUpperCase();
    for (const m of messages) {
        const content = String(m?.content || "").trim().toUpperCase();
        if (!content.includes(idUpper)) continue;
        if (content.includes(" YES")) return { decision: "YES", author: m.author?.username || "unknown" };
        if (content.includes(" NO")) return { decision: "NO", author: m.author?.username || "unknown" };
    }
    return null;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    loadDotEnvFile(path.join(process.cwd(), ".env.local"));
    loadDotEnvFile(path.join(process.cwd(), ".env"));

    const latest = getLatestOptimizerReport();
    if (!latest) {
        throw new Error("No reddit optimizer report found in reports/.");
    }
    const data = JSON.parse(fs.readFileSync(latest.fullPath, "utf8"));
    const approvalId = `RAO-${Date.now().toString(36).toUpperCase()}`;
    const message = buildApprovalMessage(latest.fullPath, data, approvalId);
    await postWebhook(message);
    // eslint-disable-next-line no-console
    console.log(`Posted approval request with id ${approvalId}`);

    const timeoutSec = Number.parseInt(process.env.REDDIT_APPROVAL_TIMEOUT_SEC || "1800", 10);
    const pollSec = Number.parseInt(process.env.REDDIT_APPROVAL_POLL_SEC || "10", 10);
    const deadline = Date.now() + timeoutSec * 1000;

    while (Date.now() < deadline) {
        const messages = await fetchChannelMessages(30);
        const parsed = parseApproval(messages, approvalId);
        if (parsed) {
            // eslint-disable-next-line no-console
            console.log(`Received ${parsed.decision} from ${parsed.author}`);
            if (parsed.decision === "YES") {
                execSync('node "scripts/reddit-structure-optimizer-agent.cjs" --apply', {
                    stdio: "inherit",
                });
                await postWebhook(
                    `Approval ${approvalId}: applied. Executed reddit optimizer with --apply.`,
                );
            } else {
                await postWebhook(
                    `Approval ${approvalId}: held. No mutations applied (plan-only).`,
                );
            }
            return;
        }
        await sleep(pollSec * 1000);
    }

    await postWebhook(
        `Approval ${approvalId}: timeout after ${timeoutSec}s. No apply action taken.`,
    );
    // eslint-disable-next-line no-console
    console.log("Approval timeout, exiting without apply.");
}

main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error.message || error);
    process.exit(1);
});
