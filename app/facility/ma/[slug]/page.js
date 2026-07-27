import { notFound } from 'next/navigation'
import MassachusettsFacilityPage from '../../../../components/MassachusettsFacilityPage'
import { MASSACHUSETTS_FACILITIES_BY_SLUG } from '../../../../lib/massachusettsFacilities'
import {
  buildFacilityMetadata,
  facilityDeepDiveHref,
  formatTownLabel,
  resolveFacilityTab,
} from '../../../../lib/massachusettsRouteUtils'
import { buildFacilitySourceAttestations } from '../../../../lib/facilitySourceAttestation'
import { buildNativeFacilityDeepDiveReport } from '../../../../lib/nativeFacilityDeepDive'

export function generateStaticParams() {
  return Object.values(MASSACHUSETTS_FACILITIES_BY_SLUG)
    .filter((facility) => facility.slug && facility.slug.length >= 2)
    .map((facility) => ({
      slug: facility.slug,
    }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const facility = MASSACHUSETTS_FACILITIES_BY_SLUG[slug]
  if (!facility) return {}
  return buildFacilityMetadata(facility)
}

export default async function FacilityRoutePage({ params, searchParams }) {
  const { slug } = await params
  const query = await searchParams

  const facility = MASSACHUSETTS_FACILITIES_BY_SLUG[slug]

  if (!facility) {
    notFound()
  }

  const pageFacility = {
    ...facility,
    townLabel: formatTownLabel(facility.town),
  }

  const activeTab = resolveFacilityTab(query?.tab)
  const shouldGenerateDeepDive = query?.generate === '1' && activeTab === 'full-report'
  const deepDiveReport =
    shouldGenerateDeepDive ? buildNativeFacilityDeepDiveReport(pageFacility) : ''
  const sourceAttestations = buildFacilitySourceAttestations(pageFacility?.slug)
  const canonicalPath = `/facility/ma/${slug}`

  return (
    <MassachusettsFacilityPage
      facility={pageFacility}
      activeTab={activeTab}
      sourceAttestations={sourceAttestations}
      deepDiveReport={deepDiveReport}
      deepDiveGenerateHref={facilityDeepDiveHref(canonicalPath)}
      authVerified={query?.auth_verified === '1'}
    />
  )
}
