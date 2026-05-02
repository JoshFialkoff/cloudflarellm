const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

function resolveFirecrawlBinary() {
    const custom = String(process.env.FIRECRAWL_CLI_BIN || "").trim();
    if (custom) return custom;
    try {
        return execFileSync("which", ["firecrawl"], { encoding: "utf8" }).trim();
    } catch {
        return "";
    }
}

function safeQueryPart(value, fallback = "") {
    return String(value || fallback)
        .replace(/[^\w\s/-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
}

function normalizeResults(raw) {
    const data = Array.isArray(raw) ? raw : raw?.data || raw?.results || raw?.web || [];
    if (!Array.isArray(data)) return [];
    return data
        .map((item) => ({
            title: String(item.title || item.name || item.url || "").trim(),
            url: String(item.url || item.link || "").trim(),
            description: String(item.description || item.snippet || item.markdown || "").trim(),
        }))
        .filter((item) => item.title && item.url)
        .slice(0, 6);
}

export default function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    const bin = resolveFirecrawlBinary();
    if (!bin) {
        res.status(200).json({
            available: false,
            reason: "firecrawl CLI not on PATH",
            setup_hint:
                "Install/login with the Firecrawl Cursor plugin CLI, or set FIRECRAWL_CLI_BIN.",
            results: [],
        });
        return;
    }

    const region = safeQueryPart(req.body?.region, "Massachusetts");
    const careType = safeQueryPart(req.body?.care_type, "assisted living");
    const query = [
        "Massachusetts",
        region,
        careType,
        "MassHealth Frail Elder Waiver Group Adult Foster Care PACE SHINE ASAP Council on Aging veterans respite Alzheimer's nonprofit assisted living help",
    ].join(" ");
    const outDir = path.join(os.tmpdir(), "assistedly-firecrawl");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(
        outDir,
        `lower-cost-resources-${Date.now().toString(36)}.json`,
    );

    const r = spawnSync(bin, ["search", query, "--limit", "6", "-o", outFile, "--json"], {
        encoding: "utf8",
        env: process.env,
        timeout: 90_000,
        maxBuffer: 8 * 1024 * 1024,
    });

    let results = [];
    try {
        if (fs.existsSync(outFile)) {
            results = normalizeResults(JSON.parse(fs.readFileSync(outFile, "utf8")));
        }
    } catch {
        results = [];
    }

    res.status(200).json({
        available: r.status === 0,
        query,
        results,
        error: r.status === 0 ? "" : (r.stderr || r.stdout || "Firecrawl search failed").slice(-800),
    });
}
