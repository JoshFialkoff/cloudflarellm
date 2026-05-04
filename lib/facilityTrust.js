function deficiencyCount(facility) {
  return (facility.complianceHistory || []).filter((row) =>
    /deficien|partial|in progress/i.test(`${row.findings} ${row.status}`),
  ).length;
}

export function facilitySafetyScore(facility) {
  const compliance = facility.complianceRating === "Excellent" ? 34 : facility.complianceRating === "Good" ? 24 : 10;
  const deficiencyPenalty = Math.min(24, deficiencyCount(facility) * 4);
  const rating = Math.round((facility.rating || 0) * 8);
  const affordability = facility.monthlyMin <= 4500 ? 14 : facility.monthlyMin <= 6000 ? 9 : 4;
  return Math.max(0, Math.min(100, compliance + rating + affordability - deficiencyPenalty + 12));
}

export function facilityTrustMetrics(facility) {
  const deficiencies = deficiencyCount(facility);
  const occupancy = Math.max(68, Math.min(96, Math.round(78 + (facility.rating - 4) * 8)));
  const transferRisk = facility.careTypes.includes("Memory Care")
    ? "Ask about hospital transfers and overnight supervision"
    : "Lower acuity profile, still confirm transfer policy";
  const staffing = facility.complianceRating === "Excellent"
    ? "Strong inspection pattern"
    : facility.complianceRating === "Good"
      ? "Generally stable, verify current staffing"
      : "Needs closer review before touring";

  return [
    { label: "Safety score", value: `${facilitySafetyScore(facility)}/100`, why: "Combines compliance pattern, pricing pressure, and resident review signal." },
    { label: "Staffing signal", value: staffing, why: "Staff consistency affects falls, medication support, and dementia supervision." },
    { label: "Estimated occupancy", value: `${occupancy}%`, why: "High occupancy can mean demand, but may reduce room choice or negotiation room." },
    { label: "Recent deficiencies", value: `${deficiencies}`, why: "Repeated deficiencies are a prompt to ask what changed operationally." },
    { label: "Transfer risk", value: transferRisk, why: "Unexpected hospital transfers are disruptive and expensive for families." },
  ];
}

export function facilityAiSummary(facility) {
  const score = facilitySafetyScore(facility);
  const price = `$${facility.monthlyMin.toLocaleString()}-${facility.monthlyMax.toLocaleString()}/mo`;
  if (score >= 82) {
    return `${facility.name} looks like a strong first-call option for families near ${facility.town.replace(/-/g, " ")}. The compliance record is favorable, pricing starts around ${price}, and the next questions should focus on current availability, staffing by shift, and what fees are not included.`;
  }
  if (score >= 65) {
    return `${facility.name} may be worth comparing, but families should verify recent staffing, care-level pricing, and how inspection issues were corrected. Use this page as a call checklist before scheduling a tour.`;
  }
  return `${facility.name} is a higher-caution option. The lower starting price may help budget fit, but families should ask direct questions about deficiencies, staffing stability, safety incidents, and whether current operations have improved.`;
}

export function rankedFacilities(facilities, city = "") {
  const normalized = city.trim().toLowerCase();
  return [...facilities]
    .filter((facility) => {
      if (!normalized) return true;
      return facility.address.toLowerCase().includes(normalized) || facility.town.toLowerCase().includes(normalized.replace(/\s+/g, "-"));
    })
    .sort((a, b) => facilitySafetyScore(b) - facilitySafetyScore(a));
}
