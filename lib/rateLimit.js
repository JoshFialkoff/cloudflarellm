/**
 * Simple in-memory rate limiter.
 *
 * Uses a sliding window approach. In production with multiple instances,
 * replace with Redis or a database-backed store. For a single-server
 * setup (or serverless with sticky sessions), this is sufficient.
 *
 * Usage:
 *   const { checkRateLimit } = require("./rateLimit");
 *   const result = checkRateLimit("magic-link:user@example.com", {
 *     maxRequests: 3,
 *     windowMs: 5 * 60 * 1000, // 5 minutes
 *   });
 *   if (!result.allowed) {
 *     // rate limited — retry after result.retryAfterMs ms
 *   }
 */

const windows = new Map();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function prune() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of windows) {
    if (entry.expiresAt <= now) windows.delete(key);
  }
}

/**
 * @param {string} key - Unique identifier for the rate limit subject (e.g. "magic-link:user@example.com")
 * @param {object} options
 * @param {number} options.maxRequests - Maximum number of requests allowed in the window
 * @param {number} options.windowMs - Window duration in milliseconds
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
function checkRateLimit(key, { maxRequests = 3, windowMs = 5 * 60 * 1000 } = {}) {
  prune();

  const now = Date.now();
  let entry = windows.get(key);

  // Create or reset if expired
  if (!entry || entry.expiresAt <= now) {
    entry = { count: 0, expiresAt: now + windowMs };
    windows.set(key, entry);
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.expiresAt - now,
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    retryAfterMs: 0,
  };
}

module.exports = { checkRateLimit };