const { MASSACHUSETTS_FACILITIES } = require("./massachusettsFacilities");

function cleanString(value, maxLength = 140) {
  return String(value || "").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractZip(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : "";
}

function titleCaseFacilityType(label) {
  const text = cleanString(label, 80) || "Assisted living";
  return text.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function normalizeLocation(raw) {
  const text = cleanString(raw, 120);
  if (!text) return "";
  if (/,\s*MA\b/i.test(text)) return text;
  if (/^ZIP \d{5}/i.test(text)) return text;
  return `${text.replace(/,\s*$/, "")}, MA`;
}

function cityFromZipCode(zip) {
  if (zip.length !== 5) return "";
  for (const facility of MASSACHUSETTS_FACILITIES) {
    const match = facility.address.match(/\b(\d{5})\b/);
    if (match?.[1] !== zip) continue;
    const city = facility.address.split(",")[1]?.trim();
    if (city) return `${city}, MA`;
  }
  return "";
}

function resolveMagicLinkEmailContext({ zip, facilityType, location, resultSnapshot } = {}) {
  let resolvedZip = extractZip(zip);
  let resolvedFacilityType = cleanString(facilityType, 80);
  let resolvedLocation = cleanString(location, 120);
  let locationFromRegion = false;

  if (resultSnapshot?.kind === "cost_calculator") {
    resolvedFacilityType = resolvedFacilityType || resultSnapshot.inputs?.careTypeLabel;
    if (!resolvedLocation) {
      resolvedLocation = resultSnapshot.inputs?.regionLabel || "";
      locationFromRegion = Boolean(resolvedLocation);
    }
  } else if (resultSnapshot?.kind === "safest_facilities") {
    const city = resultSnapshot.inputs?.city;
    if (!resolvedLocation && city && city !== "Massachusetts") {
      resolvedLocation = normalizeLocation(city);
    }
  }

  resolvedFacilityType = titleCaseFacilityType(resolvedFacilityType);

  if (!resolvedZip && resolvedLocation) {
    const zipPrefix = resolvedLocation.match(/^ZIP (\d{5})/i);
    if (zipPrefix) resolvedZip = zipPrefix[1];
    else {
      const zipMatch = resolvedLocation.match(/\b(\d{5})\b/);
      if (zipMatch) resolvedZip = zipMatch[1];
    }
  }

  if (!resolvedLocation && resolvedZip) {
    resolvedLocation = cityFromZipCode(resolvedZip) || `ZIP ${resolvedZip}, MA`;
  } else if (
    resolvedLocation &&
    !locationFromRegion &&
    !/,\s*MA\b/i.test(resolvedLocation) &&
    !/^ZIP \d{5}/i.test(resolvedLocation)
  ) {
    resolvedLocation = normalizeLocation(resolvedLocation);
  }

  if (!resolvedLocation) resolvedLocation = "Massachusetts";

  const subjectZip = resolvedZip || extractZip(resolvedLocation) || "Massachusetts";

  return {
    facilityType: resolvedFacilityType,
    zip: subjectZip,
    location: resolvedLocation,
  };
}

function buildMagicLinkEmail(magicLink, context = {}) {
  const { facilityType, zip, location } = resolveMagicLinkEmailContext(context);
  const safeLink = escapeHtml(magicLink);
  const safeFacilityType = escapeHtml(facilityType);
  const safeZip = escapeHtml(zip);
  const safeLocation = escapeHtml(location);

  const subject = `See Results for ${facilityType} in ${zip}`;
  const html = `<p>Click <a href="${safeLink}">here</a> to login to <a href="${safeLink}">Assistedly.ai</a> to see the best assisted living facilities in ${safeLocation}.</p>`;
  const text = `Click here to login to Assistedly.ai to see the best assisted living facilities in ${location}.\n\n${magicLink}`;

  return { subject, html, text };
}

module.exports = {
  buildMagicLinkEmail,
  resolveMagicLinkEmailContext,
};
