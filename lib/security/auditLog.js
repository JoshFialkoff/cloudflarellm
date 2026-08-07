/**
 * HIPAA-compliant audit logging
 *
 * Rules:
 * 1. NEVER log raw prompt text, user queries, or upstream responses.
 * 2. Log SHA-256 hashes for correlation.
 * 3. Include actor, action, resource type, and timestamp.
 * 4. Strip PII from any message before it hits console/Discord/webhooks.
 */

import { hashForAudit, safePreview, sanitize } from "./sanitizer.js";

const AUDIT_ENABLED = process.env.HIPAA_AUDIT_LOGGING !== "false";

function nowIso() {
  return new Date().toISOString();
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== "object") return meta;
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === "string" && v.length > 0) {
      out[k] = safePreview(v, 200);
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (typeof v === "object" && v !== null) {
      out[k] = sanitizeMeta(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Write an audit event.  In production this should ship to a tamper-resistant
 * store (CloudWatch / Splunk / SIEM).  For now we emit structured JSON to
 * stderr so log aggregators can collect it.
 */
export function auditLog(event) {
  if (!AUDIT_ENABLED) return;

  const record = {
    _audit: true,
    _schema: "assistedly/hipaa-audit/1.0",
    ts: nowIso(),
    actor: event.actor || "anonymous",
    action: event.action || "unknown",
    resource: event.resource || "llm-pipeline",
    resourceHash: event.resourceHash || null,
    outcome: event.outcome || "unknown",
    meta: sanitizeMeta(event.meta || {}),
  };

  // Console must go to stderr so stdout stays clean for HTTP responses
  console.error(JSON.stringify(record));
}

/**
 * Convenience wrapper for LLM prompt audit events.
 */
export function auditPrompt({ actor, model, provider, promptHash, status }) {
  auditLog({
    actor,
    action: "llm.prompt",
    resource: `${provider}/${model}`,
    resourceHash: promptHash,
    outcome: status || "dispatched",
  });
}

/**
 * Convenience wrapper for access-control decisions.
 */
export function auditAccess({ actor, resource, granted, reason }) {
  auditLog({
    actor,
    action: "access.decision",
    resource,
    outcome: granted ? "allowed" : "denied",
    meta: { reason },
  });
}

/**
 * Safe error logger — NEVER prints the raw upstream body.
 */
export function safeError(context, err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[ SAFE ERROR ]", context, safePreview(message, 500));
}
