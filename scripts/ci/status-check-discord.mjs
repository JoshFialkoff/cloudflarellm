#!/usr/bin/env node
/**
 * Production HTTP checks + optional Discord summary.
 *
 * Env:
 *   STATUS_BASE_URL           — default https://assistedly.ai
 *   DISCORD_STATUS_WEBHOOK_URL — preferred incoming webhook for status posts
 *   DISCORD_GITHUB_UPDATES_WEBHOOK_URL — GitHub / CI updates channel (second choice)
 *   DISCORD_DEPLOY_WEBHOOK_URL — legacy fallback if the above are unset
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { postDiscordWebhook, splitDiscordContent } = require("../lib/discord-webhook.cjs");

const base = (process.env.STATUS_BASE_URL || "https://assistedly.ai").replace(/\/+$/, "");
const webhook =
  process.env.DISCORD_STATUS_WEBHOOK_URL?.trim() ||
  process.env.DISCORD_GITHUB_UPDATES_WEBHOOK_URL?.trim() ||
  process.env.DISCORD_DEPLOY_WEBHOOK_URL?.trim() ||
  "";

/** @typedef {{ name: string, path: string, redirect?: boolean }} Check */

/** @type {Check[]} */
const checks = [
  { name: "homepage", path: "/" },
  { name: "search", path: "/search" },
  { name: "blog-redirect", path: "/blog", redirect: true },
];

async function runCheck({ name, path, redirect }) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "GET",
    redirect: redirect ? "manual" : "follow",
    headers: { "user-agent": "AssistedlyStatusCheck/1.0" },
  });
  const loc = res.headers.get("location") || "";
  if (redirect) {
    const ok = (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) && loc;
    return { name, url, ok, detail: `${res.status} location=${loc.slice(0, 120)}` };
  }
  const ok = res.status >= 200 && res.status < 400;
  return { name, url, ok, detail: String(res.status) };
}

async function main() {
  const lines = [`**Assistedly status** (${base})`, `Time (UTC): ${new Date().toISOString()}`];
  let failed = false;
  for (const c of checks) {
    try {
      const r = await runCheck(c);
      if (!r.ok) failed = true;
      lines.push(r.ok ? `✅ ${r.name}: ${r.detail}` : `❌ ${r.name}: ${r.detail}`);
    } catch (e) {
      failed = true;
      lines.push(`❌ ${c.name}: ${/** @type {Error} */ (e).message}`);
    }
  }
  if (!webhook) {
    lines.push(
      "_No Discord webhook set (DISCORD_STATUS_WEBHOOK_URL, DISCORD_GITHUB_UPDATES_WEBHOOK_URL, or DISCORD_DEPLOY_WEBHOOK_URL)._"
    );
  }
  const body = lines.join("\n");
  process.stdout.write(`${body}\n\n`);

  if (webhook) {
    for (const chunk of splitDiscordContent(body)) {
      await postDiscordWebhook(webhook, chunk);
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(1);
});
