const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

/** Static curated fallback resources shown when Firecrawl CLI is unavailable. */
const FALLBACK_RESOURCES = [
    {
        title: "MassHealth — Executive Office of Health and Human Services",
        url: "https://www.mass.gov/masshealth",
        description:
            "Apply for MassHealth (Massachusetts Medicaid) and learn about the Frail Elder Waiver, Group Adult Foster Care, and PACE programs that may cover assisted living or memory care costs.",
    },
    {
        title: "SHINE Program — Free Medicare/Medicaid Counseling",
        url: "https://www.mass.gov/shine-serving-health-insurance-needs-of-everyone",
        description:
            "SHINE provides free, unbiased health insurance counseling for Medicare and Medicaid beneficiaries in Massachusetts. Call 1-800-243-4636 to reach your local SHINE counselor.",
    },
    {
        title: "Aging Services Access Points (ASAPs) — MassOptions",
        url: "https://www.massoptions.org",
        description:
            "ASAPs are the entry point for Massachusetts elder-care programs. Request a needs assessment to learn which state-funded home and community services may apply.",
    },
    {
        title: "Veterans Aid & Attendance Pension Benefit — VA.gov",
        url: "https://www.va.gov/pension/aid-attendance-housebound/",
        description:
            "Veterans or surviving spouses who need help with daily activities may qualify for Aid & Attendance, providing $1,000–$2,300/month toward assisted living costs.",
    },
    {
        title: "Alzheimer's Association — MA Chapter Care Consultation",
        url: "https://www.alz.org/manh",
        description:
            "Free care consultations, respite grants, and support groups for families caring for someone with Alzheimer's or dementia in Massachusetts.",
    },
    {
        title: "Council on Aging — Massachusetts Executive Office of Elder Affairs",
        url: "https://www.mass.gov/local-councils-on-aging",
        description:
            "Local Councils on Aging connect families with town-level elder services, transportation, respite, caregiver support, and referrals to state programs.",
    },
];

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getCacheKey(region, careType, massHealth, veteran) {
    return `lcr-${region}-${careType}-${massHealth}-${veteran}`.replace(/[^a-z0-9-]/gi, "_");
}

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

function readCache(cacheFile) {
    try {
        if (!fs.existsSync(cacheFile)) return null;
        const stat = fs.statSync(cacheFile);
        if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
        return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    } catch {
        return null;
    }
}

function writeCache(cacheFile, data) {
    try {
        fs.writeFileSync(cacheFile, JSON.stringify(data), "utf8");
    } catch {
        /* non-fatal */
    }
}

export default function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    const region = safeQueryPart(req.body?.region, "Massachusetts");
    const careType = safeQueryPart(req.body?.careType, "assisted living");
    const massHealth = safeQueryPart(req.body?.massHealth, "unknown");
    const veteran = safeQueryPart(req.body?.veteran, "unknown");

    const cacheDir = path.join(os.tmpdir(), "assistedly-resource-cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    const cacheFile = path.join(cacheDir, `${getCacheKey(region, careType, massHealth, veteran)}.json`);

    // Serve from cache if fresh
    const cached = readCache(cacheFile);
    if (cached) {
        return res.status(200).json({ ...cached, from_cache: true });
    }

    const bin = resolveFirecrawlBinary();
    if (!bin) {
        // No CLI — return curated static resources, cache them
        const response = {
            available: false,
            from_fallback: true,
            results: FALLBACK_RESOURCES,
            query: `Massachusetts ${region} ${careType} elder care funding programs`,
        };
        writeCache(cacheFile, response);
        return res.status(200).json(response);
    }

    const query = [
        "Massachusetts",
        region,
        careType,
        "MassHealth Frail Elder Waiver Group Adult Foster Care PACE SHINE ASAP Council on Aging veterans respite Alzheimer's nonprofit assisted living help",
    ].join(" ");

    const outDir = path.join(os.tmpdir(), "assistedly-firecrawl");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `lower-cost-resources-${Date.now().toString(36)}.json`);

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

    // Fall back to curated resources if Firecrawl returned nothing
    if (!results.length) {
        results = FALLBACK_RESOURCES;
    }

    const response = {
        available: r.status === 0,
        query,
        results,
        error: r.status === 0 ? "" : (r.stderr || r.stdout || "").slice(-400),
    };
    writeCache(cacheFile, response);
    return res.status(200).json(response);
}
