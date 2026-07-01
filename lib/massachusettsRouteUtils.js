const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://assistedly.ai'

export function formatTownLabel(town = '') {
  return town
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const FACILITY_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'compliance', label: 'Compliance History' },
  { id: 'amenities', label: 'Amenities' },
  { id: 'full-report', label: 'AI Report' },
]

export function resolveFacilityTab(tab) {
  const id = String(tab || '').trim()
  return FACILITY_TABS.some((entry) => entry.id === id) ? id : 'overview'
}

export function facilityTabHref(canonicalPath, tab) {
  return tab === 'overview' ? canonicalPath : `${canonicalPath}?tab=${tab}`
}

export function facilityDeepDiveHref(canonicalPath) {
  return `${facilityTabHref(canonicalPath, 'full-report')}&generate=1`
}

export function absoluteSiteUrl(path) {
  return new URL(path, siteUrl).toString()
}

export function buildLuxuryLandingMetadata(page) {
  const path = `/massachusetts/${page.town}/luxury-assisted-living`
  const title = page.title_tag || page.h1 || 'Luxury Assisted Living'
  const description = page.meta_description || page.hero_subtitle || ''

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      type: 'website',
    },
  }
}

export function buildFacilityMetadata(facility) {
  const townLabel = formatTownLabel(facility.town)
  const path = `/massachusetts/${facility.town}/${facility.slug}`
  const title = `${facility.name} in ${townLabel}, MA | Assisted Living & Care Details`
  const description = `Compare pricing, care types, amenities, and compliance history for ${facility.name} in ${townLabel}, Massachusetts.`

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: `${facility.name} in ${townLabel}, MA`,
      description: `See care options, monthly rates, and compliance history for ${facility.name}.`,
      url: path,
      type: 'website',
    },
  }
}
