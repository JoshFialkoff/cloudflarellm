/**
 * Bridges scheduled engagement scripts with the Firecrawl Cursor plugin workflow:
 * global `firecrawl` CLI (see plugin skills/firecrawl/SKILL.md — search, scrape, --status).
 *
 * Env:
 *   FIRECRAWL_PLUGIN_CLI — default on; set 0/false to skip CLI integration
 *   FIRECRAWL_CLI_BIN — optional explicit path to `firecrawl` executable
 *   FIRECRAWL_PLUGIN_CLI_SEARCH — set 1/true to run one complementary `firecrawl search` after the agent
 *   FIRECRAWL_PLUGIN_CLI_SEARCH_QUERY — override default Reddit/MA care query
 */
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

function pluginCliEnabled() {
    return !/^(0|false|no)$/i.test(String(process.env.FIRECRAWL_PLUGIN_CLI || "1").trim());
}

function pluginSearchEnabled() {
    return /^(1|true|yes)$/i.test(String(process.env.FIRECRAWL_PLUGIN_CLI_SEARCH || "").trim());
}

function resolveFirecrawlBinary() {
    const custom = String(process.env.FIRECRAWL_CLI_BIN || "").trim();
    if (custom) return custom;
    try {
        const p = execFileSync("which", ["firecrawl"], { encoding: "utf8" }).trim();
        return p || null;
    } catch {
        return null;
    }
}

function ensureDotFirecrawl(cwd) {
    const dir = path.join(cwd, ".firecrawl");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * @param {string} cwd
 * @returns {{ skipped: boolean, reason?: string, setup_hint?: string, binary?: string, status?: Record<string, unknown> }}
 */
function maybeRunFirecrawlPluginBeforeAgent(cwd) {
    if (!pluginCliEnabled()) {
        return { skipped: true, reason: "FIRECRAWL_PLUGIN_CLI disabled" };
    }
    const bin = resolveFirecrawlBinary();
    if (!bin) {
        return {
            skipped: true,
            reason: "firecrawl CLI not on PATH",
            setup_hint:
                "npm install -g firecrawl-cli && firecrawl login --browser (Firecrawl Cursor plugin; same API key as FIRECRAWL_API_KEY)",
        };
    }
    const r = spawnSync(bin, ["--status"], {
        encoding: "utf8",
        env: process.env,
        timeout: 25_000,
        maxBuffer: 2 * 1024 * 1024,
    });
    const status = {
        command: [bin, "--status"],
        exit_code: r.status,
        stdout: (r.stdout || "").trim(),
        stderr: (r.stderr || "").trim(),
        spawn_error: r.error ? String(r.error.message) : null,
    };
    try {
        const fcDir = ensureDotFirecrawl(cwd);
        const summary = [
            `Time: ${new Date().toISOString()}`,
            ...status.command,
            `Exit: ${status.exit_code}`,
            status.stdout || status.stderr || "(no output)",
            "",
        ].join("\n");
        fs.writeFileSync(path.join(fcDir, "last-cli-status.txt"), summary, "utf8");
    } catch {
        /* non-fatal */
    }
    return { skipped: false, binary: bin, status };
}

/**
 * @param {string} cwd
 * @param {string} stamp — filename-safe ISO fragment
 * @returns {{ skipped: boolean, reason?: string, output_path?: string, exit_code?: number|null, stderr_tail?: string }}
 */
function maybeRunFirecrawlPluginSearchAfterAgent(cwd, stamp) {
    if (!pluginSearchEnabled()) {
        return { skipped: true, reason: "FIRECRAWL_PLUGIN_CLI_SEARCH not enabled" };
    }
    const bin = resolveFirecrawlBinary();
    if (!bin) {
        return { skipped: true, reason: "firecrawl CLI not on PATH" };
    }
    const fcDir = ensureDotFirecrawl(cwd);
    const outFile = path.join(fcDir, `engagement-search-${stamp}.json`);
    const query = String(
        process.env.FIRECRAWL_PLUGIN_CLI_SEARCH_QUERY ||
            'site:reddit.com (assisted living OR memory care OR "aging parent") (massachusetts OR MA OR boston)',
    ).trim();
    const r = spawnSync(
        bin,
        ["search", query, "--limit", "8", "-o", outFile, "--json"],
        {
            encoding: "utf8",
            env: process.env,
            timeout: 120_000,
            maxBuffer: 10 * 1024 * 1024,
        },
    );
    return {
        skipped: false,
        query,
        output_path: outFile,
        exit_code: r.status,
        stderr_tail: (r.stderr || "").slice(-800),
        spawn_error: r.error ? String(r.error.message) : null,
    };
}

/**
 * @param {{ pre_agent?: Record<string, unknown>, post_agent_search?: Record<string, unknown> }} bundle
 * @returns {string}
 */
function formatPluginMarkdown(bundle) {
    if (!bundle) return "";
    const lines = ["", "## Firecrawl plugin (CLI)", ""];
    const pre = bundle.pre_agent;
    if (pre?.skipped) {
        lines.push(`- **CLI status:** skipped — ${pre.reason || "unknown"}`);
        if (pre.setup_hint) lines.push(`- **Setup:** ${pre.setup_hint}`);
    } else if (pre?.status) {
        lines.push(`- **CLI:** \`${pre.binary}\` \`--status\` exit ${pre.status.exit_code}`);
        const out = pre.status.stdout || pre.status.stderr || "";
        lines.push("```text");
        lines.push(out.slice(0, 2500) || "(no output)");
        lines.push("```");
    }
    const post = bundle.post_agent_search;
    if (post?.skipped) {
        lines.push(`- **CLI search (optional):** ${post.reason || "skipped"}`);
    } else if (post && !post.skipped) {
        lines.push(`- **CLI search:** query saved; exit ${post.exit_code}`);
        if (post.output_path) lines.push(`- **Output:** \`${post.output_path}\``);
        if (post.stderr_tail) {
            lines.push("- **Stderr (tail):**");
            lines.push("```text");
            lines.push(post.stderr_tail);
            lines.push("```");
        }
    }
    lines.push("");
    return lines.join("\n");
}

module.exports = {
    maybeRunFirecrawlPluginBeforeAgent,
    maybeRunFirecrawlPluginSearchAfterAgent,
    formatPluginMarkdown,
    pluginCliEnabled,
    resolveFirecrawlBinary,
};
