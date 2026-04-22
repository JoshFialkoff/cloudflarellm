import fs from "fs";
import path from "path";

/**
 * GET — returns Next.js BUILD_ID from the running container (no secrets).
 * Use with `npm run fingerprint:compare` to prove prod vs local drift.
 */
export default function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const root = process.cwd();
    let buildId = null;
    try {
        buildId = fs
            .readFileSync(path.join(root, ".next", "BUILD_ID"), "utf8")
            .trim();
    } catch {
        buildId = null;
    }

    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({
        buildId,
        nodeEnv: process.env.NODE_ENV ?? null,
        commitHint:
            process.env.SOURCE_COMMIT ||
            process.env.GIT_COMMIT ||
            process.env.GITHUB_SHA ||
            process.env.VERCEL_GIT_COMMIT_SHA ||
            null,
    });
}
