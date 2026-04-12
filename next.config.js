/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        pathname: '/vi/**',
      },
    ],
  },
  // Keep HTML from being cached at the edge for a year (Cloudflare was serving stale navbar, etc.)
  async headers() {
    const htmlCache =
      'public, max-age=0, s-maxage=120, stale-while-revalidate=86400, must-revalidate'
    return [
      { source: '/', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      { source: '/search', headers: [{ key: 'Cache-Control', value: htmlCache }] },
      { source: '/about', headers: [{ key: 'Cache-Control', value: htmlCache }] },
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
