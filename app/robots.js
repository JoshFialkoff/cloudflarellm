export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/sources/', '/api/facility-source-redirect'],
    },
  }
}
