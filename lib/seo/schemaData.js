/**
 * Centralized Schema.org structured data for Assistedly.ai
 * Aligned with value proposition: transparent AI matching, privacy-first,
 * unbiased rankings, and care-access reinvestment.
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://assistedly.ai'

export function toAbsoluteUrl(path) {
  return new URL(path, siteUrl).toString()
}

/**
 * Organization schema with sameAs links and Massachusetts focus.
 */
export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': toAbsoluteUrl('#organization'),
    name: 'Assistedly Inc',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: toAbsoluteUrl('/favicon.png'),
      width: 512,
      height: 512,
    },
    sameAs: [
      'https://www.linkedin.com/company/assistedly',
      'https://twitter.com/AssistedlyAI',
    ],
    description:
      'Assistedly Inc operates Assistedly.ai, a transparent, AI-powered assisted living and memory care matching platform in Massachusetts.',
    slogan: 'Unbiased AI matching for assisted living and memory care.',
    knowsAbout: [
      'Assisted Living',
      'Memory Care',
      'AI-powered Care Matching',
      'Privacy-First Lead Brokering',
      'Massachusetts Assisted Living and Memory Care',
    ],
    areaServed: {
      '@type': 'State',
      name: 'Massachusetts',
    },
  }
}

/**
 * SoftwareApplication schema
 */
export function getSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': toAbsoluteUrl('#software'),
    name: 'Assistedly.ai',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Any',
    url: siteUrl,
    image: toAbsoluteUrl('/aialc-hero-banner.png'),
    description:
      'AI-powered assisted living and memory care matching platform in Massachusetts that prioritizes privacy, rejects pay-to-play facility rankings, and supports care-access initiatives.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description:
        'Free core search and comparison tools. Optional premium memberships for detailed reports and guided decision support.',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '124',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      'Unbiased AI assisted living and memory care matching',
      'Privacy-first data handling (no lead brokering to third parties without consent)',
      'Transparent facility scoring methodology',
      'Massachusetts-specific public data integration',
      'Support for care-access initiatives',
    ],
    creator: {
      '@id': toAbsoluteUrl('#organization'),
    },
  }
}

/**
 * Service schema for the matching / decision-support service.
 */
export function getServiceSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': toAbsoluteUrl('#service'),
    name: 'Assistedly.ai Assisted Living Matching Service',
    provider: {
      '@id': toAbsoluteUrl('#organization'),
    },
    areaServed: {
      '@type': 'State',
      name: 'Massachusetts',
    },
    serviceType: 'Assisted Living & Memory Care Matching & Planning Support',
    description:
      'Transparent, commission-free assisted living and memory care matching in Massachusetts, built on public data and AI-driven recommendations.',
    url: toAbsoluteUrl('/partner-introductions'),
    brand: {
      '@id': toAbsoluteUrl('#organization'),
    },
    termsOfService: toAbsoluteUrl('/privacy'),
  }
}

/**
 * FAQPage schema for /faq
 * @param {Array<{question: string, answer: string}>} faqs
 */
export function getFAQPageSchema(faqs = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': toAbsoluteUrl('/faq#faqpage'),
    mainEntity: faqs.map((faq, index) => ({
      '@type': 'Question',
      '@id': toAbsoluteUrl(`/faq#question-${index}`),
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        '@id': toAbsoluteUrl(`/faq#answer-${index}`),
        text: faq.answer,
      },
    })),
  }
}

/**
 * BreadcrumbList schema generator.
 * @param {Array<{name: string, path: string}>} crumbs
 */
export function getBreadcrumbSchema(crumbs = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': toAbsoluteUrl('#breadcrumbs'),
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: toAbsoluteUrl(crumb.path),
    })),
  }
}

/**
 * Generic WebPage schema for any page.
 */
export function getWebPageSchema({ path = '/', title, description, lastReviewed, dateModified }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': toAbsoluteUrl(`${path}#webpage`),
    url: toAbsoluteUrl(path),
    name: title,
    description: description,
    isPartOf: {
      '@id': toAbsoluteUrl('#website'),
    },
    about: {
      '@id': toAbsoluteUrl('#organization'),
    },
    lastReviewed: lastReviewed || dateModified,
    dateModified: dateModified || lastReviewed,
    publisher: {
      '@id': toAbsoluteUrl('#organization'),
    },
  }
}

/**
 * Website schema with search action (Sitelinks Searchbox)
 */
export function getWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': toAbsoluteUrl('#website'),
    name: 'Assistedly.ai',
    url: siteUrl,
    publisher: {
      '@id': toAbsoluteUrl('#organization'),
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}
