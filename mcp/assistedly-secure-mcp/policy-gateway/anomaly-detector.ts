/**
 * Anomaly Detection Engine
 * Detects enumeration, systematic extraction, and prompt-injection-driven exfiltration.
 */

import type { Identity, AnomalyResult } from "../types/index.js";

interface SessionState {
  queries: Array<{
    tool: string;
    input: string;
    time: number;
    recordsReturned: number;
  }>;
  uniqueRecordIds: Set<string>;
  lastQueryTime: number;
}

const SESSIONS = new Map<string, SessionState>();

function getSession(identity: Identity): SessionState {
  const k = `${identity.tenant}:${identity.sub}`;
  let s = SESSIONS.get(k);
  if (!s) {
    s = { queries: [], uniqueRecordIds: new Set(), lastQueryTime: 0 };
    SESSIONS.set(k, s);
  }
  return s;
}

function canonicalizeInput(args: unknown): string {
  try {
    return JSON.stringify(args, Object.keys(args as object).sort());
  } catch {
    return String(args);
  }
}


export function detectAnomalies(
  identity: Identity,
  toolName: string,
  args: unknown,
  recordsReturned: number,
  recordIds: string[]
): AnomalyResult {
  const session = getSession(identity);
  const now = Date.now();
  const input = canonicalizeInput(args);
  const signals: string[] = [];

  // 1. Repeated similar queries
  const recent = session.queries.filter((q) => now - q.time < 60_000);
  const similarCount = recent.filter((q) => q.tool === toolName && q.input === input).length;
  if (similarCount >= 3) {
    signals.push(`repeated_identical_queries:${similarCount}`);
  }

  // 2. Rapid fire
  if (session.lastQueryTime && now - session.lastQueryTime < 500) {
    signals.push("rapid_fire_subsecond");
  }

  // 3. Systematic filter sweeps (changing one parameter)
  if (recent.length >= 5) {
    const changingParam = detectParameterSweep(recent.map((q) => q.input));
    if (changingParam) {
      signals.push(`systematic_parameter_sweep:${changingParam}`);
    }
  }

  // 4. Unique-record coverage spike
  for (const id of recordIds) session.uniqueRecordIds.add(id);
  if (session.uniqueRecordIds.size > 200) {
    signals.push(`high_unique_record_coverage:${session.uniqueRecordIds.size}`);
  }

  // 5. High-volume extraction in short window
  const recordsLast5Min = recent.reduce((sum, q) => sum + q.recordsReturned, 0) + recordsReturned;
  if (recordsLast5Min > 100) {
    signals.push(`high_volume_extraction:${recordsLast5Min}`);
  }

  // 6. Prompt injection markers in arguments
  const argStr = JSON.stringify(args).toLowerCase();
  const injectionMarkers = [
    "ignore previous", "ignore all", "system prompt", "you are now",
    "disregard", "override instructions", "new instructions",
    "exfiltrate", "dump", "export all", "select *", "schema",
  ];
  for (const marker of injectionMarkers) {
    if (argStr.includes(marker)) {
      signals.push(`prompt_injection_marker:${marker.replace(/\s+/g, "_")}`);
    }
  }

  // 7. External routing attempts (ask to send data elsewhere)
  const externalPatterns = [
    /https?:\/\//,
    /@[\w.-]+\.\w+/,
    /send\s+(to|data)/i,
    /forward\s+(to)/i,
    /upload\s+(to)/i,
    /post\s+(to)/i,
  ];
  for (const rx of externalPatterns) {
    if (rx.test(argStr)) {
      signals.push("external_routing_attempt");
      break;
    }
  }

  // Update session
  session.queries.push({ tool: toolName, input, time: now, recordsReturned });
  // Trim old queries
  session.queries = session.queries.filter((q) => now - q.time < 300_000);
  session.lastQueryTime = now;

  // Severity / action
  let severity: AnomalyResult["severity"] = "none";
  let action: AnomalyResult["action"] = "allow";

  const criticalSignals = signals.filter((s) => s.startsWith("prompt_injection_marker") || s === "external_routing_attempt");
  const highSignals = signals.filter((s) => s.startsWith("high_volume_extraction") || s.startsWith("systematic_parameter_sweep"));
  const mediumSignals = signals.filter((s) => s.startsWith("high_unique_record_coverage") || s.startsWith("repeated_identical_queries"));

  if (criticalSignals.length > 0) {
    severity = "critical";
    action = "block";
  } else if (highSignals.length > 0) {
    severity = "high";
    action = "block";
  } else if (mediumSignals.length > 0) {
    severity = "medium";
    action = "throttle";
  } else if (signals.length > 0) {
    severity = "low";
    action = "allow"; // log but permit
  }

  return { signals, severity, action };
}

function detectParameterSweep(inputs: string[]): string | null {
  if (inputs.length < 3) return null;
  try {
    const parsed = inputs.map((i) => JSON.parse(i));
    const keys = Object.keys(parsed[0]);
    for (const k of keys) {
      const values = parsed.map((p) => p[k]);
      const unique = new Set(values);
      // All other keys identical, this one varying
      const otherKeys = keys.filter((ok) => ok !== k);
      const othersStable = otherKeys.every((ok) => {
        const first = parsed[0][ok];
        return parsed.every((p) => p[ok] === first);
      });
      if (unique.size >= 3 && othersStable) return k;
    }
  } catch {
    return null;
  }
  return null;
}

export function clearSession(identity: Identity): void {
  SESSIONS.delete(`${identity.tenant}:${identity.sub}`);
}
