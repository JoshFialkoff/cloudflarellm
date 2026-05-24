import { NextResponse } from 'next/server'

const FOUNDER_PREVIEW_HOSTS = new Set(['agent3.assistedly.ai'])

const REDIRECT_PATHS = new Set([
  '/what-to-ask-before-choosing-assisted-living-massachusetts',
  '/blog',
  '/personalized-guidance',
  '/sitemap.xml',
  '/articles',
  '/category/transparency',
  '/massachusetts/boston',
  '/massachusetts/boston/luxury-assisted-living',
  '/posts',
  '/member-dashboard',
  '/404',
  '/category/massachusetts',
  '/comparison',
  '/comparisons',
  '/facility',
  '/humans.txt',
  '/ma-assisted-living-directory',
  '/massachusetts',
  '/massachusetts/assisted-living-comparison',
  '/news',
  '/register',
  '/sitemap_index.xml',
  '/why-ai-makes-a-difference',
])

export function proxy(request) {
  const { pathname } = request.nextUrl
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  const normalizedPathLower = normalizedPath.toLowerCase()
  const normalizedHost = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '')
    .toLowerCase()
    .split(':')[0]

  if (normalizedPathLower === '/' && FOUNDER_PREVIEW_HOSTS.has(normalizedHost)) {
    const url = request.nextUrl.clone()
    url.pathname = '/about'
    return NextResponse.rewrite(url)
  }

  if (REDIRECT_PATHS.has(normalizedPathLower)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('page_path', normalizedPathLower)
    return NextResponse.redirect(url, 301)
  }

  return NextResponse.next()
}

export const config = {
  runtime: 'edge',
}
