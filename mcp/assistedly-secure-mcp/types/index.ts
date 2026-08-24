/**
 * Core types for the Assistedly Secure MCP Server.
 * Every data structure is minimized by default.
 */

export interface Identity {
  sub: string;        // user ID
  tenant: string;     // tenant/org ID
  roles: string[];    // e.g. ["consumer", "professional"]
  aud: string;         // intended audience (mcp tool name or "assistedly-mcp")
  exp: number;        // epoch seconds
  iat: number;        // epoch seconds
  jti: string;        // unique token ID for revocation
}

export interface ToolContext {
  identity: Identity;
  toolName: string;
  purpose?: string;
  requestId: string;
  timestamp: Date;
}

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  tenant: string;
  userId: string;
  serviceIdentity: string;
  tool: string;
  purpose: string;
  policyDecision: "allow" | "deny" | "throttle" | "block";
  recordCount: number;
  outputBytes: number;
  anomalySignals: string[];
  tokenJti: string;
  inputHash: string;   // SHA-256 of canonicalized input
  durationMs: number;
}

export interface FacilitySummary {
  id: number;
  name: string;
  city: string;
  zipCode: string;
  careTypes: string[];
  feeLow?: number;
  feeHigh?: number;
  safetyScore: number;
}

export interface FacilityDetail {
  id: number;
  name: string;
  city: string;
  zipCode: string;
  careTypes: string[];
  feeLow?: number;
  feeHigh?: number;
  safetyScore: number;
  occupancyRate?: number;
  totalUnits?: number;
  taxStatus?: string;
  sources: Array<{ label: string; url: string }>;
}

export interface CaseCriteria {
  careNeeds?: string;
  budget?: string;
  location?: string;
  timing?: string;
  priorities?: string[];
}

export interface MatchResult {
  optionId: number;
  name: string;
  city: string;
  matchScore: number;
  tags: Array<{ key: string; label: string; icon: string }>;
  explanation: string;
}

export interface QuotaState {
  requestsThisMinute: number;
  requestsThisHour: number;
  requestsToday: number;
  uniqueRecordsToday: Set<string>;
  bytesToday: number;
  lastResetMinute: number;
  lastResetHour: number;
  lastResetDay: number;
}

export type PolicyDecision = { decision: "allow"; context: ToolContext } | { decision: "deny"; reason: string } | { decision: "throttle"; retryAfter: number };

export interface AnomalyResult {
  signals: string[];
  severity: "none" | "low" | "medium" | "high" | "critical";
  action: "allow" | "throttle" | "block";
}
