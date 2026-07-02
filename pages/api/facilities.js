import { MASSACHUSETTS_FACILITIES } from "../../lib/massachusettsFacilities";
import { buildFacilityProfile } from "../../lib/facilityProfiles";

/**
 * Known LLM crawler user-agents to block.
 * These bots scrape data to train models — they don't need facility data.
 */
const LLM_BOT_PATTERNS = [
  'GPTBot',
  'GPTBot/',
  'ChatGPT-User',
  'Claude-Web',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Google-Cloud-Scout',
  'CCBot',
  'PerplexityBot',
  'cohere-ai',
  'OAI-SearchBot',
  'Bytespider',
  'FacebookBot',
  'diffbot',
  'ImagesiftBot',
  'Applebot-Extended',
  'Amazonbot',
  'semrush',
  'AhrefsBot',
  'MegaIndex',
  'BLEXBot',
  'DataForSeoBot',
  'Seekr',
  'YouBot',
]

function isLlmCrawler(ua) {
  if (!ua) return false
  const lower = ua.toLowerCase()
  return LLM_BOT_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()))
}

export default function handler(req, res) {
  // 1. Block known LLM crawlers at the application level
  const userAgent = req.headers['user-agent'] || ''
  if (isLlmCrawler(userAgent)) {
    console.log(`[facilities] Blocked LLM crawler: ${userAgent.slice(0, 80)}`)
    return res.status(403).json({
      error: 'Access denied',
      code: 'BOT_BLOCKED',
    })
  }

  // 2. Optional: rate limiting via response headers
  // (Real rate limiting should be done at the CDN/Cloudflare level)

  // 3. Cache aggressively — facility data is static.
  //    CDN caches 24h, browser caches 10min.
  //    stale-while-revalidate ensures fast stale responses while revalidating.
  res.setHeader(
    'Cache-Control',
    'public, max-age=600, s-maxage=86400, stale-while-revalidate=3600'
  )

  // 4. Only return what's needed (no compliance history etc. in list view)
  res.status(200).json(MASSACHUSETTS_FACILITIES.map(buildFacilityProfile))
}
