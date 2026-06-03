import { notFound } from 'next/navigation'
import MassachusettsFacilityPage from '../../../../components/MassachusettsFacilityPage'
import { MASSACHUSETTS_FACILITIES } from '../../../../lib/massachusettsFacilities'
import {
  buildFacilityMetadata,
  formatTownLabel,
} from '../../../../lib/massachusettsRouteUtils'

const facilitiesByTownAndSlug = MASSACHUSETTS_FACILITIES.reduce((acc, facility) => {
  acc[`${facility.town}/${facility.slug}`] = {
    ...facility,
    townLabel: formatTownLabel(facility.town),
  }
  return acc
}, {})

export function generateStaticParams() {
  return MASSACHUSETTS_FACILITIES.map((facility) => ({
    town: facility.town,
    facility: facility.slug,
  }))
}

export async function generateMetadata({ params }) {
  const { town, facility } = await params
  const pageFacility = facilitiesByTownAndSlug[`${town}/${facility}`]

  if (!pageFacility) return {}

  return buildFacilityMetadata(pageFacility)
}

export default async function MassachusettsFacilityRoutePage({ params }) {
  const { town, facility } = await params
  const pageFacility = facilitiesByTownAndSlug[`${town}/${facility}`]

  if (!pageFacility) {
    notFound()
  }

  return <MassachusettsFacilityPage facility={pageFacility} />
}
