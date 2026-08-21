import { MASSACHUSETTS_FACILITIES } from '../lib/massachusettsFacilities'
import { LUXURY_ASSISTED_LIVING_PAGES } from '../lib/luxuryAssistedLivingPages'
import { MVP_TOWNS } from '../lib/massachusettsTownSeo'

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
    ['/partner-introductions', 'weekly', 0.85],
    ['/partners', 'weekly', 0.85],
    ['/concierge', 'weekly', 0.8],
    ['/cost-calculator', 'weekly', 0.8],
    ['/tools', 'weekly', 0.75],
    ['/tools/memory-care-readiness', 'weekly', 0.75],
    ['/massachusetts', 'weekly', 0.9],
    ['/compare', 'weekly', 0.9],
    ['/founder-story', 'monthly', 0.8],
    ['/how-we-work', 'monthly', 0.8],
    ['/how-we-make-money', 'monthly', 0.8],
    ['/methodology', 'monthly', 0.8],
    ['/data-sources', 'monthly', 0.8],
    ['/privacy', 'monthly', 0.6],
    ['/editorial-policy', 'monthly', 0.7],
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
    ...MVP_TOWNS.flatMap((town) =>
      ['best-assisted-living', 'memory-care', 'costs', 'comparison'].map((pageType) => ({
        url: toAbsoluteUrl(`/massachusetts/${town}/${pageType}`),
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.75,
      }))
    ),
    ...MASSACHUSETTS_FACILITIES.filter(
      (facility) => facility.town && facility.town.length >= 2 && !facility.town.includes('\\')
    ).map((facility) => ({
      url: toAbsoluteUrl(`/massachusetts/${facility.town}/${facility.slug}`),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    })),
  ]
}
