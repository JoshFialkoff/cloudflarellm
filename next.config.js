/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  async redirects() {
    return [
      {
        source: '/ep-login.php',
        destination: 'https://lp.aiassistliving.com/wp-login.php',
        permanent: false,
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
