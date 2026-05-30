const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidPhoneOrEmail(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return false
  if (trimmed.length > 254) return false
  if (EMAIL_RE.test(trimmed)) return true
  const digits = trimmed.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const webhookUrl =
    process.env.DISCORD_CONCIERGE_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL

  if (!webhookUrl?.startsWith('https://discord.com/api/webhooks/')) {
    return res.status(503).json({ error: 'AI failure notifications are not configured' })
  }

  const contact = String(req.body?.contact || '').trim()
  const errorMessage = String(req.body?.errorMessage || '').trim()
  const userId = String(req.body?.userId || '').trim()
  const conversationId = String(req.body?.conversationId || '').trim()
  const currentUrl = String(req.body?.currentUrl || '').trim()
  const stage = String(req.body?.stage || 'error').trim()

  if (!errorMessage) {
    return res.status(400).json({ error: 'Error message required' })
  }

  if (contact && !isValidPhoneOrEmail(contact)) {
    return res.status(400).json({ error: 'Valid phone number or email required' })
  }

  const description = [
    `**Stage:** ${stage || 'error'}`,
    contact ? `**Contact:** ${contact}` : '',
    `**Error:** ${errorMessage.slice(0, 1800)}`,
    userId ? `**User ID:** ${userId}` : '',
    conversationId ? `**Conversation ID:** ${conversationId}` : '',
    currentUrl ? `**Page:** ${currentUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const discordRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: contact ? 'AI chat failure follow-up request' : 'AI chat failure alert',
          description,
          color: 0xea580c,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  })

  if (!discordRes.ok) {
    const text = await discordRes.text().catch(() => '')
    console.error('AI failure webhook failed', discordRes.status, text)
    return res.status(502).json({ error: 'Could not notify our team. Please try again.' })
  }

  return res.status(200).json({ ok: true })
}
