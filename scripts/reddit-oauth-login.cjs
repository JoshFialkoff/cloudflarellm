#!/usr/bin/env node
/**
 * One-shot Reddit OAuth2 (authorization code) for Ads API tokens.
 *
 * 1) In https://www.reddit.com/prefs/apps → your app → add this EXACT redirect URI:
 *    http://127.0.0.1:8765/reddit/callback
 *    (or set REDDIT_OAUTH_REDIRECT_URI to match what you registered)
 * 2) Put REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.local
 * 3) Run: npm run ads:reddit:oauth
 *    Debug: npm run ads:reddit:oauth -- --print-only
 *
 * Prints access_token + refresh_token; paste refresh_token into .env.local for scripts.
 */
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const { URL, URLSearchParams } = require("url");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { parseArgs } = require("node:util");

const DEFAULT_PORT = 8765;
const DEFAULT_PATH = "/reddit/callback";
const DEFAULT_SCOPE = "adsread";

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

function htmlPage(title, body) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;
}

function httpsPostForm(targetUrl, formBody, headers) {
    return new Promise((resolve, reject) => {
        const u = new URL(targetUrl);
        const req = https.request(
            {
                hostname: u.hostname,
                port: u.port || 443,
                path: `${u.pathname}${u.search || ""}`,
                method: "POST",
                headers: {
                    ...headers,
                    "Content-Length": Buffer.byteLength(formBody, "utf8"),
                },
            },
            (res) => {
                const chunks = [];
                res.on("data", (c) => chunks.push(c));
                res.on("end", () => {
                    const text = Buffer.concat(chunks).toString("utf8");
                    resolve({ status: res.statusCode || 0, text });
                });
            },
        );
        req.on("error", reject);
        req.write(formBody);
        req.end();
    });
}

async function exchangeCode({ clientId, clientSecret, code, redirectUri, userAgent }) {
    const cleanCode = String(code || "")
        .trim()
        .replace(/#.*$/, "");
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: cleanCode,
        redirect_uri: redirectUri,
    }).toString();

    const tokenUrl =
        (process.env.REDDIT_OAUTH_TOKEN_URL || "https://www.reddit.com/api/v1/access_token").trim();
    const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");

    const headers = {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": userAgent,
        Connection: "close",
    };

    const { status, text } = await httpsPostForm(tokenUrl, body, headers);

    if (status < 200 || status >= 300) {
        let msg = text.slice(0, 1200);
        try {
            const j = JSON.parse(text);
            if (j.error) msg = `${j.error}: ${j.error_description || j.message || ""}`;
        } catch {
            /* keep msg */
        }
        if (status === 403 && /cloudflare|cf-ray|blocked/i.test(text)) {
            msg += " (response looks like a Cloudflare/WAF block; try again from a normal home/office IP or VPN off.)";
        }
        // eslint-disable-next-line no-console
        console.error("\nReddit token HTTP body (truncated):\n", text.slice(0, 2000), "\n");
        throw new Error(`Token exchange failed (${status}): ${msg}`);
    }

    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`Token exchange returned non-JSON (${text.slice(0, 200)})`);
    }
    return data;
}

async function main() {
    loadDotEnvFile(path.join(process.cwd(), ".env.local"));
    loadDotEnvFile(path.join(process.cwd(), ".env"));

    const { values } = parseArgs({
        options: {
            port: { type: "string" },
            scope: { type: "string" },
            "no-open": { type: "boolean", default: false },
            "print-only": { type: "boolean", default: false },
        },
        allowPositionals: false,
    });

    const clientId = String(process.env.REDDIT_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.REDDIT_CLIENT_SECRET || "").trim();
    if (!clientId || !clientSecret) {
        throw new Error("Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.local");
    }

    const port = Number.parseInt(values.port || process.env.REDDIT_OAUTH_PORT || String(DEFAULT_PORT), 10);
    const callbackPath = (process.env.REDDIT_OAUTH_CALLBACK_PATH || DEFAULT_PATH).trim();
    const redirectUri = String(
        process.env.REDDIT_OAUTH_REDIRECT_URI || `http://127.0.0.1:${port}${callbackPath}`,
    ).trim();
    const scope = values.scope || process.env.REDDIT_OAUTH_SCOPE || DEFAULT_SCOPE;
    const userAgent =
        process.env.REDDIT_USER_AGENT ||
        "cursor-ads-oauth/1.0 by /u/REDDIT_USERNAME (contact: CONTACT_URL)";

    const state = crypto.randomBytes(16).toString("hex");

    const authorize = new URL("https://www.reddit.com/api/v1/authorize");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("duration", "permanent");
    authorize.searchParams.set("scope", scope);

    const authorizeStr = authorize.toString();

    if (values["print-only"]) {
        // eslint-disable-next-line no-console
        console.log("\n--- Reddit OAuth config (what Reddit will validate) ---\n");
        // eslint-disable-next-line no-console
        console.log(`REDDIT_CLIENT_ID=${clientId}`);
        // eslint-disable-next-line no-console
        console.log(
            `REDDIT_CLIENT_SECRET=${clientSecret ? `${clientSecret.slice(0, 3)}…(${clientSecret.length} chars)` : "(empty)"}`,
        );
        // eslint-disable-next-line no-console
        console.log(`redirect_uri (must match prefs/apps for THIS client_id exactly):\n  ${redirectUri}`);
        // eslint-disable-next-line no-console
        console.log(`\nAuthorize URL (example):\n  ${authorizeStr}\n`);
        // eslint-disable-next-line no-console
        console.log(
            "If Reddit says invalid redirect_uri: the redirect is tied to the app for THIS client_id.\n" +
                "Open prefs/apps and confirm the app card under this id lists that exact redirect.\n" +
                "Authorization code flow needs a **web app** (not a **script** app); create a new web app if unsure.\n",
        );
        return;
    }

    /** Chrome -102 = connection refused: nothing was listening when Reddit redirected. */
    let oauthResolve;
    let oauthReject;
    const oauthPromise = new Promise((resolve, reject) => {
        oauthResolve = resolve;
        oauthReject = reject;
    });

    const server = http.createServer(async (req, res) => {
        try {
            /* Browsers do not send #fragment to the server; strip defensively if a proxy ever does. */
            const rawUrl = String(req.url || "").split("#")[0];
            if (!rawUrl.startsWith(callbackPath)) {
                res.writeHead(404);
                res.end("Not found");
                return;
            }
            const remote = req.socket.remoteAddress || "";
            if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") {
                res.writeHead(403);
                res.end(htmlPage("Blocked", "<p>Use only from this computer (127.0.0.1).</p>"));
                return;
            }

            const u = new URL(rawUrl, `http://127.0.0.1:${port}`);
            const err = u.searchParams.get("error");
            if (err) {
                res.writeHead(400);
                res.end(
                    htmlPage(
                        "Reddit OAuth error",
                        `<p><strong>${err}</strong></p><p>${u.searchParams.get("error_description") || ""}</p>`,
                    ),
                    () => {
                        server.close();
                        oauthReject(new Error(`OAuth error: ${err}`));
                    },
                );
                return;
            }

            const code = u.searchParams.get("code");
            const returnedState = u.searchParams.get("state");
            if (!code || returnedState !== state) {
                res.writeHead(400);
                res.end(htmlPage("Bad callback", "<p>Missing code or state mismatch.</p>"), () => {
                    server.close();
                    oauthReject(new Error("Missing code or state mismatch"));
                });
                return;
            }

            const tokenJson = await exchangeCode({
                clientId,
                clientSecret,
                code,
                redirectUri,
                userAgent,
            });

            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(
                htmlPage(
                    "Success",
                    "<p>Tokens received. You can close this tab and return to the terminal.</p>",
                ),
                () => {
                    server.close();
                    // eslint-disable-next-line no-console
                    console.log("\n--- Tokens (add to .env.local; do not commit) ---\n");
                    // eslint-disable-next-line no-console
                    console.log(`REDDIT_REFRESH_TOKEN=${tokenJson.refresh_token || ""}`);
                    // eslint-disable-next-line no-console
                    console.log(`REDDIT_ADS_ACCESS_TOKEN=${tokenJson.access_token || ""}`);
                    // eslint-disable-next-line no-console
                    console.log(`# expires_in (seconds): ${tokenJson.expires_in ?? "n/a"}`);
                    // eslint-disable-next-line no-console
                    console.log("\nNext: npm run ads:reddit:discover\n");
                    oauthResolve();
                },
            );
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error("\nOAuth callback error:\n", e.message || e, "\n");
            try {
                if (!res.headersSent) {
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                }
                res.end(
                    htmlPage(
                        "Token exchange failed",
                        `<p><strong>${String(e.message || e)}</strong></p><p>See terminal for details. Run <code>npm run ads:reddit:oauth</code> again (codes are one-time).</p>`,
                    ),
                    () => {
                        server.close();
                        oauthReject(e);
                    },
                );
            } catch {
                server.close();
                oauthReject(e);
            }
        }
    });

    const listenPromise = new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });

    const timeoutMs = 5 * 60 * 1000;
    const timeoutId = setTimeout(() => {
        server.close();
        oauthReject(new Error("Timed out waiting for OAuth callback (5 min)"));
    }, timeoutMs);

    try {
        await listenPromise;
        // eslint-disable-next-line no-console
        console.log("\n1) In Reddit app settings, this redirect URI must exist EXACTLY:\n");
        // eslint-disable-next-line no-console
        console.log(`   ${redirectUri}\n`);
        // eslint-disable-next-line no-console
        console.log("2) Local server is ready. Open this link (browser may open automatically):\n");
        // eslint-disable-next-line no-console
        console.log(`   ${authorizeStr}\n`);
        // eslint-disable-next-line no-console
        console.log(`   (Listening on http://127.0.0.1:${port}${callbackPath})\n`);

        if (!values["no-open"] && process.platform === "darwin") {
            spawnSync("open", [authorizeStr], { stdio: "ignore" });
        }

        await oauthPromise;
    } finally {
        clearTimeout(timeoutId);
    }
}

main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e.message || e);
    process.exit(1);
});
