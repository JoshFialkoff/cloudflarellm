import { consumeDifySseLines } from '../../lib/difySse'
const { getSession } = require('../../lib/serverAuth')

const DEEP_DIVE_BASE_URL = 'https://dify.forwardjump.com/v1'
const TEASER_CHARS = 280

function buildDeepDiveQuery(facility) {
  const compHistory = facility.complianceHistory
    .map((r) => `  - ${r.date} (${r.type}): ${r.findings} [${r.status}]`)
    .join('\n')
  const amenityList = facility.amenities.map((a) => a.name).join(', ')

  return `You are an expert assisted living advisor helping Massachusetts families make placement decisions. Provide a thorough but concise deep-dive analysis of the following facility.

Facility: ${facility.name}
Address: ${facility.address}
Overall Rating: ${facility.rating}/5.0
Compliance Standing: ${facility.complianceRating}
Care Types: ${facility.careTypes.join(', ')}
Monthly Cost Range: $${facility.monthlyMin.toLocaleString()} – $${facility.monthlyMax.toLocaleString()}
Total Capacity: ${facility.capacity} residents
Amenities: ${amenityList}

Compliance History:
${compHistory}

About: ${facility.about}

Please structure your response as:
1. Safety & Quality Overview (2-3 sentences interpreting the rating and compliance standing)
2. What the Compliance Record Tells Us (2-3 sentences analyzing patterns in the inspection history)
3. Value Assessment (2-3 sentences on whether the cost is justified relative to care quality and amenities)
4. Key Questions to Ask on Tour (list 3–4 specific, data-driven questions families should ask)
5. Best-Fit Resident Profile (2-3 sentences describing who would thrive here)
6. Concerns or Red Flags (any notable issues; write "None identified" if none)
7. Overall Recommendation (1-2 sentences)

Be specific, grounded in the data provided, and genuinely helpful for families making this important decision.`
}

function setStreamHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('CDN-Cache-Control', 'no-store')
  res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Connection', 'keep-alive')
}

function teaserCut(text) {
  const cut = String(text || '').slice(0, TEASER_CHARS).trimEnd()
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut) + '…'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const facility = req.body?.facility
  if (!facility || typeof facility.name !== 'string') {
    return res.status(400).json({ error: 'facility data is required' })
  }

  const apiKey = String(process.env.FACILITY_DEEP_DIVE_DIFY_API_KEY || '').trim()
  const baseUrl = String(
    process.env.FACILITY_DEEP_DIVE_DIFY_BASE_URL || DEEP_DIVE_BASE_URL
  ).replace(/\/$/, '')

  if (!apiKey) {
    return res.status(503).json({ error: 'AI deep-dive is not configured on this server.' })
  }

  const session = getSession(req)
  const isAuthenticated = Boolean(session)

  setStreamHeaders(res)
  res.status(200)
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  let upstream
  try {
    upstream = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: buildDeepDiveQuery(facility),
        response_mode: 'streaming',
        user: `facility-deepdive-${facility.slug || 'unknown'}`,
      }),
    })
  } catch (err) {
    console.error('facility-deep-dive fetch error', err)
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: 'AI analysis is temporarily unavailable. Please try again.' })}\n\n`
    )
    res.end()
    return
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => upstream.statusText)
    console.error('facility-deep-dive upstream error', upstream.status, errText)
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: 'AI analysis is temporarily unavailable. Please try again.' })}\n\n`
    )
    res.end()
    return
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let sseBuffer = ''
  let accumulated = ''
  let closed = false

  function finish(eventObj) {
    if (closed) return
    closed = true
    try {
      res.write(`data: ${JSON.stringify(eventObj)}\n\n`)
      res.end()
    } catch {
      // client disconnected
    }
  }

  function emitToken(text) {
    if (closed) return
    try {
      res.write(`data: ${JSON.stringify({ type: 'token', text })}\n\n`)
    } catch {
      closed = true
    }
  }

  try {
    while (!closed) {
      const { done, value } = await reader.read()
      if (done) break

      sseBuffer = consumeDifySseLines(
        sseBuffer,
        decoder.decode(value, { stream: true }),
        {
          onAnswerDelta(delta) {
            if (closed || !delta) return

            if (!isAuthenticated) {
              const space = TEASER_CHARS - accumulated.length
              if (space <= 0) {
                finish({ type: 'locked', teaser: teaserCut(accumulated) })
                return
              }
              const toEmit = delta.length > space ? delta.slice(0, space) : delta
              accumulated += toEmit
              emitToken(toEmit)
              if (accumulated.length >= TEASER_CHARS) {
                finish({ type: 'locked', teaser: teaserCut(accumulated) })
              }
            } else {
              accumulated += delta
              emitToken(delta)
            }
          },
          onEnd() {
            if (isAuthenticated) {
              finish({ type: 'done' })
            } else {
              finish({ type: 'locked', teaser: teaserCut(accumulated) })
            }
          },
          onError(msg) {
            finish({ type: 'error', message: msg || 'Stream error.' })
          },
        }
      )
    }
  } catch (err) {
    if (!closed) {
      console.error('facility-deep-dive stream read error', err)
      finish({ type: 'error', message: 'Stream interrupted. Please try again.' })
    }
    return
  } finally {
    try { reader.cancel() } catch { /* ignore */ }
  }

  // Fallback if onEnd was never called (e.g. Dify closed without message_end)
  if (!closed) {
    if (isAuthenticated) {
      finish({ type: 'done' })
    } else {
      finish({ type: 'locked', teaser: teaserCut(accumulated) })
    }
  }
}
