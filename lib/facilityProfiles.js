import { facilityAiSummary, facilitySafetyScore, facilityTrustMetrics } from "./facilityTrust";

function splitAddress(address = "") {
  const [street = "", city = "", stateZip = ""] = String(address).split(",").map((part) => part.trim());
  const [state = "MA", zip = ""] = stateZip.split(/\s+/);
  return { street, city, state, zip };
}

function websiteFromEmail(email = "") {
  const domain = String(email).split("@")[1] || "";
  return domain ? `https://www.${domain.replace(/^www\./, "")}` : "";
}

function latestComplianceRecord(facility) {
  return Array.isArray(facility.complianceHistory) && facility.complianceHistory.length
    ? facility.complianceHistory[0]
    : null;
}

function careIntensity(facility) {
  if (facility.careTypes.includes("Skilled Nursing")) return "High acuity support available";
  if (facility.careTypes.includes("Memory Care")) return "Moderate to high care intensity";
  return "Primarily assisted living support";
}

export function buildFacilityProfile(facility) {
  const { street, city, state, zip } = splitAddress(facility.address);
  const trustMetrics = facilityTrustMetrics(facility);
  const occupancyMetric = trustMetrics.find((metric) => metric.label === "Estimated occupancy");
  const staffingMetric = trustMetrics.find((metric) => metric.label === "Staffing signal");
  const complianceMetric = trustMetrics.find((metric) => metric.label === "Recent deficiencies");
  const latestRecord = latestComplianceRecord(facility);
  const facilityType =
    facility.careTypes.includes("Assisted Living")
      ? "Assisted Living Community"
      : facility.careTypes[0] || "Senior Living Community";

  return {
    ...facility,
    website: facility.website || websiteFromEmail(facility.email),
    profile: {
      name: facility.name,
      address: street,
      city,
      state,
      zip,
      phone: facility.phone,
      website: facility.website || websiteFromEmail(facility.email),
      facilityType,
      memoryCare: facility.careTypes.includes("Memory Care") ? "Available" : "Not listed",
      pricingSummary: `$${Number(facility.monthlyMin || 0).toLocaleString()}-$${Number(facility.monthlyMax || 0).toLocaleString()} per month based on care level and apartment type.`,
      staffingSummary: staffingMetric
        ? `${staffingMetric.value}. Families should confirm shift coverage, weekend staffing, and agency usage.`
        : "Ask how many caregivers, med techs, and nurses are on each shift.",
      regulatorySummary: latestRecord
        ? `${latestRecord.date}: ${latestRecord.findings} (${latestRecord.status}). ${complianceMetric?.why || ""}`.trim()
        : "No recent Massachusetts compliance summary is currently listed.",
      aiSummary: facilityAiSummary(facility),
      verificationStatus:
        facility.complianceRating === "Needs Improvement"
          ? "Needs updated operator clarification"
          : "Reviewed against Massachusetts public data and on-site profile inputs",
      lastUpdated: latestRecord?.date || "Recently updated",
      careIntensity: careIntensity(facility),
      estimatedOccupancy: occupancyMetric?.value || "Unavailable",
      complianceIndicators: complianceMetric?.value || "0",
      crimeRating: facility.crimeRating || null,
      culturalAffinity: Array.isArray(facility.culturalAffinity) ? facility.culturalAffinity : [],
    },
  };
}

export function buildComparisonRows(facilities) {
  return [
    {
      category: "Cost",
      values: facilities.map((facility) => `$${Number(facility.monthlyMin || 0).toLocaleString()}-$${Number(facility.monthlyMax || 0).toLocaleString()}/mo`),
      description: "Published starting ranges and likely monthly budget band.",
    },
    {
      category: "Staffing",
      values: facilities.map(
        (facility) =>
          buildFacilityProfile(facility).profile.staffingSummary.split(". ")[0],
      ),
      description: "Inspection-informed staffing signal plus follow-up questions.",
    },
    {
      category: "Care intensity",
      values: facilities.map((facility) => buildFacilityProfile(facility).profile.careIntensity),
      description: "Best fit based on listed care types and acuity mix.",
    },
    {
      category: "Memory care",
      values: facilities.map((facility) => buildFacilityProfile(facility).profile.memoryCare),
      description: "Whether dedicated memory care support is listed.",
    },
    {
      category: "Occupancy",
      values: facilities.map((facility) => buildFacilityProfile(facility).profile.estimatedOccupancy),
      description: "Demand signal that can affect room choice and negotiating room.",
    },
    {
      category: "Compliance indicators",
      values: facilities.map(
        (facility) =>
          `${facility.complianceRating} · ${buildFacilityProfile(facility).profile.complianceIndicators} flagged`,
      ),
      description: "Recent inspection signal and deficiency count prompt.",
    },
  ];
}

export function buildComparisonSummary(facilities) {
  if (!facilities.length) {
    return [
      "Choose at least two facilities to compare cost, staffing, care intensity, memory care, occupancy, and compliance indicators.",
      "Registered users unlock expanded comparison detail and premium members can save full reports.",
      "Use the AI assistant below for plain-English explanations of pricing, compliance, and tour questions.",
    ];
  }
  const sorted = [...facilities].sort((a, b) => a.monthlyMin - b.monthlyMin);
  const lowestCost = sorted[0];
  const highestTrust = [...facilities].sort(
    (a, b) => facilitySafetyScore(b) - facilitySafetyScore(a),
  )[0];

  return [
    `${lowestCost.name} appears to offer the lowest published starting cost in this group.`,
    `${highestTrust.name} should still be reviewed alongside staffing, occupancy, and care-intensity fit before touring.`,
    "Use the AI assistant below for plain-English explanations of compliance, pricing, and tour questions. Assistedly.ai does not provide medical advice.",
  ];
}
