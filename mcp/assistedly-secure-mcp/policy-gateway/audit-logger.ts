/**
 * Privacy-safe Audit Logger
 * - Structured JSON to stderr
 * - Never logs secrets, tokens, or sensitive payloads
 * - Includes anomaly signals without PII
 */

import type { AuditEvent, ToolContext, AnomalyResult } from "../types/index.js";
import { createHash } from "crypto";

export function hashInput(args: unknown): string {
  return createHash("sha256").update(JSON.stringify(args)).digest("hex").slice(0, 16);
}

export function logAudit(
  context: ToolContext,
  decision: "allow" | "deny" | "throttle" | "block",
  recordCount: number,
  outputBytes: number,
  anomaly: AnomalyResult,
  durationMs: number
): void {
  const event: AuditEvent = {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    tenant: context.identity.tenant,
    userId: context.identity.sub,
    serviceIdentity: "assistedly-secure-mcp",
    tool: context.toolName,
    purpose: context.purpose || "unspecified",
    policyDecision: decision,
    recordCount,
    outputBytes,
    anomalySignals: anomaly.signals,
    tokenJti: context.identity.jti,
    inputHash: hashInput(context.purpose || ""),
    durationMs,
  };

  // Write to stderr; stdout is reserved for JSON-RPC / SSE
  console.error(JSON.stringify(event));
}

export function logSecurityIncident(
  context: ToolContext,
  anomaly: AnomalyResult,
  action: "throttle" | "block" | "revoke"
): void {
  const incident = {
    type: "security_incident",
    severity: anomaly.severity,
    action,
    tenant: context.identity.tenant,
    userId: context.identity.sub,
    tool: context.toolName,
    signals: anomaly.signals,
    tokenJti: context.identity.jti,
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(incident));
}
