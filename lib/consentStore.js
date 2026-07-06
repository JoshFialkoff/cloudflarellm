/**
 * Consent record store.
 *
 * Records when a user submits their email (GDPR/CCPA consent).
 * In production, this should be backed by a database. For now,
 * uses an in-memory store with optional logging to stdout for
 * observability and audit trail.
 *
 * To persist beyond server restarts, replace with:
 * - Database table (PostgreSQL, SQLite, etc.)
 * - A simple append-only log file
 * - PostHog event or GA4 event
 */

const crypto = require("crypto");

const MAX_RECORDS = 10000;
const records = [];

function formatTimestamp(date) {
  return date.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

/**
 * Records a consent event.
 *
 * @param {string} email - The user's email address
 * @param {object} metadata - Additional context about the consent
 * @param {string} [metadata.authSurface] - Where the user submitted (e.g. "magic_link_form", "homepage_wizard")
 * @param {string} [metadata.redirectTo] - Where they were headed after auth
 * @param {boolean} [metadata.hasResultSnapshot] - Whether they had a saved search snapshot
 * @param {string} [metadata.ip] - IP address (truncated for privacy)
 * @param {string} [metadata.userAgent] - Browser user agent
 */
function recordConsent(email, metadata = {}) {
  if (!email || typeof email !== "string") return;

  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const record = {
    id: crypto.randomBytes(8).toString("hex"),
    email: normalizedEmail,
    consentedAt: formatTimestamp(now),
    consentedAtISO: now.toISOString(),
    source: metadata.authSurface || "unknown",
    redirectTo: metadata.redirectTo || null,
    hasResultSnapshot: Boolean(metadata.hasResultSnapshot),
    // Store only first 2 octets of IP for privacy (e.g. "192.168.x.x")
    ipPrefix: metadata.ip
      ? String(metadata.ip).split(".").slice(0, 2).join(".") + ".x.x"
      : null,
    userAgent: metadata.userAgent
      ? String(metadata.userAgent).slice(0, 200)
      : null,
  };

  // Keep bounded in-memory store
  records.push(record);
  if (records.length > MAX_RECORDS) records.shift();

  // Structured log for audit trail / log aggregation
  console.log(
    JSON.stringify({
      event: "consent.recorded",
      email: normalizedEmail,
      source: record.source,
      consentedAt: record.consentedAtISO,
      id: record.id,
    })
  );

  return record;
}

/**
 * Retrieves consent records for a given email.
 * Useful for verifying consent exists ("right to be forgotten" checks).
 *
 * @param {string} email
 * @returns {Array} matching consent records (newest first)
 */
function getConsentRecords(email) {
  if (!email) return [];
  const normalized = email.trim().toLowerCase();
  return records
    .filter((r) => r.email === normalized)
    .reverse();
}

/**
 * Returns the number of stored consent records.
 */
function consentCount() {
  return records.length;
}

module.exports = {
  recordConsent,
  getConsentRecords,
  consentCount,
};