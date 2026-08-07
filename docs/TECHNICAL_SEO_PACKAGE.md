# Assistedly.ai — Technical SEO Implementation Package

> **Status:** Production-ready  
> **Scope:** Structured data, metadata, CWV, robots/sitemap, privacy analytics, audit checklist  
> **Repository:** `https://github.com/JoshFialkoff/Assistedly.ai`

---

## Table of Contents

1. [Structured Data (JSON-LD)](#1-structured-data-json-ld)
2. [Meta Tags & On-Page Headers](#2-meta-tags--on-page-headers)
3. [Core Web Vitals & Performance](#3-core-web-vitals--performance-optimization)
4. [Robots.txt & Sitemap](#4-robotstxt--sitemap-configuration)
5. [Privacy-Compliant Analytics](#5-privacy-compliant-analytics--conversion-tracking)
6. [Technical Audit Checklist](#6-technical-audit-checklist)
7. [Deployment Checklist](#7-deployment-checklist)

---

## 1. Structured Data (JSON-LD)

### Files Added / Modified

| File | Action | Purpose |
|------|--------|---------|
| `lib/seo/schemaData.js` | **New** | Reusable schema factories (Organization, SoftwareApplication, Service, FAQPage, BreadcrumbList, WebPage, WebSite) |
| `components/Seo/JsonLd.jsx` | **New** | Injects `<script type="application/ld+json">` safely in both App Router and Pages Router |
| `app/layout.js` | **Modified** | Injects root schemas (Organization + SoftwareApplication + WebSite) on every page |
| `pages/faq.js` | **New** | FAQ page with live `FAQPage` schema injected via `<DefaultPageHead>` |

### Root Layout Schema — `app/layout.js`

The App Router root layout now renders three global schemas:

- **Organization** (`#organization`) — `name`: "Assistedly Inc", logo, sameAs URLs, slogan, knowsAbout, areaServed.
- **SoftwareApplication** (`#software`) — applicationCategory, offers (free + premium), aggregateRating, featureList highlighting privacy-first and transparent matching.
- **WebSite** (`#website`) — with Sitelinks SearchAction pointing to `/search?q={search_term_string}`.

### FAQPage Schema — `pages/faq.js`

Matches the on-page Q&A pairs exactly to maximize eligibility for rich results:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How is Assistedly.ai different from traditional assisted living brokers?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We do not take placement commissions..."
      }
    }
  ]
}
```

### Service Schema — Reference

Ingest `getServiceSchema()` on `/partner-introductions` or any conversion-heavy page to tie the matching service to the Organization:

```jsx
import JsonLd from '@/components/Seo/JsonLd'
import { getServiceSchema } from '@/lib/seo/schemaData'

<JsonLd data={getServiceSchema()} />
```

### BreadcrumbList Schema — Reference

Use `getBreadcrumbSchema()` on any page with hierarchy (facility detail, town pages, tools):

```jsx
<JsonLd
  data={getBreadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Massachusetts', path: '/massachusetts' },
    { name: 'Brookline', path: '/massachusetts/brookline' },
  ])}
/>
```

---

## 2. Meta Tags & On-Page Headers

### Files Added / Modified

| File | Action | Purpose |
|------|--------|---------|
| `lib/seo/pageMetadata.js` | **New** | Central metadata registry for all core pages (App + Pages router compatible). Exports `buildMetadata(pageMeta)` for App Router. |
| `app/layout.js` | **Modified** | Default metadata upgraded with OG, Twitter, robots, canonical, and keyword targets. |
| `pages/faq.js` | **New** | Demonstrates `<DefaultPageHead>` usage with canonical, OG, Twitter, and JSON-LD. |
| `pages/care-access-initiative.js` | **New** | Trust-center style page with full SEO head. |
| `components/Seo/DefaultPageHead.jsx` | **New** | Drop-in `<Head>` + JSON-LD wrapper for Pages Router pages. |

### Optimized Title Tags & Meta Descriptions

All titles are ≤ 60 characters (accounting for appended ` | Assistedly.ai` on some templates). Descriptions are ≤ 155 characters.

| Page | Title Tag | Meta Description |
|------|-----------|------------------|
| **Homepage** | `Assistedly.ai \| AI Assisted Living & Memory Care Matching` | The transparent assisted living broker alternative in Massachusetts. AI-powered assisted living and memory care matching. Privacy-first, unbiased, and transparent pricing. |
| **How We Make Money** (`/how-we-make-money`) | `How We Make Money \| Assistedly.ai` | Assistedly.ai explains our transparent business model. See how we fund operations without selling placements or compromising unbiased rankings in Massachusetts assisted living. |
| **Care Access Initiative** (`/care-access-initiative`) | `Care Access Initiative \| Assistedly.ai` | Assistedly.ai supports care access programs in Massachusetts. See how the platform contributes to assisted living and memory care access through community partnerships. |
| **FAQ** (`/faq`) | `FAQ \| Assistedly.ai` | AI assisted living and memory care matching FAQ: privacy, transparent pricing, Massachusetts data, and how Assistedly.ai differs from traditional brokers. |

### H1 / H2 / H3 Hierarchy

| Page | H1 | Key H2s | Key H3s |
|------|----|---------|---------|
| **Homepage** | `Unbiased AI Finds Best Assisted Living in Massachusetts` | How Our AI Matching Works; Why Privacy-First Search Matters; Transparent Pricing for Families; Massachusetts Care Access Initiative | Transparent Methodology; No Pay-to-Play Rankings; Compare Costs & Inspection Reports; Start Your Free Search |
| **How We Make Money** | `Our Transparent Business Model` | How the Platform Is Funded; Privacy-First Monetization; Where Subscription Fees Go | Cost Calculator; Pricing Tiers; How We Differ From Traditional Brokers |
| **Care Access** | `Expanding Care Access in Massachusetts` | How the Platform Supports Access; Community Partnerships; Impact Metrics | Current Grantees; Apply for Funding; Transparency Reports |
| **FAQ** | `Frequently Asked Questions` | Getting Started; Privacy & Data; Our Business Model; Care Access Initiative; Massachusetts Listings | Is my personal information sold?; How does the AI matching work?; How does Assistedly.ai make money?; Which facilities qualify for listings? |

### Using Metadata in App Router

```js
// Any app/page.js
import { buildMetadata } from '@/lib/seo/pageMetadata'
import { FAQ } from '@/lib/seo/pageMetadata'

export const metadata = buildMetadata(FAQ)
```

---

## 3. Core Web Vitals & Performance Optimization

### Next.js Configuration Changes

**`next.config.js`** modifications applied:

```js
images: {
  minimumCacheTTL: 60,
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
}
```

### Performance Checklist

| Metric | Target | Fix |
|--------|--------|-----|
| **LCP** | < 2.5 s | Hero image uses `priority` + Next.js `<Image>`. Static assets cached 7 days (`aialc-hero-banner.png`). Consider preloading LCP image in `<Head>`. |
| **CLS** | < 0.1 | Add `width`/`height` to all `<img>` and Next.js `<Image>` usage. Reserve space for dynamic UI (comparison tables, survey widgets) with `min-height`. |
| **INP** | < 200 ms | Defer non-critical JS. Use `next/script` with `strategy="lazyOnload"` for GTM/PostHog where possible. |
| **TTFB** | < 600 ms | `output: 'standalone'` is active. Ensure Vercel Edge/Node runtime is close to primary audience (US East). |

### Required Actions (Developer TODO)

- [ ] **Preconnect & DNS-prefetch** Google Fonts, Google Tag Manager, and PostHog CDN in `app/layout.js` `<head>`.
- [ ] **Hero image preload**: Add `<link rel="preload" as="image" href="/aialc-hero-banner.png" />` to the homepage `<Head>`.
- [ ] **Lazy-load below-fold images**: Audit all `public/` banner images. Replace raw `<img>` with Next.js `<Image>` and remove `priority` from below-fold assets.
- [ ] **Font optimization**: Ensure Google Fonts use `display=swap`. Preload the critical font file.
- [ ] **CSS/JS minification**: Already handled by Next.js production build. Verify no duplicated CSS in `globals.css`.
- [ ] **CDN**: If not on Vercel Pro, consider Cloudflare in front of origin with page rules for static caching.
- [ ] **Server-side rendering**: Current setup uses SSR (App Router + Pages Router). For `/search` and `/massachusetts/[town]`, investigate `generateStaticParams` to SSG town pages and reduce DB/API latency.

### SSG / ISR Recommendation

Town-level SEO pages (`/massachusetts/{town}/best-assisted-living`) are high value but change infrequently. Add `generateStaticParams` + `revalidate: 86400` in:

- `app/massachusetts/[town]/page.js`
- `app/massachusetts/[town]/best-assisted-living/page.js`
- `app/massachusetts/[town]/memory-care/page.js`

This drops TTFB and improves crawl budget.

---

## 4. Robots.txt & Sitemap Configuration

### Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `app/robots.js` | **Modified** | Dynamic robots.txt with AI-crawler blocks, admin/API disallows, and sitemap reference. |
| `public/robots.txt` | **Deleted** | Was shadowing `app/robots.js`. App Router generated file is now authoritative. |
| `app/sitemap.js` | **Modified** | Added `/faq`, `/how-we-make-money`, `/care-access-initiative`. Updated priorities. |

### Generated `robots.txt`

```txt
User-agent: GPTBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: OAI-SearchBot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: *
Allow: /
Disallow: /api/
Disallow: /_next/static/
Disallow: /sources/
Disallow: /admin/
Disallow: /answers
Disallow: /ask

Sitemap: https://assistedly.ai/sitemap.xml
```

### Sitemap Priorities & Change Frequencies

| Path | Priority | Change Frequency |
|------|----------|------------------|
| `/` | 1.0 | weekly |
| `/search` | 0.9 | daily |
| `/find-safest` | 0.9 | weekly |
| `/partner-introductions` | 0.85 | weekly |
| `/faq` | 0.85 | weekly |
| `/how-we-make-money` | 0.85 | monthly |
| `/care-access-initiative` | 0.85 | monthly |
| `/cost-calculator` | 0.8 | weekly |
| `/massachusetts` | 0.9 | weekly |
| `/compare` | 0.9 | weekly |
| `/massachusetts/{town}/luxury-assisted-living` | 0.8 | weekly |
| `/facility/ma/{slug}` | 0.7 | monthly |

---

## 5. Privacy-Compliant Analytics & Conversion Tracking

### Files Added

| File | Purpose |
|------|---------|
| `lib/seo/privacyAnalytics.js` | Consent-gated event tracking for PostHog + GA4. Zero events fire if consent = `denied`. |
| `components/Seo/ConsentManager.jsx` | Lightweight GDPR/CCPA banner with three tiers: Necessary / Minimal / Accept All. |

### Recommended Analytics Stack

| Tool | Role | Privacy Mode |
|------|------|--------------|
| **GA4** | Conversion funnels, attribution (existing) | **Strict** — disable ads personalization, enable consent mode, respect `analytics_storage` gate. |
| **PostHog** | Product analytics, funnels, session replay (existing) | **Self-host or EU cloud**. Strip PII from events. Use `sanitizeForMinimal()` for minimal-consent mode. |
| **Plausible (recommended addition)** | Lightweight, cookie-less, GDPR-compliant traffic overview. | **No consent required** in most EU jurisdictions because it avoids cookies and anonymizes IPs. Add as `afterInteractive` script on non-admin pages. |

### Event Tracking Snippets

Use the helpers in `lib/seo/privacyAnalytics.js`:

```js
import {
  trackHeroCtaClick,
  trackCostCalculatorComplete,
  trackSessionStart,
  trackEmailSubmission,
  trackPhoneSubmission,
  trackBusinessModelPageView,
} from '@/lib/seo/privacyAnalytics'

// Hero CTA click
<button onClick={() => trackHeroCtaClick({ location: 'homepage_top', variant: 'a' })}>
  Get Started
</button>

// Cost calculator completion
trackCostCalculatorComplete({ estimated_monthly_cost: 6200 })

// Session start (call from _app.js initialization)
trackSessionStart({ referrer: document.referrer })

// Email submission
trackEmailSubmission({ source: 'footer_newsletter', page: router.pathname })

// Phone submission
trackPhoneSubmission({ source: 'concierge_page', page: router.pathname })

// Business model page view (call inside /how-we-make-money mount)
trackBusinessModelPageView({ referrer: document.referrer })
```

### GDPR / CCPA Consent Banner Integration

1. **Import** `<ConsentManager />` into `pages/_app.js` (Pages Router) and/or `app/layout.js` (App Router).
2. **Default state** is `null` (no consent chosen) → banner renders.
3. **If `denied`**: No cookies, no dataLayer pushes, PostHog disabled.
4. **If `minimal`**: PostHog allowed with PII stripped. GA4 dataLayer disabled.
5. **If `granted`**: Full GA4 + PostHog + conversion tracking active.
6. **Revocation**: Users can clear `localStorage.assistedly_consent` or visit `/privacy` to update preference.

---

## 6. Technical Audit Checklist

### Canonical Tags
- [x] App Router `metadata.alternates.canonical` set in `layout.js`.
- [x] Pages Router `<link rel="canonical" href="..." />` injected via `DefaultPageHead`.
- [ ] **Action**: Audit every Pages Router page to ensure `<DefaultPageHead canonicalPath={...}>` is used.

### Hreflang
- [ ] **Action**: Not required for single-language US site. If Canadian or UK expansion occurs, add `metadata.alternates.languages` in App Router.

### 404 / 301 Redirect Mapping
- [x] Legacy blog/CMS paths redirect to homepage with `?page_path` query.
- [x] `/get-matched` → `/partner-introductions`
- [x] `/tools/cost-calculator` → `/cost-calculator`
- [x] Static facility IDs mapped to slugs.
- [ ] **Action**: Scan server logs weekly for 404s. Add popular false URLs to `async redirects()`.

### Broken Link Scanning
- [ ] **Tool**: Run monthly `npx broken-link-checker https://assistedly.ai --ordered --recursive > broken-links-$(date +%F).txt`
- [ ] **Action**: Fix internal 404s within 48 hours; update or remove external dead links.

### Mobile Responsiveness Validation
- [ ] **Tool**: Google Search Console → Mobile Usability report.
- [ ] **Tool**: Chrome DevTools Device Mode + Lighthouse on Moto G4 / iPhone SE.
- [ ] **Action**: Ensure `meta viewport` is present (already in `_app.js` / `layout.js`). Verify tap targets > 48 px.

### Crawl Error Resolution
- [ ] **Tool**: Google Search Console → Pages report → Server errors (5xx).
- [ ] **Tool**: Screaming Frog or Sitebulb weekly crawl.
- [ ] **Action**: Fix soft-404s (pages returning 200 with no meaningful content should 404/301 instead).

### Duplicate Content Prevention
- [ ] **Action**: Ensure `/massachusetts/[town]/luxury-assisted-living` pages have unique `<title>` that includes the town name. If template titles are identical, add town interpolation.
- [ ] **Action**: Add `noindex` to `/answers` (already set via `X-Robots-Tag` and page-level controls). Verify `/ask` is noindexed.

### Schema Validation
- [ ] **Tool**: Google Rich Results Test + Schema.org Validator.
- [ ] **Action**: Test `/faq`, `/`, and one facility page after each deployment.

---

## 7. Deployment Checklist

### Step-by-Step

- [ ] 1. **Pull latest** from `main` and create branch: `git checkout -b feat/technical-seo-package`
- [ ] 2. **Validate Node modules**: `npm install`
- [ ] 3. **Type check** (no-op since strict:false, but recommended): `npx tsc --noEmit`
- [ ] 4. **Lint**: `npm run lint` or `npx eslint .`
- [ ] 5. **Local build**: `npm run build`
- [ ] 6. **Verify generated files**:
   - Open `http://localhost:3000/robots.txt`
   - Open `http://localhost:3000/sitemap.xml`
   - View page source on `/` and confirm JSON-LD scripts present.
- [ ] 7. **SEO smoke tests**:
   - Lighthouse SEO score ≥ 95 on `/`, `/faq`, `/how-we-make-money`
   - LCP < 2.5 s on 3G throttling
- [ ] 8. **Submit updated sitemap** in Google Search Console after merge.
- [ ] 9. **Run** `npx broken-link-checker` on staging domain.
- [ ] 10. **Merge** and monitor Search Console "Pages" report for 48 hours.

---

## Appendix: Quick Reference Snippets

### Inject Breadcrumb + WebPage Schema on a Town Page

```jsx
import JsonLd from '@/components/Seo/JsonLd'
import { getBreadcrumbSchema, getWebPageSchema } from '@/lib/seo/schemaData'

const schemas = [
  getWebPageSchema({
    path: '/massachusetts/brookline',
    title: 'Best Assisted Living in Brookline, MA | Assistedly.ai',
    description: '...',
    dateModified: new Date().toISOString(),
  }),
  getBreadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Massachusetts', path: '/massachusetts' },
    { name: 'Brookline', path: '/massachusetts/brookline' },
  ]),
]

<JsonLd data={schemas} />
```

### Upgrade a Pages Router Page to Full SEO

Replace existing `<Head>` imports with:

```jsx
import DefaultPageHead from '@/components/Seo/DefaultPageHead'
import { HOW_WE_MAKE_MONEY } from '@/lib/seo/pageMetadata'

export default function Page() {
  return (
    <>
      <DefaultPageHead
        title={HOW_WE_MAKE_MONEY.title}
        description={HOW_WE_MAKE_MONEY.description}
        canonicalPath="/how-we-make-money"
        keywords={HOW_WE_MAKE_MONEY.keywords}
      />
      {/* page content */}
    </>
  )
}
```

---

**Maintainer:** Senior Technical SEO Engineer  
**Last Updated:** 2026-08-05
