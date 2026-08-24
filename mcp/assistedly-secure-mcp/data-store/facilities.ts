/**
 * Narrow Data Store
 * - Read-only access to cached facility data
 * - No arbitrary queries, no SQL, no filesystem traversal
 * - Loads chart-facilities.json at boot
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { FacilityDetail, CaseCriteria, MatchResult } from "../types/index.js";

const DATA_PATH = process.env.FACILITY_DATA_PATH || join(process.cwd(), "..", "..", "public", "data", "chart-facilities.json");

let _facilities: FacilityDetail[] = [];

function load(): FacilityDetail[] {
  if (_facilities) return _facilities || [];
  if (!existsSync(DATA_PATH)) {
    // Fallback: look relative to this file in dist/
    const alt = join(process.cwd(), "public", "data", "chart-facilities.json");
    if (!existsSync(alt)) {
      console.error(`[data-store] Facility data not found at ${DATA_PATH} or ${alt}`);
      _facilities = [];
      return _facilities || [];
    }
    const raw = JSON.parse(readFileSync(alt, "utf-8"));
    _facilities = raw.facilities || [];
    return _facilities || [];
  }
  const raw = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  _facilities = raw.facilities || [];
  return _facilities || [];
}

export function findById(id: number): FacilityDetail | null {
  return load().find((f) => f.id === id) || null;
}

export function findBySlug(slug: string): FacilityDetail | null {
  const normalized = slug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return (
    load().find((f) => {
      const facilitySlug = f.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      return facilitySlug === normalized;
    }) || null
  );
}

export function findMatching(criteria: CaseCriteria, maxResults: number): MatchResult[] {
  const all = load();
  const scored = all.map((f) => ({ facility: f, score: computeScore(f, criteria) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map((s) => ({
    optionId: s.facility.id,
    name: s.facility.name,
    city: s.facility.city,
    matchScore: s.score,
    tags: buildTags(s.facility, criteria),
    explanation: buildExplanation(s.facility, criteria, s.score),
  }));
}

export function count(): number {
  return load().length;
}

function computeScore(f: FacilityDetail, criteria: CaseCriteria): number {
  let score = 20;

  const CARE_MAP: Record<string, string> = {
    assisted: "Assisted Living",
    memory: "Memory Care",
    skilled: "Skilled Nursing",
    independent: "Independent Living",
  };

  if (criteria.careNeeds) {
    const target = CARE_MAP[criteria.careNeeds];
    if (target && f.careTypes.includes(target)) score += 30;
  }

  const BUDGET_RANGES: Record<string, { min: number; max: number }> = {
    under_4000: { min: 0, max: 4000 },
    "4000_6000": { min: 4000, max: 6000 },
    "6000_8000": { min: 6000, max: 8000 },
    "8000_10000": { min: 8000, max: 10000 },
    over_10000: { min: 10000, max: Infinity },
  };

  if (criteria.budget) {
    const range = BUDGET_RANGES[criteria.budget];
    if (range) {
      const minOk = (f.feeLow || 0) <= range.max;
      const maxOk = range.min === 0 || (f.feeHigh || Infinity) >= range.min;
      if (minOk && maxOk) score += 20;
      else if ((f.feeLow || 0) <= range.max * 1.2) score += 8;
    }
  }

  if (f.safetyScore >= 80) score += 8;
  else if (f.safetyScore >= 50) score += 4;

  return Math.min(100, Math.max(0, score));
}

function buildTags(f: FacilityDetail, criteria: CaseCriteria): Array<{ key: string; label: string; icon: string }> {
  const tags: Array<{ key: string; label: string; icon: string }> = [];
  const CARE_MAP: Record<string, string> = { assisted: "Assisted Living", memory: "Memory Care", skilled: "Skilled Nursing", independent: "Independent Living" };
  if (criteria.careNeeds && f.careTypes.includes(CARE_MAP[criteria.careNeeds] || "")) {
    tags.push({ key: "care_match", label: `Offers ${CARE_MAP[criteria.careNeeds]}`, icon: "✓" });
  }
  return tags;
}

function buildExplanation(f: FacilityDetail, criteria: CaseCriteria, _score: number): string {
  const parts: string[] = [];
  if (criteria.careNeeds) parts.push(`care type match`);
  if (criteria.budget) parts.push(`budget fit`);
  if (f.safetyScore >= 80) parts.push(`excellent safety record`);
  if (parts.length > 0) return `Matched on: ${parts.join(", ")}.`;
  return "Limited match — verify care type and budget directly with the community.";
}
