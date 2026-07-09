import { notFound } from 'next/navigation'
import MassachusettsFacilityPage from '../../../../components/MassachusettsFacilityPage'
import { MASSACHUSETTS_FACILITIES } from '../../../../lib/massachusettsFacilities'
import {
  buildFacilityMetadata,
  facilityDeepDiveHref,
  formatTownLabel,
  resolveFacilityTab,
} from '../../../../lib/massachusettsRouteUtils'
import { buildFacilitySourceAttestations } from '../../../../lib/facilitySourceAttestation'
import { buildNativeFacilityDeepDiveReport } from '../../../../lib/nativeFacilityDeepDive'

const facilitiesByTownAndSlug = MASSACHUSETTS_FACILITIES.reduce((acc, facility) => {
  acc[`${facility.town}/${facility.slug}`] = {
    ...facility,
    townLabel: formatTownLabel(facility.town),
  }
  return acc
}, {})

export function generateStaticParams() {
  return MASSACHUSETTS_FACILITIES.filter((facility) => facility.town && facility.town.length >= 2).map((facility) => ({
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

export default async function MassachusettsFacilityRoutePage({ params, searchParams }) {
  const { town, facility } = await params
  const query = await searchParams
  const pageFacility = facilitiesByTownAndSlug[`${town}/${facility}`]
  const activeTab = resolveFacilityTab(query?.tab)
  const shouldGenerateDeepDive = query?.generate === '1' && activeTab === 'full-report'
  const deepDiveReport =
    shouldGenerateDeepDive && pageFacility ? buildNativeFacilityDeepDiveReport(pageFacility) : ''
  const sourceAttestations = buildFacilitySourceAttestations(pageFacility?.slug)

  if (!pageFacility) {
    notFound()
  }

  return (
    <MassachusettsFacilityPage
      facility={pageFacility}
      activeTab={activeTab}
      sourceAttestations={sourceAttestations}
      deepDiveReport={deepDiveReport}
      deepDiveGenerateHref={facilityDeepDiveHref(`/massachusetts/${town}/${facility}`)}
      authVerified={query?.auth_verified === '1'}
    />
  )
}
