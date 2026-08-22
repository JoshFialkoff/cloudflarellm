const { checkRateLimit } = require('../../lib/rateLimit')

/** Discord incoming webhook helpers (plain `content`, no embeds). */
async function postDiscordWebhook(webhookUrl, content) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Discord webhook failed (${res.status}): ${body.slice(0, 300)}`)
  }
}

/**
 * Discord message content max is 2000; stay under with margin.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string[]}
 */
function splitDiscordContent(text, maxLen = 1900) {
  const t = String(text || '').trim()
  if (!t) return []
  if (t.length <= maxLen) return [t]
  const chunks = []
  let rest = t
  while (rest.length) {
    if (rest.length <= maxLen) {
      chunks.push(rest)
      break
    }
    let slice = rest.slice(0, maxLen)
    const nl = slice.lastIndexOf('\n')
    if (nl > maxLen * 0.6) slice = slice.slice(0, nl)
    chunks.push(slice.trimEnd())
    rest = rest.slice(slice.length).trimStart()
  }
  return chunks
}

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1402792384974159962/KHa3w8OSxmYOm7ClUcuWRO63bibl1o1GU0xYT3mk6WhS1ROY0VhJm0_gGqiYAZA4DIEn'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  const limitKey = `ask-discord:${clientIp}`
  const limit = checkRateLimit(limitKey, { maxRequests: 5, windowMs: 60 * 1000 })
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' })
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : ''
  if (!question || question.length < 2) {
    return res.status(400).json({ error: 'A question is required.' })
  }
  if (question.length > 4000) {
    return res.status(400).json({ error: 'Question is too long (max 4000 characters).' })
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) : 'Anonymous'
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().slice(0, 254) : ''
  const source = typeof req.body?.source === 'string' ? req.body.source.trim().slice(0, 200) : ''

  const lines = [
    '**New open-ended question**',
    `From: **${name}**`,
  ]
  if (email) lines.push(`Email: ${email}`)
  if (source) lines.push(`Source: ${source}`)
  lines.push('', `\u2753 **Question:**\n${question}`)

  const fullContent = lines.join('\n')

  try {
    const chunks = splitDiscordContent(fullContent)
    for (const chunk of chunks) {
      await postDiscordWebhook(WEBHOOK_URL, chunk)
    }
    return res.status(200).json({ ok: true, message: 'Question sent.' })
  } catch (err) {
    console.error('Discord webhook error:', err.message)
    return res.status(502).json({ error: 'Could not send question. Please try again later.' })
  }
}
