#!/usr/bin/env node
/**
 * Post organic social discovery leads to Discord (incoming webhook).
 *
 * Formats each lead like:
 *   Title line
 *   URL: …
 *   Pain point: …
 *   Strategy: …
 *
 * Required env:
 *   DISCORD_WEBHOOK_URL
 *
 * Optional env:
 *   ORGANIC_DISCORD_REPORT_PATH — explicit JSON report path
 *   ORGANIC_DISCORD_MAX_LEADS (default 5, max 8)
 *   ORGANIC_DISCORD_MESSAGE_DELAY_MS (default 600) between messages
 *
 * CLI:
 *   node scripts/send-organic-social-to-discord.cjs
 *   node scripts/send-organic-social-to-discord.cjs --report reports/organic-social-discovery-….json
 *   node scripts/send-organic-social-to-discord.cjs --stdin   (read one message; plain text)
 *   node scripts/send-organic-social-to-discord.cjs --text "Title\n\nURL: …"
 */
const fs = require("fs");
const path = require("path");

const { postDiscordWebhook, splitDiscordContent } = require("./lib/discord-webhook.cjs");
const { formatOrganicLeadBlock } = require("./lib/organic-discord-format.cjs");

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

function parseArgs(argv) {
    const out = { report: "", stdin: false, text: "" };
    for (let i = 2; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === "--report" && argv[i + 1]) {
            out.report = argv[i + 1];
            i += 1;
        } else if (a === "--stdin") {
            out.stdin = true;
        } else if (a === "--text" && argv[i + 1]) {
            out.text = argv[i + 1];
            i += 1;
        }
    }
    return out;
}

function readStdinUtf8() {
    return new Promise((resolve, reject) => {
        let data = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (c) => {
            data += c;
        });
        process.stdin.on("end", () => resolve(data));
        process.stdin.on("error", reject);
    });
}

function latestOrganicReportPath() {
    const reportsDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) return null;
    const files = fs
        .readdirSync(reportsDir)
        .filter((f) => f.startsWith("organic-social-discovery-") && f.endsWith(".json"))
        .map((f) => ({
            fullPath: path.join(reportsDir, f),
            mtimeMs: fs.statSync(path.join(reportsDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return files[0]?.fullPath || null;
}

function extractLeadsFromReport(report) {
    if (!report || typeof report !== "object") return [];
    if (Array.isArray(report.leads) && report.leads.length) return report.leads;
    const raw = report.raw_agent_response;
    const data = raw?.data;
    if (Array.isArray(data)) return data.filter((r) => r && r.url && r.title);
    if (data && typeof data === "object" && !Array.isArray(data)) {
        const keys = Object.keys(data).filter((k) => /^\d+$/.test(k));
        if (keys.length) {
            return keys
                .sort((a, b) => Number(a) - Number(b))
                .map((k) => data[k])
                .filter((r) => r && r.url && r.title);
        }
    }
    if (Array.isArray(data?.leads)) return data.leads.filter((r) => r && r.url && r.title);
    return [];
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function main() {
    loadDotEnvFile(path.join(process.cwd(), ".env.local"));
    loadDotEnvFile(path.join(process.cwd(), ".env"));

    const webhookUrl = String(process.env.DISCORD_WEBHOOK_URL || "").trim();
    if (!webhookUrl) {
        // eslint-disable-next-line no-console
        console.error("Missing DISCORD_WEBHOOK_URL");
        process.exit(1);
    }

    const args = parseArgs(process.argv);
    const delayMs = Math.max(
        0,
        Number.parseInt(process.env.ORGANIC_DISCORD_MESSAGE_DELAY_MS || "600", 10) || 0,
    );

    if (args.stdin) {
        const body = (await readStdinUtf8()).trim();
        if (!body) throw new Error("Stdin was empty.");
        for (const chunk of splitDiscordContent(body)) {
            // eslint-disable-next-line no-await-in-loop
            await postDiscordWebhook(webhookUrl, chunk);
        }
        // eslint-disable-next-line no-console
        console.log("Sent stdin message to Discord.");
        return;
    }

    if (args.text) {
        for (const chunk of splitDiscordContent(args.text)) {
            // eslint-disable-next-line no-await-in-loop
            await postDiscordWebhook(webhookUrl, chunk);
        }
        // eslint-disable-next-line no-console
        console.log("Sent --text payload to Discord.");
        return;
    }

    const reportPath =
        String(process.env.ORGANIC_DISCORD_REPORT_PATH || args.report || "").trim() ||
        latestOrganicReportPath();
    if (!reportPath || !fs.existsSync(reportPath)) {
        throw new Error(
            "No organic report found. Run `npm run social:organic:firecrawl` or pass --report PATH.",
        );
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    let leads = extractLeadsFromReport(report);
    const maxRaw = Number.parseInt(process.env.ORGANIC_DISCORD_MAX_LEADS || "5", 10);
    const maxLeads = Math.min(8, Math.max(1, Number.isFinite(maxRaw) ? maxRaw : 5));
    leads = leads.slice(0, maxLeads);

    if (!leads.length) {
        throw new Error(`No leads in report: ${reportPath}`);
    }

    const header = [
        "**Organic social discovery**",
        `Report: ${path.basename(reportPath)}`,
        `Generated: ${report.generated_at || "unknown"}`,
        "",
    ].join("\n");

    for (const chunk of splitDiscordContent(header)) {
        // eslint-disable-next-line no-await-in-loop
        await postDiscordWebhook(webhookUrl, chunk);
    }
    if (delayMs) await sleep(delayMs);

    for (let i = 0; i < leads.length; i += 1) {
        const block = formatOrganicLeadBlock(leads[i], i);
        for (const chunk of splitDiscordContent(block)) {
            // eslint-disable-next-line no-await-in-loop
            await postDiscordWebhook(webhookUrl, chunk);
        }
        if (delayMs && i < leads.length - 1) await sleep(delayMs);
    }

    // eslint-disable-next-line no-console
    console.log(`Sent ${leads.length} organic lead(s) to Discord from: ${reportPath}`);
}

main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e.message || e);
    process.exit(1);
});
