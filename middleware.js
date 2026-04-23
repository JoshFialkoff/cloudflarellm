import { NextResponse } from 'next/server'

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

export function middleware(request) {
  const { pathname } = request.nextUrl
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  const normalizedPathLower = normalizedPath.toLowerCase()

  if (REDIRECT_PATHS.has(normalizedPathLower)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('page_path', normalizedPathLower)
    return NextResponse.redirect(url, 301)
  }

  return NextResponse.next()
}

