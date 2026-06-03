import { notFound } from 'next/navigation'
import LuxuryLandingPage from '../../../../components/LuxuryLandingPage'
import { LUXURY_ASSISTED_LIVING_PAGES_BY_TOWN } from '../../../../lib/luxuryAssistedLivingPages'
import { buildLuxuryLandingMetadata } from '../../../../lib/massachusettsRouteUtils'

export function generateStaticParams() {
  return Object.keys(LUXURY_ASSISTED_LIVING_PAGES_BY_TOWN).map((town) => ({ town }))
}

export async function generateMetadata({ params }) {
  const { town } = await params
  const page = LUXURY_ASSISTED_LIVING_PAGES_BY_TOWN[town]

  if (!page) return {}

  return buildLuxuryLandingMetadata(page)
}

export default async function MassachusettsLuxuryLandingPage({ params }) {
  const { town } = await params
  const page = LUXURY_ASSISTED_LIVING_PAGES_BY_TOWN[town]

  if (!page) {
    notFound()
  }

  return <LuxuryLandingPage page={page} />
}
