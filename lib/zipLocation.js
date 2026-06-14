const { MASSACHUSETTS_FACILITIES } = require("./massachusettsFacilities");

function extractZip(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : "";
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

function resolveLocationFromZip(zip, fallback = "Massachusetts") {
  const normalized = extractZip(zip);
  if (normalized.length !== 5) return fallback;
  return cityFromZipCode(normalized) || `ZIP ${normalized}, MA`;
}

function locationZip(location) {
  const text = String(location || "");
  const prefix = text.match(/^ZIP (\d{5})/i);
  if (prefix) return prefix[1];
  const match = text.match(/\b(\d{5})\b/);
  return match?.[1] || "";
}

module.exports = {
  cityFromZipCode,
  extractZip,
  locationZip,
  resolveLocationFromZip,
};
