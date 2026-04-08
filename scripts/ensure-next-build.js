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
            "\n\nRun `npm run build` in the same environment (and image) as `npm start`,\n" +
            "and deploy the full `.next` directory (not only BUILD_ID or static chunks).\n" +
            "In Easypanel: build must finish successfully before the app starts.\n",
    );
    process.exit(1);
}
