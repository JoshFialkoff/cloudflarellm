import { MASSACHUSETTS_FACILITIES } from "../../lib/massachusettsFacilities";
import { buildFacilityProfile } from "../../lib/facilityProfiles";

/** PostHog project API key for server-side capture (set in .env.production). */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || ''

/**
 * Fire-and-forget capture of blocked bot requests to PostHog.
 * Uses the PostHog batch API directly (no SDK dependency needed).
 */
async function captureBotBlocked(userAgent, headers) {
  if (!POSTHOG_KEY) return
  const distinctId = `bot:${userAgent.slice(0, 40).replace(/[^a-z0-9]/gi, '_')}`
  const ip = String(headers['x-forwarded-for'] || headers['x-real-ip'] || '').split(',')[0].trim()
  try {
    const payload = {
      api_key: POSTHOG_KEY,
      distinct_id: distinctId,
      event: 'bot_blocked',
      properties: {
        $ip: ip || 'unknown',
        bot_user_agent: userAgent.slice(0, 200),
        bot_operator: guessOperator(userAgent),
        endpoint: '/api/facilities',
        $geoip_disable: false,
      },
      timestamp: new Date().toISOString(),
    }
    await fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Non-blocking — analytics failures should never break the API
  }
}

function guessOperator(ua) {
  if (!ua) return 'unknown'
  const lower = ua.toLowerCase()
  if (lower.includes('gptbot')) return 'GPTBot'
  if (lower.includes('claude')) return 'ClaudeBot'
  if (lower.includes('anthropic')) return 'Anthropic'
  if (lower.includes('google-extended') || lower.includes('google-cloud-scout')) return 'Google-Extended'
  if (lower.includes('perplexity')) return 'PerplexityBot'
  if (lower.includes('ccbot')) return 'CCBot'
  if (lower.includes('cohere')) return 'Cohere'
  if (lower.includes('bytespider')) return 'Bytespider'
  if (lower.includes('applebot-extended')) return 'Applebot-Extended'
  if (lower.includes('amazonbot')) return 'Amazonbot'
  if (lower.includes('semrush')) return 'Semrush'
  if (lower.includes('ahrefs')) return 'AhrefsBot'
  if (lower.includes('dataforseo')) return 'DataForSeoBot'
  if (lower.includes('oai-searchbot')) return 'OAI-SearchBot'
  return 'other_crawler'
}

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
    // Fire-and-forget capture to PostHog for monitoring
    captureBotBlocked(userAgent, req.headers).catch(() => {})
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
