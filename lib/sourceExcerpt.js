const { MASSACHUSETTS_FACILITIES } = require('./massachusettsFacilities')

function getFacilityBySlug(slug) {
  return MASSACHUSETTS_FACILITIES.find((facility) => facility.slug === slug) || null
}

function buildSourceExcerpt(slug, record = {}) {
  const explicit = String(record.excerpt || '').trim()
  if (explicit) return explicit

  const facility = getFacilityBySlug(slug)
  if (!facility) return 'Source excerpt is not available for this record yet.'

  const fieldKeys = Array.isArray(record.fieldKeys) ? record.fieldKeys : []
  if (fieldKeys.includes('complianceHistory') || String(record.id || '').includes('compliance')) {
    const latest = Array.isArray(facility.complianceHistory) ? facility.complianceHistory[0] : null
    if (!latest) {
      return 'No Massachusetts inspection excerpt is listed for this facility yet.'
    }
    return `${latest.date} (${latest.type}): ${latest.findings} [${latest.status}]. Profile compliance rating: ${facility.complianceRating}.`
  }

  if (fieldKeys.includes('about')) {
    const about = String(facility.about || '').trim()
    if (!about) return 'Facility profile excerpt is not available yet.'
    return about.length > 320 ? `${about.slice(0, 317)}…` : about
  }

  return 'Verified source excerpt is not configured for this record yet.'
}

module.exports = {
  buildSourceExcerpt,
}
