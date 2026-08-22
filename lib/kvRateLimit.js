/**
 * Hybrid rate limiter for Cloudflare Workers.
 *
 * Uses a per-isolate in-memory Map for instant consistency within the same
 * Worker isolate, and Cloudflare KV for cross-isolate persistence.
 *
 * This solves the eventual-consistency problem of KV reads: rapid-fire requests
 * from the same IP hitting the same isolate are blocked instantly by local
 * memory, while KV ensures the limit persists across isolates and restarts.
 *
 * Usage in an API route:
 *   const rate = await checkKvRateLimit(env.search_rate_limits, key, opts);
 */

const LOCAL_MAP = new Map();
const DAY_MS = 24 * 60 * 60 * 1000;

function localCheck(key, { maxRequests = 3, windowMs = DAY_MS } = {}) {
  const now = Date.now();
  let entry = LOCAL_MAP.get(key);
  if (!entry || entry.expiresAt <= now) {
    entry = { count: 0, expiresAt: now + windowMs };
  }
  entry.count += 1;
  LOCAL_MAP.set(key, entry);

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.expiresAt - now };
  }
  return { allowed: true, remaining: Math.max(0, maxRequests - entry.count), retryAfterMs: 0 };
}

async function kvHydrate(kv, key, windowMs) {
  if (!kv) return null;
  try {
    const raw = await kv.get(key, { cacheTtl: 10 });
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function kvPersist(kv, key, entry, windowMs) {
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(entry), {
      expirationTtl: Math.ceil(windowMs / 1000),
    });
  } catch {
    // non-blocking
  }
}

/**
 * Check a rate limit backed by local memory + Cloudflare KV.
 *
 * Algorithm:
 * 1. Check local memory first (instant, isolate-local).
 * 2. If local entry is missing/expired, try to hydrate from KV.
 * 3. Increment local counter.
 * 4. Persist incremented count back to KV (best-effort).
 * 5. Return result.
 */
async function checkKvRateLimit(kv, key, { maxRequests = 3, windowMs = DAY_MS } = {}) {
  const now = Date.now();
  let entry = LOCAL_MAP.get(key);

  // Hydrate from KV if local state is stale/missing
  if (!entry || entry.expiresAt <= now) {
    const hydrated = await kvHydrate(kv, key, windowMs);
    if (hydrated && hydrated.expiresAt > now) {
      entry = hydrated;
    } else {
      entry = { count: 0, expiresAt: now + windowMs };
    }
    LOCAL_MAP.set(key, entry);
  }

  // Enforce limit locally BEFORE increment (prevents same-isolate race)
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.expiresAt - now };
  }

  // Increment and store
  entry.count += 1;
  LOCAL_MAP.set(key, entry);
  kvPersist(kv, key, entry, windowMs); // fire-and-forget

  return { allowed: true, remaining: Math.max(0, maxRequests - entry.count), retryAfterMs: 0 };
}

module.exports = { checkKvRateLimit };
