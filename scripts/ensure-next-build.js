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
];

const missing = required.filter((p) => !fs.existsSync(p));
if (missing.length > 0) {
    console.error(
        "\n[ensure-next-build] Missing Next.js production build output.\n" +
            "Run:  npm run build\n" +
            "Then: npm start\n" +
            "In Easypanel, ensure the Build command includes `npm run build`.\n",
    );
    process.exit(1);
}
