#!/usr/bin/env node
/**
 * Cloudflare API Token Health Check & Rotation
 *
 * Tests if the current CLOUDFLARE_API_TOKEN works. If yes, exits quietly.
 * If failing, creates a new token and stores it in Infisical.
 * Discord notification fires ONLY on failure (rotation needed or error).
 *
 * Run locally:
 *   cd ~/Assistedly.ai && \
 *   INFISICAL_DOMAIN=https://secrets.assistedly.ai \
 *   infisical run --env=prod -- node scripts/ci/rotate-cloudflare-token.mjs
 */

/* global fetch */
import { execSync } from "node:child_process";

const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID?.trim();
const CURRENT_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim();
const ROTATION_TOKEN = process.env.CLOUDFLARE_ROTATION_TOKEN?.trim();
const EMAIL = process.env.CLOUDFLARE_EMAIL?.trim();
const DISCORD_WEBHOOK = process.env.DISCORD_OPS_WEBHOOK_URL?.trim();
const DRY_RUN = process.env.DRY_RUN === "1";

function cloudflareHeaders(token) {
  if (EMAIL) {
    return { "X-Auth-Email": EMAIL, "X-Auth-Key": token, "Content-Type": "application/json" };
  }
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function cf(endpoint, opts = {}, token) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    ...opts,
    headers: { ...cloudflareHeaders(token), ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(`${res.status}: ${JSON.stringify(body.errors || body)}`);
  }
  return body;
}

async function tokenIsValid(token) {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(`${res.status}`);
    console.log(`✅ Token valid — zone: ${body.result?.name}`);
    return true;
  } catch (e) {
    return false;
  }
}

async function notify(message) {
  if (!DISCORD_WEBHOOK) return;
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch (e) {
    console.warn("Discord notify failed:", e.message);
  }
}

async function createToken() {
  const payload = {
    name: `assistedly-deploy-${new Date().toISOString().slice(0, 10)}`,
    policies: [{
      effect: "allow",
      resources: { [`com.cloudflare.api.account.zone.${ZONE_ID}`]: "*" },
      permission_groups: [
        { id: "c8fed203ed3043cba015a93ad1616f1f" }, // Zone Read
        { id: "e6d2666161e84845a636613608cee8d5" }, // Zone Write
      ],
    }],
    condition: { request_ip: { in: [], not_in: [] } },
  };
  if (DRY_RUN) {
    console.log("[DRY RUN] Would create:", payload.name);
    return { id: "dry-run", value: "dry-run" };
  }
  const body = await cf("/user/tokens", { method: "POST", body: JSON.stringify(payload) }, ROTATION_TOKEN);
  return { id: body.result.id, value: body.result.value };
}

async function updateInfisical(value) {
  if (DRY_RUN) { console.log("[DRY RUN] Would update Infisical"); return; }
  execSync(`infisical secrets set "CLOUDFLARE_API_TOKEN=${value}" --silent`, { env: process.env });
  console.log("Updated Infisical.");
}

async function main() {
  if (!ZONE_ID || !CURRENT_TOKEN || !ROTATION_TOKEN) {
    const msg = "❌ CLOUDFLARE_TOKEN_CHECK: Missing env vars";
    await notify(msg);
    console.error("Missing: CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN, or CLOUDFLARE_ROTATION_TOKEN");
    process.exit(1);
  }

  // Step 1: Test current token
  console.log("Checking current deploy token...");
  if (await tokenIsValid(CURRENT_TOKEN)) {
    console.log("Token is healthy. No rotation needed.");
    return;
  }

  // Token is failing — alert + rotate
  console.warn("❌ Token failing! Attempting rotation...");
  await notify("⚠️ Cloudflare deploy token is failing! Attempting auto-rotation...");

  try {
    const newToken = await createToken();
    console.log(`Created new token: ${newToken.id}`);

    // Verify new token with retries
    for (let i = 0; i < 30; i++) {
      if (await tokenIsValid(newToken.value)) break;
      if (i === 0) console.log("Waiting for Cloudflare propagation...");
      await new Promise(r => setTimeout(r, 2000));
    }

    await updateInfisical(newToken.value);
    await notify(`✅ Cloudflare token rotated successfully. New token: \`${newToken.id}\``);
    console.log("Rotation complete.");
  } catch (err) {
    await notify(`❌ Cloudflare token rotation FAILED: ${err.message}`);
    console.error("FAILED:", err.message);
    process.exit(1);
  }
}

main().catch(async (err) => {
  await notify(`❌ Cloudflare token check CRASHED: ${err.message}`);
  console.error("CRASHED:", err.message);
  process.exit(1);
});
