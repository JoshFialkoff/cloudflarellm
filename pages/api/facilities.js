import { MASSACHUSETTS_FACILITIES } from "../../lib/massachusettsFacilities";
import { buildFacilityProfile } from "../../lib/facilityProfiles";

export default function handler(req, res) {
  res.status(200).json(MASSACHUSETTS_FACILITIES.map(buildFacilityProfile))
}
