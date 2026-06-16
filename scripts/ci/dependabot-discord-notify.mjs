#!/usr/bin/env node
/**
 * Check for open Dependabot PRs and post a summary to Discord.
 *
 * Env:
 *   GITHUB_TOKEN                       — GitHub token with repo read access (provided by Actions)
 *   GITHUB_REPOSITORY                  — owner/repo (provided by Actions)
 *   DISCORD_DEPENDABOT_WEBHOOK_URL     — preferred webhook for dependency update notifications
 *   DISCORD_GITHUB_UPDATES_WEBHOOK_URL — fallback webhook
 *   DISCORD_DEPLOY_WEBHOOK_URL         — legacy fallback
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { postDiscordWebhook, splitDiscordContent } = require("../lib/discord-webhook.cjs");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const REPO = process.env.GITHUB_REPOSITORY || "";

const webhook =
  process.env.DISCORD_DEPENDABOT_WEBHOOK_URL?.trim() ||
  process.env.DISCORD_GITHUB_UPDATES_WEBHOOK_URL?.trim() ||
  process.env.DISCORD_DEPLOY_WEBHOOK_URL?.trim() ||
  "";

/**
 * @param {string} path
 * @returns {Promise<unknown>}
 */
async function githubApi(path) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: {
      Authorization: "Bearer " + GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status} for ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  if (!webhook) {
    process.stderr.write(
      "No Discord webhook configured. Set DISCORD_DEPENDABOT_WEBHOOK_URL, " +
        "DISCORD_GITHUB_UPDATES_WEBHOOK_URL, or DISCORD_DEPLOY_WEBHOOK_URL.\n"
    );
    process.exit(0);
  }

  if (!GITHUB_TOKEN) {
    process.stderr.write("GITHUB_TOKEN is required.\n");
    process.exit(1);
  }

  if (!REPO) {
    process.stderr.write("GITHUB_REPOSITORY is required (e.g. owner/repo).\n");
    process.exit(1);
  }

  /** @type {Array<{number: number, title: string, html_url: string, user: {login: string}}>} */
  const prs = /** @type {any} */ (await githubApi("/pulls?state=open&per_page=100&sort=created&direction=asc"));

  const dependabotPRs = prs.filter(
    /** @param {{ user: { login: string } }} pr */
    (pr) =>
      pr.user?.login === "dependabot[bot]" ||
      (pr.user?.login?.startsWith("dependabot") && pr.user?.type === "Bot")
  );

  const repoUrl = `https://github.com/${REPO}`;
  const now = new Date().toISOString().slice(0, 10);

  if (dependabotPRs.length === 0) {
    const msg =
      `🟢 **Dependency updates** (${now})\n` +
      `No open Dependabot PRs — all dependencies are up to date.\n` +
      `<${repoUrl}/pulls>`;
    for (const chunk of splitDiscordContent(msg)) {
      await postDiscordWebhook(webhook, chunk);
    }
    process.stderr.write("No open Dependabot PRs. Posted all-clear to Discord.\n");
    return;
  }

  const prWord = dependabotPRs.length === 1 ? "PR" : "PRs";
  const lines = [
    `🔄 **Dependency updates pending** (${now})`,
    `${dependabotPRs.length} open Dependabot ${prWord} awaiting review:`,
    "",
  ];

  for (const pr of dependabotPRs) {
    lines.push(`• **#${pr.number}** ${pr.title}`);
    lines.push(`  <${pr.html_url}>`);
  }

  lines.push("");
  lines.push(
    `📋 All open PRs: <${repoUrl}/pulls?q=is%3Apr+is%3Aopen+author%3Aapp%2Fdependabot>`
  );
  lines.push(
    `✅ Review, test, and merge PRs in GitHub. ` +
      `Merges that Dependabot authored will require approval in GitHub Actions before deploying.`
  );

  const message = lines.join("\n");
  for (const chunk of splitDiscordContent(message)) {
    await postDiscordWebhook(webhook, chunk);
  }

  process.stderr.write(
    `Posted Dependabot update notification to Discord (${dependabotPRs.length} ${prWord}).\n`
  );
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
