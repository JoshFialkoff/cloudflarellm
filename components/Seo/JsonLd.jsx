import React from 'react'

/**
 * JsonLd Component
 * Injects Schema.org JSON-LD script tags safely.
 *
 * Usage in App Router (layout.js / page.js):
 *   import { getOrganizationSchema } from '@/lib/seo/schemaData'
 *   import JsonLd from '@/components/Seo/JsonLd'
 *   <JsonLd data={getOrganizationSchema()} />
 *
 * Usage in Pages Router (_app.js or page component):
 *   <JsonLd data={...} />
 */
export default function JsonLd({ data, id }) {
  if (!data) return null

  const json = Array.isArray(data)
    ? { '@context': 'https://schema.org', '@graph': data }
    : data

  return (
    <script
      type="application/ld+json"
      id={id}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(json).replace(/</g, '\\u003c'),
      }}
    />
  )
}
