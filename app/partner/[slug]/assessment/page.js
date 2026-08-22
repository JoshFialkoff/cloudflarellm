import { notFound } from 'next/navigation'
import PartnerAssessmentFlow from '../../../../components/partner/PartnerAssessmentFlow'
import PARTNERS from '../../../../data/partners.json'

export function generateStaticParams() {
  return PARTNERS.partners
    .filter(p => p.active)
    .map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = params
  const partner = PARTNERS.partners.find(p => p.slug === slug && p.active)
  if (!partner) return {}

  return {
    title: `Care Assessment | ${partner.name}`,
    description: `A short, independent care-transition assessment. Understand your options with transparent, state-verified data.`,
    // Inherits index/follow from root layout — assessment pages are part of partner journey
  }
}

export default function PartnerAssessmentPage({ params }) {
  const { slug } = params
  const partner = PARTNERS.partners.find(p => p.slug === slug && p.active)

  if (!partner) {
    notFound()
  }

  return <PartnerAssessmentFlow partner={partner} />
}
