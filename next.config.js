/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  images: {},
  // HTML must not use long stale-while-revalidate: CDNs can serve old HTML that references
  // prior build chunk URLs → 404 on _buildManifest.js / turbopack-*.js after deploy.
  async headers() {
    const htmlCache =
      'public, max-age=0, s-maxage=120, must-revalidate'
    return [
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
