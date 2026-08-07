import React from 'react'
import Head from 'next/head'
import JsonLd from './JsonLd'

/**
 * DefaultPageHead
 * Drop-in <Head> wrapper for Pages Router components.
 *
 * Props:
 *   title        – page title (max 60 chars recommended)
 *   description  – meta description (max 155 chars recommended)
 *   canonicalPath– e.g. "/faq"
 *   ogImage      – absolute or relative OG image path
 *   noindex      – boolean
 *   jsonLd       – single schema object or array of schema objects
 *   keywords     – array of keywords
 */
export default function DefaultPageHead({
  title,
  description,
  canonicalPath,
  ogImage = '/aialc-hero-banner.png',
  noindex = false,
  jsonLd = null,
  keywords = [],
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://assistedly.ai'
  const canonical = canonicalPath ? `${siteUrl}${canonicalPath}` : siteUrl
  const ogImageUrl = ogImage?.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {keywords.length > 0 && (
          <meta name="keywords" content={keywords.join(', ')} />
        )}
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="Assistedly" />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:locale" content="en_US" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImageUrl} />
        {noindex && <meta name="robots" content="noindex, nofollow" />}
        {!noindex && (
          <meta
            name="robots"
            content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
          />
        )}
      </Head>
      {jsonLd && <JsonLd data={jsonLd} />}
    </>
  )
}
