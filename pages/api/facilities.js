import { MASSACHUSETTS_FACILITIES } from "../../lib/massachusettsFacilities";
import { buildFacilityProfile } from "../../lib/facilityProfiles";

export default function handler(req, res) {
  // Facility data is static and rarely changes — cache aggressively at CDN edge.
  // Browser gets 10min, CDN gets 24h for optimal freshness vs. speed.
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=86400, stale-while-revalidate=3600')
  res.status(200).json(MASSACHUSETTS_FACILITIES.map(buildFacilityProfile))
}
