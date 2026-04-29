/**
 * Fail fast if `next start` would run without a completed `next build`.
 * Easypanel/Docker must run `npm run build` before `npm start`.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const required = [
    path.join(root, ".next", "build-manifest.json"),
    path.join(root, ".next", "BUILD_ID"),
    // Homepage is prerendered in this app; missing file causes ENOENT on "/".
    path.join(root, ".next", "server", "pages", "index.html"),
    // Prerendered error pages; missing files cause runtime ENOENT when serving /404
    path.join(root, ".next", "server", "pages", "404.html"),
    path.join(root, ".next", "server", "pages", "500.html"),
];

const missing = required.filter((p) => !fs.existsSync(p));
if (missing.length > 0) {
    console.error(
        "\n[ensure-next-build] Missing Next.js production build output.\n" +
            "Missing:\n" +
            missing.map((p) => `  - ${path.relative(root, p)}`).join("\n") +
            "\n\nRun `npm run build` in the same environment (and working directory) as start,\n" +
            "and deploy the full `.next` directory (not only BUILD_ID or static chunks).\n" +
            "Easypanel / process managers: use start command `npm start`, not `next start` alone\n" +
            "(otherwise this check never runs and you get ENOENT on 404.html at runtime).\n" +
            "In Docker: run build in the same image or copy `.next` from the build stage into `/code`.\n",
    );
    process.exit(1);
}
