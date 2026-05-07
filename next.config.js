const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Multiple lockfiles or Cursor multi-root workspaces can mis-infer the repo root; Turbopack
  // then cannot resolve `next` from the real app dir. Pin to this project (next.config.js dir).
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Allow remote host to access dev HMR assets.
  allowedDevOrigins: ['104.168.38.162'],
  reactStrictMode: true,
  trailingSlash: false,
  // Prevent runtime slash normalization from touching asset URLs behind proxies/CDNs.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/vi/**',
      },
    ],
    // `/_next/image` cache TTL; lower avoids stale optimized copies of `public/banner/*` after deploy.
    minimumCacheTTL: 0,
  },
  // HTML must not use long stale-while-revalidate: CDNs can serve old HTML that references
  // prior build chunk URLs → 404 on _buildManifest.js / turbopack-*.js after deploy.
  async headers() {
    // Shared caches (Cloudflare, etc.): s-maxage=0 so incognito / first-time visitors do not get
    // edge-stale HTML. Browsers still revalidate with must-revalidate + max-age=0.
    const htmlCache = 'public, max-age=0, s-maxage=0, must-revalidate'
    // Banner paths are stable URLs; long CDN TTL + SWR made replaced images/copy feel "stuck"
    // in private windows (no disk cache → always edge).
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
      { source: '/about', headers: [{ key: 'Cache-Control', value: htmlCache }] },
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
    return [
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
