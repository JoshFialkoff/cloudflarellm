import { notFound } from 'next/navigation'
import Head from 'next/head'
import PartnerLandingPage from '../../../components/partner/PartnerLandingPage'
import PARTNERS from '../../../data/partners.json'

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
    title: `Care Snapshot with ${partner.name} | Assistedly.ai`,
    description: `Understand your care options independently. ${partner.name} and Assistedly help families navigate what comes next when staying at home is getting harder.`,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://assistedly.ai/partner/${slug}`,
    },
    openGraph: {
      title: `Care Snapshot with ${partner.name}`,
      description: `An independent way to understand care options — from ${partner.shortName} and Assistedly.ai`,
      url: `https://assistedly.ai/partner/${slug}`,
      siteName: 'Assistedly.ai',
      type: 'website',
    },
  }
}

export default function PartnerPage({ params }) {
  const { slug } = params
  const partner = PARTNERS.partners.find(p => p.slug === slug && p.active)

  if (!partner) {
    notFound()
  }

  return (
    <>
      <PartnerLandingPage partner={partner} />
    </>
  )
}
