/**
 * Rate Limiter & Quota Enforcement
 * - Per-user, per-tenant, per-tool limits
 * - Daily/monthly unique-record quotas
 * - Response byte quotas
 * - Concurrent request limits
 * Hard-coded as secure defaults; overridable via env vars.
 */

import type { Identity, QuotaState, PolicyDecision } from "../types/index.js";

interface Limits {
  reqPerMinute: number;
  reqPerHour: number;
  reqPerDay: number;
  uniqueRecordsPerDay: number;
  bytesPerDay: number;
  maxConcurrent: number;
}

const DEFAULT_LIMITS: Limits = {
  reqPerMinute: 30,
  reqPerHour: 300,
  reqPerDay: 1000,
  uniqueRecordsPerDay: 500,
  bytesPerDay: 5 * 1024 * 1024, // 5 MB
  maxConcurrent: 5,
};

const ADMIN_LIMITS: Limits = {
  reqPerMinute: 120,
  reqPerHour: 2000,
  reqPerDay: 10000,
  uniqueRecordsPerDay: 5000,
  bytesPerDay: 50 * 1024 * 1024, // 50 MB
  maxConcurrent: 20,
};

const CONCURRENT = new Map<string, number>(); // key -> active count
const QUOTAS = new Map<string, QuotaState>();

function key(identity: Identity, toolName?: string): string {
  return toolName ? `${identity.tenant}:${identity.sub}:${toolName}` : `${identity.tenant}:${identity.sub}`;
}

function getLimits(identity: Identity): Limits {
  if (identity.roles.includes("admin")) return ADMIN_LIMITS;
  // Professional tier gets bumped limits
  if (identity.roles.includes("professional")) {
    return {
      reqPerMinute: 60,
      reqPerHour: 600,
      reqPerDay: 2500,
      uniqueRecordsPerDay: 1500,
      bytesPerDay: 15 * 1024 * 1024,
      maxConcurrent: 10,
    };
  }
  return DEFAULT_LIMITS;
}

function nowBuckets(): { minute: number; hour: number; day: number } {
  const d = new Date();
  const minute = Math.floor(d.getTime() / 60_000);
  const hour = Math.floor(d.getTime() / 3_600_000);
  const day = Math.floor(d.getTime() / 86_400_000);
  return { minute, hour, day };
}

function ensureQuota(k: string): QuotaState {
  let q = QUOTAS.get(k);
  if (!q) {
    const { minute, hour, day } = nowBuckets();
    q = {
      requestsThisMinute: 0,
      requestsThisHour: 0,
      requestsToday: 0,
      uniqueRecordsToday: new Set(),
      bytesToday: 0,
      lastResetMinute: minute,
      lastResetHour: hour,
      lastResetDay: day,
    };
    QUOTAS.set(k, q);
  }
  return q;
}

function resetBuckets(q: QuotaState): void {
  const { minute, hour, day } = nowBuckets();
  if (q.lastResetMinute !== minute) {
    q.requestsThisMinute = 0;
    q.lastResetMinute = minute;
  }
  if (q.lastResetHour !== hour) {
    q.requestsThisHour = 0;
    q.lastResetHour = hour;
  }
  if (q.lastResetDay !== day) {
    q.requestsToday = 0;
    q.uniqueRecordsToday.clear();
    q.bytesToday = 0;
    q.lastResetDay = day;
  }
}

export function checkRateLimit(identity: Identity, toolName: string): PolicyDecision {
  const limits = getLimits(identity);
  const k = key(identity, toolName);
  const q = ensureQuota(k);
  resetBuckets(q);

  if (q.requestsThisMinute >= limits.reqPerMinute) {
    return { decision: "throttle", retryAfter: 60 };
  }
  if (q.requestsThisHour >= limits.reqPerHour) {
    return { decision: "throttle", retryAfter: 3600 };
  }
  if (q.requestsToday >= limits.reqPerDay) {
    return { decision: "deny", reason: "daily_request_quota_exceeded" };
  }

  // Concurrent check
  const ck = key(identity);
  const active = CONCURRENT.get(ck) || 0;
  if (active >= limits.maxConcurrent) {
    return { decision: "throttle", retryAfter: 5 };
  }

  return { decision: "allow", context: { identity, toolName, requestId: crypto.randomUUID(), timestamp: new Date() } };
}

export function recordRequest(identity: Identity, toolName: string, recordIds: string[], outputBytes: number): void {
  const k = key(identity, toolName);
  const q = ensureQuota(k);
  resetBuckets(q);
  q.requestsThisMinute++;
  q.requestsThisHour++;
  q.requestsToday++;
  for (const id of recordIds) q.uniqueRecordsToday.add(id);
  q.bytesToday += outputBytes;
}

export function checkRecordQuota(identity: Identity, toolName: string, recordIds: string[], outputBytes: number): PolicyDecision {
  const limits = getLimits(identity);
  const k = key(identity, toolName);
  const q = ensureQuota(k);
  resetBuckets(q);

  const projectedUnique = new Set(q.uniqueRecordsToday);
  for (const id of recordIds) projectedUnique.add(id);
  if (projectedUnique.size > limits.uniqueRecordsPerDay) {
    return { decision: "deny", reason: "daily_unique_record_quota_exceeded" };
  }
  if (q.bytesToday + outputBytes > limits.bytesPerDay) {
    return { decision: "deny", reason: "daily_byte_quota_exceeded" };
  }

  return { decision: "allow", context: { identity, toolName, requestId: crypto.randomUUID(), timestamp: new Date() } };
}

export function acquireConcurrent(identity: Identity): void {
  const ck = key(identity);
  CONCURRENT.set(ck, (CONCURRENT.get(ck) || 0) + 1);
}

export function releaseConcurrent(identity: Identity): void {
  const ck = key(identity);
  const v = (CONCURRENT.get(ck) || 1) - 1;
  if (v <= 0) CONCURRENT.delete(ck);
  else CONCURRENT.set(ck, v);
}
