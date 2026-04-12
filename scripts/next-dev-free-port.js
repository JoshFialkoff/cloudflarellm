#!/usr/bin/env node
/**
 * Picks the first free TCP port from PORT (default 3010) upward, then runs `next dev`.
 * Default avoids 3000: on this Easypanel host, 3000 is the panel, not this app.
 * Set PORT explicitly to override (e.g. PORT=3002 npm run dev).
 */
const net = require("net");
const { spawn } = require("child_process");
const path = require("path");

const host = "0.0.0.0";
const base = Number.parseInt(process.env.PORT || "3010", 10) || 3010;
const span = 50;

function portFree(port) {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.once("error", (err) => {
            if (err.code === "EADDRINUSE") resolve(false);
            else reject(err);
        });
        s.listen(port, host, () => {
            s.close(() => resolve(true));
        });
    });
}

async function main() {
    let chosen;
    for (let p = base; p < base + span; p += 1) {
        if (await portFree(p)) {
            chosen = p;
            break;
        }
    }
    if (chosen == null) {
        console.error(
            `No free port between ${base} and ${base + span - 1}. Set PORT to an open port.`,
        );
        process.exit(1);
    }
    const localhost = host.replace("0.0.0.0", "localhost");
    const appUrl = `http://${localhost}:${chosen}/`;
    if (chosen !== base) {
        console.error(`[dev] ${base} in use — using ${appUrl}`);
    }
    console.error(`[dev] Test this URL (after "Ready"): ${appUrl}`);

    const nextCli = require.resolve("next/dist/bin/next");
    const child = spawn(process.execPath, [nextCli, "dev", "-p", String(chosen), "-H", host], {
        stdio: "inherit",
        cwd: path.join(__dirname, ".."),
        env: process.env,
    });
    child.on("exit", (code, signal) => {
        if (signal) process.kill(process.pid, signal);
        process.exit(code == null ? 0 : code);
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
