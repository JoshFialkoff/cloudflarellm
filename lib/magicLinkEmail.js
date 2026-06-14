const {
  cityFromZipCode,
  extractZip,
  locationZip,
  resolveLocationFromZip,
} = require("./zipLocation");

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
  } else if (resultSnapshot?.kind === "wizard_search") {
    resolvedFacilityType = resolvedFacilityType || resultSnapshot.inputs?.careTypeLabel;
    if (!resolvedZip) resolvedZip = extractZip(resultSnapshot.inputs?.zip);
    if (!resolvedLocation) resolvedLocation = cleanString(resultSnapshot.inputs?.location, 120);
  }

  resolvedFacilityType = titleCaseFacilityType(resolvedFacilityType);

  if (resolvedZip) {
    const locationZipCode = locationZip(resolvedLocation);
    if (!locationZipCode || locationZipCode !== resolvedZip) {
      resolvedLocation = resolveLocationFromZip(resolvedZip, resolvedLocation || "Massachusetts");
    }
  }

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

  const facilityPhrase = /\bfacilit/i.test(facilityType)
    ? facilityType
    : `${facilityType} facilities`;
  const safeFacilityPhrase = escapeHtml(facilityPhrase);

  const subject = `See Results for ${facilityType} in ${zip}`;
  const html = `<p>Click <a href="${safeLink}">here</a> to login to <a href="${safeLink}">Assistedly.ai</a> to see the best ${safeFacilityPhrase} in ${safeLocation}.</p>`;
  const text = `Click here to login to Assistedly.ai to see the best ${facilityPhrase} in ${location}.\n\n${magicLink}`;

  return { subject, html, text };
}

module.exports = {
  buildMagicLinkEmail,
  resolveMagicLinkEmailContext,
};
