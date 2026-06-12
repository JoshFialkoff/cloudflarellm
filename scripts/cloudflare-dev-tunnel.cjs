#!/usr/bin/env node
/**
 * Quick public URL for testing on phone (Cloudflare Tunnel, no Cloudflare account).
 *
 * Prerequisite: install `cloudflared` CLI on this machine.
 * https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
 *
 * Usage:
 *   1) Start Next on PORT (default 3010): `npm run dev` or `npm run dev:simple`
 *   2) In another terminal: `npm run tunnel:dev`
 *   3) Open the printed https://….trycloudflare.com URL on your iPhone (Safari).
 */
const { spawn } = require("child_process");

const port = process.env.PORT || process.env.TUNNEL_UPSTREAM_PORT || "3010";
const upstream = `http://127.0.0.1:${port}`;

let printed = false;
const publicUrlRe = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\/?/gi;

function emitPublicUrl(chunk) {
    if (printed) return;
    const s = chunk.toString();
    const matches = s.match(publicUrlRe);
    if (!matches || !matches.length) return;
    const u = matches[matches.length - 1].replace(/\/$/, "");
    printed = true;
    process.stderr.write(`\n=== Public test URL (iPhone / remote) ===\n${u}\n\n`);
    process.stdout.write(`${u}\n`);
}

console.error(`[tunnel] Proxying → ${upstream}`);
console.error("[tunnel] Keep Next running on that port, then leave this process open.\n");

const child = spawn("cloudflared", ["tunnel", "--url", upstream], {
    stdio: ["inherit", "pipe", "pipe"],
});

function pipe(chunk) {
    process.stderr.write(chunk);
    emitPublicUrl(chunk);
}

child.stdout.on("data", pipe);
child.stderr.on("data", pipe);

child.on("error", (err) => {
    console.error(err.message);
    console.error(
        "\nInstall cloudflared, or use your OS package manager. See script header in scripts/cloudflare-dev-tunnel.cjs\n",
    );
    process.exit(1);
});

child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
});
