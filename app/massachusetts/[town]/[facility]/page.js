import { notFound, permanentRedirect } from 'next/navigation'
import { MASSACHUSETTS_FACILITIES_BY_TOWN_AND_SLUG } from '../../../../lib/massachusettsFacilities'

export function generateStaticParams() {
  return Object.keys(MASSACHUSETTS_FACILITIES_BY_TOWN_AND_SLUG)
    .filter((key) => {
      const [town] = key.split('/')
      return town && town.length >= 2
    })
    .map((key) => {
      const [town, facility] = key.split('/')
      return { town, facility }
    })
}

export default async function MassachusettsFacilityLegacyRoutePage({ params }) {
  const { town, facility } = await params
  const pageFacility = MASSACHUSETTS_FACILITIES_BY_TOWN_AND_SLUG[`${town}/${facility}`]

  if (!pageFacility) {
    notFound()
  }

  permanentRedirect(`/facility/ma/${pageFacility.slug}`)
}
