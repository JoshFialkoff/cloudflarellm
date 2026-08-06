const SNAPSHOT_VERSION = 1;
const MAX_FACILITIES = 6;

const CARE_LABELS = {
  assisted: "Assisted living",
  memory: "Memory care",
  skilled: "Skilled nursing",
};

const REGION_LABELS = {
  boston: "Boston / inner suburbs",
  metroWest: "MetroWest / North Shore / South Shore",
  central: "Central Massachusetts",
  western: "Western Massachusetts",
};

function cleanString(value, maxLength = 140) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanNumber(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanBoolean(value) {
  return Boolean(value);
}

function cleanFacility(facility) {
  if (!facility || typeof facility !== "object") return null;
  const name = cleanString(facility.name);
  if (!name) return null;
  const memoryCare = cleanString(facility.memoryCare, 12);
  const careTypes = Array.isArray(facility.careTypes)
    ? facility.careTypes.map((type) => cleanString(type, 40)).filter(Boolean).slice(0, 4)
    : memoryCare.toLowerCase() === "yes"
      ? ["Memory Care"]
      : [];
  return {
    name,
    slug: cleanString(facility.slug, 100),
    town: cleanString(facility.town, 80),
    address: cleanString(facility.address, 180),
    safetyScore: cleanNumber(facility.safetyScore),
    monthlyMin: cleanNumber(facility.monthlyMin),
    monthlyMax: cleanNumber(facility.monthlyMax),
    careTypes,
    memoryCare,
  };
}

function sanitizeCalculatorSnapshot(raw) {
  const careType = cleanString(raw.careType, 40);
  const region = cleanString(raw.region, 40);
  const estimateLow = cleanNumber(raw.estimateLow);
  const estimateHigh = cleanNumber(raw.estimateHigh);
  const budget = cleanNumber(raw.budget);

  return {
    kind: "cost_calculator",
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    title: "Assisted living savings estimate",
    inputs: {
      careType,
      careTypeLabel: CARE_LABELS[careType] || careType || "Not selected",
      region,
      regionLabel: REGION_LABELS[region] || region || "Not selected",
      monthlyBudget: budget,
      medicationManagement: cleanBoolean(raw.medication),
      incontinenceSupport: cleanBoolean(raw.incontinence),
      mobilitySupport: cleanBoolean(raw.mobility),
    },
    results: {
      estimateLow,
      estimateHigh,
      budgetGap: Math.max(0, estimateLow - budget),
      withinBudget: budget >= estimateLow,
    },
  };
}

function sanitizeSafestSnapshot(raw) {
  const facilities = Array.isArray(raw.facilities)
    ? raw.facilities.map(cleanFacility).filter(Boolean).slice(0, MAX_FACILITIES)
    : [];

  return {
    kind: "safest_facilities",
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    title: "Safest assisted living comparison",
    inputs: {
      city: cleanString(raw.city, 100) || "Massachusetts",
    },
    results: {
      rankedFacilities: facilities,
    },
  };
}

function sanitizeWizardSearchSnapshot(raw) {
  const zip = cleanString(raw.zip, 10).replace(/\D/g, "").slice(0, 5);
  const careType = cleanString(raw.careType, 40);
  const facilities = Array.isArray(raw.facilities)
    ? raw.facilities.map(cleanFacility).filter(Boolean).slice(0, MAX_FACILITIES)
    : [];
  const location =
    cleanString(raw.location, 120) || (zip.length === 5 ? `ZIP ${zip}, MA` : "Massachusetts");

  return {
    kind: "wizard_search",
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    title: `${CARE_LABELS[careType] || cleanString(raw.careTypeLabel, 80) || "Assisted living"} near ${zip || location}`,
    inputs: {
      zip,
      careType,
      careTypeLabel: CARE_LABELS[careType] || cleanString(raw.careTypeLabel, 80) || "Assisted living",
      location,
      monthlyBudget: cleanNumber(raw.monthlyBudget),
      urgency: cleanString(raw.urgency, 80),
      summaryIntro: cleanString(raw.summaryIntro, 240),
    },
    results: {
      rankedFacilities: facilities,
    },
  };
}

function sanitizeResultSnapshot(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.kind === "cost_calculator") return sanitizeCalculatorSnapshot(raw);
  if (raw.kind === "safest_facilities") return sanitizeSafestSnapshot(raw);
  if (raw.kind === "wizard_search") return sanitizeWizardSearchSnapshot(raw);
  return null;
}

module.exports = {
  sanitizeResultSnapshot,
};
