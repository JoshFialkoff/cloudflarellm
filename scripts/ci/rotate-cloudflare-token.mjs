#!/usr/bin/env node
/**
 * Automated Cloudflare API Token Rotation for self-hosted Infisical.
 *
 * Infisical built-in Secret Rotation is a paid-only feature.
 * This script runs on a schedule (GitHub Actions cron) to:
 *   1. Read current CLOUDFLARE_API_TOKEN from process.env (injected by "infisical run").
 *   2. Create new Cloudflare token via Cloudflare API using CLOUDFLARE_ROTATION_TOKEN.
 *   3. Test the new token.
 *   4. Write new token back to Infisical via "infisical secrets set" CLI.
 *
 * Environment variables required (all injected by surrounding "infisical run"):
 *   CLOUDFLARE_ROTATION_TOKEN  - Cloudflare token with User:API Tokens:Edit permission
 *   CLOUDFLARE_ZONE_ID         - Zone ID for the token scope (e.g., assistedly.ai)
 *   CLOUDFLARE_API_TOKEN       - Current deploy token (will be replaced)
 *   DISCORD_OPS_WEBHOOK_URL    - Optional Discord notifications
 *
 * Optional env:
 *   DRY_RUN     - Set to "1" to simulate without writing to Infisical
 *   REVOKE_OLD  - Set to "1" to revoke the old deploy token after rotation
 *
 * Run locally:
 *   cd ~/Assistedly.ai && \
 *   INFISICAL_DOMAIN=https://secrets.assistedly.ai \
 *   infisical run --env=prod -- node scripts/ci/rotate-cloudflare-token.mjs
 */

/* global fetch */
import { execSync } from "node:child_process";

function env(name) {
  return (process.env[name] || "").trim();
}

const CLOUDFLARE_ROTATION_TOKEN = env("CLOUDFLARE_ROTATION_TOKEN");
const CLOUDFLARE_ZONE_ID = env("CLOUDFLARE_ZONE_ID");
const DRY_RUN = process.env.DRY_RUN === "1";
const REVOKE_OLD = process.env.REVOKE_OLD === "1";

function assertEnv(name) {
  const val = env(name);
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

async function cloudflareRequest(endpoint, opts = {}, token = CLOUDFLARE_ROTATION_TOKEN) {
  const url = `https://api.cloudflare.com/client/v4${endpoint}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(
      `Cloudflare API error: ${res.status} ${res.statusText} — ${JSON.stringify(body.errors || body)}`
    );
  }
  return body;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyTokenWorks(token, retries = 3) {
  // Try /user/tokens/verify first (works for any valid token regardless of permissions)
  for (let i = 0; i < retries; i++) {
    try {
      await cloudflareRequest("/user/tokens/verify", {}, token);
      return true;
    } catch (err) {
      console.warn(`Token verify attempt ${i + 1}/${retries} failed:`, err.message.split(" — ")[0]);
      if (i < retries - 1) await sleep(3000);
    }
  }
  return false;
}

async function createNewCloudflareToken(zoneId) {
  // Permission group IDs specific to this Cloudflare account (fetched from /user/tokens/permission_groups)
  const zoneRead = "c8fed203ed3043cba015a93ad1616f1f"; // Zone Read
  const zoneWrite = "e6d2666161e84845a636613608cee8d5"; // Zone Write
  const payload = {
    name: `assistedly-deploy-token-${new Date().toISOString().slice(0, 10)}`,
    policies: [
      {
        effect: "allow",
        resources: {
          ...(zoneId
            ? { [`com.cloudflare.api.account.zone.${zoneId}`]: "*" }
            : { "com.cloudflare.api.account.*": "*" }),
        },
        permission_groups: [
          { id: zoneRead },
          { id: zoneWrite },
        ],
      },
    ],
    condition: { request_ip: { in: [], not_in: [] } },
  };

  if (DRY_RUN) {
    console.log("[DRY RUN] Would create new Cloudflare token:", JSON.stringify(payload, null, 2));
    return { id: "dry-run-token-id", value: "dry-run-token-value" };
  }

  const body = await cloudflareRequest("/user/tokens", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  console.log("Token creation response:", JSON.stringify(body.result, null, 2));
  return { id: body.result.id, value: body.result.value };
}

async function revokeToken(tokenId) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would revoke old token ${tokenId}`);
    return;
  }
  await cloudflareRequest(`/user/tokens/${tokenId}`, { method: "DELETE" });
  console.log(`Revoked old Cloudflare token ${tokenId}`);
}

async function sendDiscordNotification(message) {
  const webhookUrl = env("DISCORD_OPS_WEBHOOK_URL");
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch (e) {
    console.warn("Discord notification failed:", e.message);
  }
}

async function main() {
  assertEnv("CLOUDFLARE_ROTATION_TOKEN");
  const zoneId = assertEnv("CLOUDFLARE_ZONE_ID");
  const currentToken = assertEnv("CLOUDFLARE_API_TOKEN");

  // Defensive: log first/last chars to diagnose formatting issues (never log full token)
  const fmt = (s) => `${s.slice(0, 4)}...${s.slice(-4)}`;
  console.log(`Using ROTATION_TOKEN=${fmt(CLOUDFLARE_ROTATION_TOKEN)}`);
  console.log(`Using current API_TOKEN=${fmt(currentToken)}`);

  console.log("Starting Cloudflare API token rotation...");

  // 1. Get current token metadata
  let currentTokenId = "unknown";
  try {
    const meta = await cloudflareRequest("/user/tokens/verify", {}, currentToken);
    currentTokenId = meta.result?.id || "unknown";
    console.log(`Current token id=${currentTokenId}, status=${meta.result?.status}`);
  } catch (e) {
    console.warn("Could not verify current token (may be expired):", e.message);
  }

  // 2. Create new token
  const newToken = await createNewCloudflareToken(zoneId);
  console.log(`Created new Cloudflare token: id=${newToken.id}`);

  // 3. Verify new token works
  const works = await verifyTokenWorks(newToken.value, zoneId);
  if (!works) {
    // Try to clean up the created token since we can't store it
    if (!DRY_RUN) {
      console.warn("New token verification failed — attempting to revoke it...");
      await revokeToken(newToken.id).catch(() => {});
    }
    throw new Error("New Cloudflare token failed verification! Aborting.");
  }
  console.log("New token verified successfully.");

  // 4. Update Infisical via CLI
  if (DRY_RUN) {
    console.log("[DRY RUN] Would update Infisical secret CLOUDFLARE_API_TOKEN");
  } else {
    try {
      execSync(`infisical secrets set CLOUDFLARE_API_TOKEN="${newToken.value}" --silent`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
        env: process.env,
      });
      console.log("Updated Infisical with new CLOUDFLARE_API_TOKEN.");
    } catch (err) {
      console.error("Failed to write new token to Infisical.", err.message);
      console.error(`New token ID: ${newToken.id} — attempting to revoke it...`);
      await revokeToken(newToken.id).catch(() => {});
      process.exit(1);
    }
  }

  // 5. Notify
  await sendDiscordNotification(
    `🔁 Cloudflare API token rotated for assistedly.ai\nOld: \`${currentTokenId}\` → New: \`${newToken.id}\``
  );
  console.log("Rotation complete.");

  // 6. Optionally revoke old token
  if (REVOKE_OLD && currentTokenId !== "unknown") {
    await revokeToken(currentTokenId);
  } else if (currentTokenId !== "unknown") {
    console.log(`Old token ${currentTokenId} remains active. Set REVOKE_OLD=1 after validation.`);
  }
}

main().catch((err) => {
  console.error("Rotation failed:", err.message);
  sendDiscordNotification(`❌ Cloudflare token rotation FAILED: ${err.message}`).catch(() => {});
  process.exit(1);
});
