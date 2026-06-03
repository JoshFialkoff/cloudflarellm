import { MASSACHUSETTS_FACILITIES } from './massachusettsFacilities'
import { LUXURY_ASSISTED_LIVING_PAGES } from './luxuryAssistedLivingPages'

function formatTownLabel(town) {
  return town
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const facilitiesByTown = MASSACHUSETTS_FACILITIES.reduce((acc, facility) => {
  if (!acc[facility.town]) acc[facility.town] = []
  acc[facility.town].push({
    ...facility,
    townLabel: formatTownLabel(facility.town),
  })
  return acc
}, {})

export const MASSACHUSETTS_TOWN_ENGINE_PAGES = LUXURY_ASSISTED_LIVING_PAGES.map((page) => ({
  ...page,
  townLabel: formatTownLabel(page.town),
  facilityCount: facilitiesByTown[page.town]?.length || 0,
}))

export const MASSACHUSETTS_FEATURED_FACILITIES = MASSACHUSETTS_FACILITIES.map((facility) => ({
  ...facility,
  townLabel: formatTownLabel(facility.town),
}))

export const MASSACHUSETTS_CONTENT_ENGINE_OVERVIEW = {
  townCount: MASSACHUSETTS_TOWN_ENGINE_PAGES.length,
  facilityCount: MASSACHUSETTS_FEATURED_FACILITIES.length,
}
