/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: [
    '104.168.38.162',
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
    minimumCacheTTL: 0,
  },
  async headers() {
    const htmlCache = 'public, max-age=0, s-maxage=0, must-revalidate'
    const mutablePublicAssetCache =
      'public, max-age=0, s-maxage=0, must-revalidate'
    return [
      {
        source: '/aialc-hero-banner.png',
        headers: [
          {
            key: 'Cache-Control',
            value: mutablePublicAssetCache,
          },
        ],
      },
      {
        source: '/banner/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: mutablePublicAssetCache,
          },
        ],
      },
      { source: '/', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      { source: '/search', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      { source: '/index-video', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      { source: '/index-video/', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      {
        source: '/facility/:slug*',
        headers: [{ key: 'Cache-Control', value: htmlCache }],
      },
    ]
  },
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/favicon.png' }]
  },
  async redirects() {
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
        destination: '/search',
        permanent: false,
      },
      {
        source: '/ep-login.php',
        destination: '/',
        permanent: true,
      },
      { source: '/tools/cost-calculator', destination: '/cost-calculator', statusCode: 301 },
      { source: '/tools/cost-calculator/', destination: '/cost-calculator', statusCode: 301 },
      { source: '/facility/1', destination: '/facility/sunrise-boston/', permanent: true },
      { source: '/facility/2', destination: '/facility/cambridge-care-rehabilitation/', permanent: true },
      { source: '/facility/3', destination: '/facility/newton-highlands-senior-community/', permanent: true },
      { source: '/facility/4', destination: '/facility/worcester-memory-care-center/', permanent: true },
      { source: '/facility/5', destination: '/facility/springfield-elder-care-village/', permanent: true },
      { source: '/facility/6', destination: '/facility/brookline-premier-assisted-living/', permanent: true },
    ]
  },
}

module.exports = nextConfig
