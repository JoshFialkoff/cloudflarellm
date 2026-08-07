/**
 * Page-level SEO metadata for Assistedly.ai
 * Compatible with Next.js App Router (metadata export) and Pages Router (next/head)
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://assistedly.ai'
const brand = 'Assistedly'

// ─── Primary keyword targets ───
// 1. assisted living broker alternatives
// 2. assisted living search sites that don't sell your data
// 3. AI assisted living matching
// 4. Massachusetts assisted living costs

const defaults = {
  siteUrl,
  brand,
  titleTemplate: '%s | Assistedly',
  defaultTitle: 'Assistedly',
}

export const HOME = {
  path: '/',
  title: 'Assistedly.ai | AI Assisted Living & Memory Care Matching',
  metaTitle: 'Assistedly.ai | AI Assisted Living & Memory Care Matching',
  description:
    'The transparent assisted living broker alternative in Massachusetts. AI-powered assisted living and memory care matching. Privacy-first, unbiased, and transparent pricing.',
  keywords: [
    'AI assisted living matching',
    'assisted living broker alternatives',
    "assisted living search sites that don't sell your data",
    'Massachusetts assisted living',
    'memory care matching Massachusetts',
    'unbiased assisted living search',
    'assisted living cost calculator',
  ],
  ogImage: '/aialc-hero-banner.png',
  h1: 'Unbiased AI Finds Best Assisted Living in Massachusetts',
  h2s: [
    'How Our AI Matching Works',
    'Why Privacy-First Search Matters',
    'Transparent Pricing for Families',
    'Massachusetts Care Access Initiative',
  ],
  h3s: [
    'Transparent Methodology',
    'No Pay-to-Play Rankings',
    'Compare Costs & Inspection Reports',
    'Start Your Free Search',
  ],
}

export const HOW_WE_MAKE_MONEY = {
  path: '/how-we-make-money',
  title: 'How We Make Money | Assistedly.ai',
  metaTitle: 'How We Make Money | Assistedly.ai',
  description:
    'Assistedly.ai explains our transparent business model. See how we fund operations without selling placements or compromising unbiased rankings in Massachusetts assisted living.',
  keywords: [
    'how assisted living referral sites make money',
    'assisted living broker alternatives',
    'transparent assisted living fees',
    'Massachusetts assisted living matching',
  ],
  ogImage: '/aialc-hero-banner.png',
  h1: 'Our Transparent Business Model',
  h2s: [
    'How the Platform Is Funded',
    'Privacy-First Monetization',
    'Where Subscription Fees Go',
  ],
  h3s: [
    'Cost Calculator',
    'Pricing Tiers',
    'How We Differ From Traditional Brokers',
  ],
}

export const CARE_ACCESS = {
  path: '/care-access-initiative',
  title: 'Care Access Initiative | Assistedly.ai',
  metaTitle: 'Care Access Initiative | Assistedly.ai',
  description:
    'Assistedly.ai supports a care-access initiative to expand assisted living and memory care access in Massachusetts. Learn how platform usage contributes to community outcomes.',
  keywords: [
    'assisted living access initiative',
    'Massachusetts assisted living funding',
    'AI assisted living matching community impact',
    'affordable assisted living programs Massachusetts',
  ],
  ogImage: '/aialc-hero-banner.png',
  h1: 'Expanding Care Access in Massachusetts',
  h2s: [
    'How the Platform Supports Access',
    'Community Partnerships',
    'Impact Metrics',
  ],
  h3s: [
    'Current Grantees',
    'Apply for Funding',
    'Transparency Reports',
  ],
}

export const FAQ = {
  path: '/faq',
  title: 'FAQ | Assistedly.ai',
  metaTitle: 'FAQ | Assistedly.ai',
  description:
    'Get answers about AI assisted living and memory care matching, privacy practices, transparent pricing, and Massachusetts data from Assistedly.ai.',
  keywords: [
    'AI assisted living matching FAQ',
    "assisted living search sites that don't sell your data",
    'assisted living broker alternatives FAQ',
    'Massachusetts assisted living questions',
  ],
  ogImage: '/aialc-hero-banner.png',
  h1: 'Frequently Asked Questions',
  h2s: [
    'Getting Started',
    'Privacy & Data',
    'Our Business Model',
    'Care Access Initiative',
    'Massachusetts Listings',
  ],
  h3s: [
    'Is my personal information sold to facilities?',
    'How does the AI matching work?',
    'How does Assistedly.ai make money?',
    'Which facilities qualify for listings?',
  ],
}

export const SEARCH = {
  path: '/search',
  title: 'Search Assisted Living in Massachusetts | Assistedly.ai',
  metaTitle: 'Search Assisted Living in Massachusetts | Assistedly.ai',
  description:
    'Search unbiased Massachusetts assisted living and memory care facilities with AI-powered matching. No lead brokers, no pay-to-play rankings.',
  keywords: [
    'AI assisted living matching',
    'Massachusetts assisted living search',
    'memory care search Massachusetts',
    'assisted living broker alternatives',
  ],
}

export const COMPARE = {
  path: '/compare',
  title: 'Compare Assisted Living Facilities | Assistedly.ai',
  metaTitle: 'Compare Assisted Living Facilities | Assistedly.ai',
  description:
    'Side-by-side facility comparisons with transparent data. Compare costs, inspections, staffing, and amenities for Massachusetts assisted living and memory care options.',
}

export const COST_CALCULATOR = {
  path: '/cost-calculator',
  title: 'Assisted Living Cost Calculator | Assistedly.ai',
  metaTitle: 'Assisted Living Cost Calculator | Assistedly.ai',
  description:
    'Calculate assisted living and memory care costs in Massachusetts. Compare pricing tiers, understand fees, and plan budget without broker pressure.',
}

export const PARTNER_INTRODUCTIONS = {
  path: '/partner-introductions',
  title: 'Get Matched With Assisted Living | Assistedly.ai',
  metaTitle: 'AI Assisted Living Matching | Assistedly.ai',
  description:
    'Get personally matched with top-rated Massachusetts assisted living and memory care facilities. Unbiased AI screening, privacy-first, transparent matching.',
}

export const PRIVACY = {
  path: '/privacy',
  title: 'Privacy Policy | Assistedly.ai',
  metaTitle: 'Privacy Policy | Assistedly.ai',
  description:
    'Assistedly.ai privacy policy: we do not sell your personal data to third-party brokers. Learn about our privacy-first assisted living search practices.',
}

export const HOW_WE_WORK = {
  path: '/how-we-work',
  title: 'How Assistedly.ai Works | Assistedly.ai',
  metaTitle: 'How Assistedly.ai Works | Assistedly.ai',
  description:
    'Learn how Assistedly.ai aggregates public data, family inputs, and AI explanations to recommend assisted living without selling placements or rankings.',
}

export const METHODOLOGY = {
  path: '/methodology',
  title: 'Methodology | Assistedly.ai',
  metaTitle: 'Methodology | Assistedly.ai',
  description:
    'Our transparent methodology for summarizing pricing, staffing, occupancy, and compliance signals for Massachusetts assisted living and memory care facilities.',
}

export const FOUNDER_STORY = {
  path: '/founder-story',
  title: 'Founder Story | Assistedly.ai',
  metaTitle: 'Founder Story | Assistedly.ai',
  description:
    'How Assistedly.ai was built as an assisted living broker alternative that puts families first through AI matching, transparent pricing, and privacy-first data handling.',
}

export function buildMetadata(pageMeta) {
  const {
    title,
    description,
    ogImage = '/aialc-hero-banner.png',
    keywords = [],
  } = pageMeta

  const fullUrl = siteUrl + pageMeta.path
  const ogImageUrl = ogImage.startsWith('http') ? ogImage : siteUrl + ogImage

  return {
    title: title,
    description: description,
    keywords: keywords.join(', '),
    openGraph: {
      title: title,
      description: description,
      url: fullUrl,
      siteName: brand,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: fullUrl,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  }
}
