const facilitySourceRegistry = require("../data/facility-source-records.json");
const { buildNocoRowDashboardUrl, nocoDashboardConfigured } = require("./nocoDashboard");
const { createSourceToken } = require("./sourceAccessToken");
const { buildSourceExcerpt } = require("./sourceExcerpt");

function getFacilityRegistryEntry(slug) {
  const key = String(slug || "").trim();
  const entry = facilitySourceRegistry[key];
  if (!entry || typeof entry !== "object") return null;
  const sources = Array.isArray(entry.sources) ? entry.sources : [];
  return {
    facilityName: String(entry.facilityName || "").trim() || key,
    town: String(entry.town || "").trim(),
    sources,
  };
}

function getFacilitySourceRecords(slug) {
  return getFacilityRegistryEntry(slug)?.sources || [];
}

function getFacilitySourceRecord(slug, sourceId) {
  return getFacilitySourceRecords(slug).find((record) => record.id === sourceId) || null;
}

function buildFacilitySourceAttestations(slug) {
  if (!nocoDashboardConfigured()) return [];

  return getFacilitySourceRecords(slug)
    .filter((record) => buildNocoRowDashboardUrl(record))
    .map((record) => {
      const token = createSourceToken(slug, record.id);
      return {
        id: record.id,
        label: record.label,
        scope: record.scope,
        fieldKeys: Array.isArray(record.fieldKeys) ? record.fieldKeys : [],
        lastUpdated: record.lastUpdated || "",
        tokenPath: `/sources/${token}`,
      };
    });
}

function resolveFacilitySourceAttestation(slug, sourceId) {
  const registry = getFacilityRegistryEntry(slug);
  const record = getFacilitySourceRecord(slug, sourceId);
  if (!registry || !record) return null;

  const dashboardUrl = buildNocoRowDashboardUrl(record);
  if (!dashboardUrl) return null;

  return {
    facilityName: registry.facilityName,
    facilitySlug: slug,
    town: registry.town,
    label: record.label,
    scope: record.scope,
    fieldKeys: Array.isArray(record.fieldKeys) ? record.fieldKeys : [],
    lastUpdated: record.lastUpdated || "",
    excerpt: buildSourceExcerpt(slug, record),
    dashboardUrl,
  };
}

module.exports = {
  buildFacilitySourceAttestations,
  getFacilitySourceRecords,
  resolveFacilitySourceAttestation,
};
