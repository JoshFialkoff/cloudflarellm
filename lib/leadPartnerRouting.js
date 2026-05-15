/**
 * Partner routing for "Get matched" leads (Phase 2 — manual fulfillment).
 * Price bands are internal-only for ops / Discord — never shown to families.
 */

export const PARTNER_TRACK_IDS = /** @type {const} */ ([
  "placement",
  "care_advisor",
  "medicaid_planner",
]);

/** @type {Record<string, { title: string; blurb: string; routeTo: string; internalPriceBand: string }>} */
export const PARTNER_TRACKS = {
  placement: {
    title: "Placement help",
    blurb: "Intro to senior living placement specialists who know availability, tours, and move-in logistics in Massachusetts.",
    routeTo: "Placement agencies",
    internalPriceBand: "$150–$300",
  },
  care_advisor: {
    title: "Care advisor",
    blurb: "Talk with an advisor about care levels, safety questions, and how to compare options without pressure.",
    routeTo: "Care advisors",
    internalPriceBand: "$50–$175",
  },
  medicaid_planner: {
    title: "Medicaid / MassHealth planning",
    blurb: "Connect with planners who focus on eligibility, spend-down, and MassHealth-funded care paths.",
    routeTo: "Medicaid planners",
    internalPriceBand: "$200–$300",
  },
};

/** @param {string} value */
export function normalizePartnerTrack(value) {
  const v = String(value || "").trim();
  return PARTNER_TRACK_IDS.includes(v) ? v : "";
}
