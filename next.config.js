/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: [
    '75.127.14.185',
    '75.127.14.185',
    'agent1.assistedly.ai',
    '*.trycloudflare.com',
    '127.0.0.1',
    '[::1]',
    '::1',
    'null',
    ...(typeof process.env.NEXT_ALLOWED_DEV_ORIGINS === 'string'
      ? process.env.NEXT_ALLOWED_DEV_ORIGINS.split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : []),
  ],
  reactStrictMode: true,
  output: 'standalone',
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/vi/**',
      },
    ],
    minimumCacheTTL: 60,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    const htmlCache = 'public, max-age=0, s-maxage=0, must-revalidate'
    const mutablePublicAssetCache =
      'public, max-age=0, s-maxage=0, must-revalidate'
    const staticAssetCache = 'public, max-age=31536000, immutable'
    return [
      // Static assets: long-term cache
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: staticAssetCache },
        ],
      },
      {
        source: '/favicon.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, immutable' },
        ],
      },
      {
        source: '/aialc-hero-banner.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, immutable' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/banner/:path*',
        headers: [
          { key: 'Cache-Control', value: mutablePublicAssetCache },
        ],
      },
      // Security headers for all pages (CSP additions belong in Vercel/nginx for prod)
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // HTML pages
      { source: '/', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      { source: '/search', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      { source: '/index-video', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      { source: '/index-video/', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      { source: '/facility/:slug*', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      { source: '/answers', headers: [{ key: 'Cache-Control', value: htmlCache }] },
    ]
  },
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/favicon.png' }]
  },
  async redirects() {
    const landing2Redirects = [
      { source: '/2', destination: '/ask', statusCode: 301 },
      { source: '/2/', destination: '/ask', statusCode: 301 },
    ]
    const legacyRedirects = [
      '/what-to-ask-before-choosing-assisted-living-massachusetts',
      '/blog',
      '/personalized-guidance',
      '/articles',
      '/category/transparency',
      '/posts',
      '/member-dashboard',
      '/404',
      '/category/massachusetts',
      '/comparison',
      '/comparisons',
      '/facility',
      '/humans.txt',
      '/ma-assisted-living-directory',
      '/news',
      '/register',
      '/sitemap_index.xml',
      '/why-ai-makes-a-difference',
    ]
      .map((path) => ({
        source: path,
        destination: `/?page_path=${path}`,
        permanent: true,
      }))

    return [
      ...landing2Redirects,
      ...legacyRedirects,
      {
        source: '/about',
        destination: '/',
        statusCode: 301,
      },
      {
        source: '/budget',
        destination: '/tools/cost-calculator',
        permanent: false,
      },
      {
        source: '/get-matched',
        destination: '/partner-introductions',
        permanent: false,
      },
      {
        source: '/get-matched/',
        destination: '/partner-introductions',
        permanent: false,
      },
      {
        source: '/ep-login.php',
        destination: '/',
        permanent: true,
      },
      { source: '/tools/cost-calculator', destination: '/cost-calculator', statusCode: 301 },
      { source: '/tools/cost-calculator/', destination: '/cost-calculator', statusCode: 301 },
      { source: '/facility/1', destination: '/facility/ma/sunrise-boston', permanent: true },
      { source: '/facility/2', destination: '/facility/ma/cambridge-care-rehabilitation', permanent: true },
      { source: '/facility/3', destination: '/facility/ma/newton-highlands-senior-community', permanent: true },
      { source: '/facility/4', destination: '/facility/ma/worcester-memory-care-center', permanent: true },
      { source: '/facility/5', destination: '/facility/ma/springfield-elder-care-village', permanent: true },
      { source: '/facility/6', destination: '/facility/ma/brookline-premier-assisted-living', permanent: true },
      { source: '/data', destination: '/companies', statusCode: 301 },
      { source: '/ai-search', destination: '/answers', statusCode: 301 },
      { source: '/ai-search/', destination: '/answers', statusCode: 301 },
    ]
  },
}

module.exports = nextConfig
