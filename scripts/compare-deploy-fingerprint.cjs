#!/usr/bin/env node
/**
 * Runtime evidence: local `.next/BUILD_ID` vs remote `/api/deploy-fingerprint`.
 * Appends NDJSON lines to `.cursor/debug-e53050.log` (debug session).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const logPath = path.join(root, ".cursor", "debug-e53050.log");

function append(obj) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${JSON.stringify(obj)}\n`);
}

const prodBase = process.argv[2] || "https://aiassistliving.com";
const localBuildPath = path.join(root, ".next", "BUILD_ID");
let localBuildId = null;
if (fs.existsSync(localBuildPath)) {
    localBuildId = fs.readFileSync(localBuildPath, "utf8").trim();
}

append({
    sessionId: "e53050",
    hypothesisId: "H_local_build",
    location: "scripts/compare-deploy-fingerprint.cjs",
    message: "Local .next/BUILD_ID",
    data: { localBuildId, root },
    timestamp: Date.now(),
    runId: "compare",
});

const url = new URL("/api/deploy-fingerprint", prodBase).href;

(async () => {
    let remote = { error: "fetch_failed", status: null };
    try {
        const res = await fetch(url, { redirect: "follow" });
        const body = await res.json().catch(() => null);
        remote = {
            status: res.status,
            ...(body && typeof body === "object" ? body : { parseError: true }),
        };
    } catch (e) {
        remote = { error: String(e?.message || e), status: null };
    }

    append({
        sessionId: "e53050",
        hypothesisId: "H_remote_api",
        location: "scripts/compare-deploy-fingerprint.cjs",
        message: "Remote /api/deploy-fingerprint",
        data: { url, ...remote },
        timestamp: Date.now(),
        runId: "compare",
    });

    let remoteBuildFromHtml = null;
    if (!remote.buildId) {
        const homeUrl = new URL("/", prodBase).href;
        try {
            const hres = await fetch(homeUrl, { redirect: "follow" });
            const html = await hres.text();
            const m = html.match(/"buildId":"([^"]+)"/);
            remoteBuildFromHtml = m ? m[1] : null;
        } catch (e) {
            remoteBuildFromHtml = `err:${String(e?.message || e)}`;
        }
        append({
            sessionId: "e53050",
            hypothesisId: "H_remote_html_scrape",
            location: "scripts/compare-deploy-fingerprint.cjs",
            message: "Remote homepage __NEXT_DATA__ buildId",
            data: { homeUrl, remoteBuildFromHtml },
            timestamp: Date.now(),
            runId: "compare",
        });
    }

    const effectiveRemote =
        remote.buildId ||
        (typeof remoteBuildFromHtml === "string" && !remoteBuildFromHtml.startsWith("err")
            ? remoteBuildFromHtml
            : null);

    // eslint-disable-next-line no-console -- CLI output for operator
    console.log("Local BUILD_ID: ", localBuildId || "(run npm run build first)");
    // eslint-disable-next-line no-console
    console.log(
        "Remote BUILD_ID:",
        remote.buildId || effectiveRemote || remote.error || "(unknown)",
    );
    // eslint-disable-next-line no-console
    console.log(
        "Match:",
        localBuildId && effectiveRemote
            ? localBuildId === effectiveRemote
            : "unknown",
    );
})();
