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
    ]
  },
}

module.exports = nextConfig
