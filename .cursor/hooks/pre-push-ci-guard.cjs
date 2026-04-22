#!/usr/bin/env node
/*
 * Cursor hook: beforeShellExecution
 * Runs lint + build before `git push` to prevent broken CI for non-developer workflows.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  });
}

function jsonOut(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function run(command, args) {
  return spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    cwd: process.cwd(),
    env: process.env,
  });
}

(async () => {
  try {
    const raw = await readStdin();
    const payload = raw ? JSON.parse(raw) : {};
    const command = String(payload.command || "").trim();

    if (!/^git\s+push(\s|$)/.test(command)) {
      jsonOut({ permission: "allow" });
      return;
    }

    const sha = run("git", ["rev-parse", "HEAD"]);
    const headSha = (sha.stdout || "").trim();

    const cacheFile = path.join(process.cwd(), ".git", ".cursor-ci-ok-sha");
    if (headSha && fs.existsSync(cacheFile)) {
      const lastOk = fs.readFileSync(cacheFile, "utf8").trim();
      if (lastOk === headSha) {
        jsonOut({ permission: "allow" });
        return;
      }
    }

    const lint = run("npm", ["run", "lint"]);
    if (lint.status !== 0) {
      jsonOut({
        permission: "deny",
        user_message:
          "Push blocked: lint failed. Run `npm run lint`, fix issues, then push again.",
        agent_message: (lint.stderr || lint.stdout || "").slice(-1200),
      });
      return;
    }

    const build = run("npm", ["run", "build"]);
    if (build.status !== 0) {
      jsonOut({
        permission: "deny",
        user_message:
          "Push blocked: build failed. Run `npm run build`, fix issues, then push again.",
        agent_message: (build.stderr || build.stdout || "").slice(-1200),
      });
      return;
    }

    if (headSha) {
      fs.writeFileSync(cacheFile, `${headSha}\n`, "utf8");
    }

    jsonOut({
      permission: "allow",
      user_message: "Pre-push checks passed (lint + build).",
    });
  } catch (error) {
    jsonOut({
      permission: "deny",
      user_message: "Push blocked: pre-push CI hook failed unexpectedly.",
      agent_message: String(error && error.message ? error.message : error),
    });
  }
})();
