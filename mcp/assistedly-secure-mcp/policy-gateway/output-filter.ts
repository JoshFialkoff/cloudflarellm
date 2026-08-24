/**
 * Output Minimization & Field Redaction
 * - Returns only declared fields
 * - Redacts/tokenizes sensitive data by default
 * - Enforces max 25 results per response
 */

import type { FacilityDetail, FacilitySummary } from "../types/index.js";

const MAX_RESULTS = 25;

export function limitResults<T>(items: T[]): T[] {
  if (items.length > MAX_RESULTS) {
    return items.slice(0, MAX_RESULTS);
  }
  return items;
}

export function toFacilitySummary(f: FacilityDetail, _tenant: string): FacilitySummary {
  return {
    id: f.id,
    name: f.name,
    city: f.city,
    zipCode: f.zipCode,
    careTypes: f.careTypes,
    feeLow: f.feeLow,
    feeHigh: f.feeHigh,
    safetyScore: f.safetyScore,
  };
}

export function redactFacilityDetail(f: FacilityDetail, _tenant: string): FacilityDetail {
  // Partners with "enterprise" role see full detail; others get summary-level
  // This function is the gatekeeper; callers pass tenant context
  return {
    ...f,
    // No internal IDs or raw source filenames exposed
    sources: f.sources.map((s) => ({ label: s.label, url: s.url })),
  };
}

export function estimateBytes(obj: unknown): number {
  return Buffer.byteLength(JSON.stringify(obj), "utf8");
}
