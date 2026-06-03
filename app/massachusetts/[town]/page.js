import { notFound, permanentRedirect } from 'next/navigation'
import { LUXURY_ASSISTED_LIVING_PAGES_BY_TOWN } from '../../../lib/luxuryAssistedLivingPages'

export function generateStaticParams() {
  return Object.keys(LUXURY_ASSISTED_LIVING_PAGES_BY_TOWN).map((town) => ({ town }))
}

export default async function MassachusettsTownRedirectPage({ params }) {
  const { town } = await params

  if (!LUXURY_ASSISTED_LIVING_PAGES_BY_TOWN[town]) {
    notFound()
  }

  permanentRedirect(`/massachusetts/${town}/luxury-assisted-living`)
}
