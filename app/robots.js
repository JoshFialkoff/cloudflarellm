export default function robots() {
  return {
    rules: [
      // Block AI training crawlers from ALL content
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'Claude-Web', disallow: '/' },
      { userAgent: 'ClaudeBot', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'PerplexityBot', disallow: '/' },
      { userAgent: 'cohere-ai', disallow: '/' },
      { userAgent: 'OAI-SearchBot', disallow: '/' },
      { userAgent: 'Applebot-Extended', disallow: '/' },
      { userAgent: 'Amazonbot', disallow: '/' },
      { userAgent: 'FacebookBot', disallow: '/' },
      { userAgent: 'Meta-ExternalAgent', disallow: '/' },
      { userAgent: 'Bytespider', disallow: '/' },
      // Standard crawlers allowed
      { userAgent: '*', allow: '/', disallow: ['/sources/', '/api/facility-source-redirect'] },
    ],
    sitemap: 'https://assistedly.ai/sitemap.xml',
  };
}
