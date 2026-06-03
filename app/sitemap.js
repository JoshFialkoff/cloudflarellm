import { MASSACHUSETTS_FACILITIES } from '../lib/massachusettsFacilities'
import { LUXURY_ASSISTED_LIVING_PAGES } from '../lib/luxuryAssistedLivingPages'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://assistedly.ai'

function toAbsoluteUrl(path) {
  return new URL(path, siteUrl).toString()
}

export default function sitemap() {
  const lastModified = new Date()
  const corePages = [
    ['/', 'weekly', 1],
    ['/search', 'daily', 0.9],
    ['/find-safest', 'weekly', 0.9],
    ['/get-matched', 'weekly', 0.85],
    ['/cost-calculator', 'weekly', 0.8],
    ['/tools', 'weekly', 0.75],
    ['/tools/memory-care-readiness', 'weekly', 0.75],
    ['/massachusetts', 'weekly', 0.9],
  ]

  return [
    ...corePages.map(([path, changeFrequency, priority]) => ({
      url: toAbsoluteUrl(path),
      lastModified,
      changeFrequency,
      priority,
    })),
    ...LUXURY_ASSISTED_LIVING_PAGES.map((page) => ({
      url: toAbsoluteUrl(`/massachusetts/${page.town}/luxury-assisted-living`),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    })),
    ...MASSACHUSETTS_FACILITIES.map((facility) => ({
      url: toAbsoluteUrl(`/massachusetts/${facility.town}/${facility.slug}`),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    })),
  ]
}
