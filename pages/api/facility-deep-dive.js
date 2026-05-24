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
  const baseUrl = String(process.env.FACILITY_DEEP_DIVE_DIFY_BASE_URL || DEEP_DIVE_BASE_URL).replace(/\/$/, '')

  if (!apiKey) {
    return res.status(503).json({ error: 'AI deep-dive is not configured on this server.' })
  }

  let answer = ''
  try {
    const upstream = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: buildDeepDiveQuery(facility),
        response_mode: 'blocking',
        user: `facility-deepdive-${facility.slug || 'unknown'}`,
      }),
    })

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => upstream.statusText)
      console.error('facility-deep-dive upstream error', upstream.status, errText)
      return res.status(502).json({ error: 'AI analysis is temporarily unavailable. Please try again.' })
    }

    const data = await upstream.json()
    answer = typeof data.answer === 'string' ? data.answer.trim() : ''
  } catch (err) {
    console.error('facility-deep-dive fetch error', err)
    return res.status(502).json({ error: 'AI analysis is temporarily unavailable. Please try again.' })
  }

  if (!answer) {
    return res.status(502).json({ error: 'AI analysis returned an empty response. Please try again.' })
  }

  const session = getSession(req)
  if (!session) {
    const cut = answer.slice(0, TEASER_CHARS).trimEnd()
    const lastSpace = cut.lastIndexOf(' ')
    const teaser = (lastSpace > 60 ? cut.slice(0, lastSpace) : cut) + '…'
    return res.status(200).json({ locked: true, teaser })
  }

  return res.status(200).json({ locked: false, content: answer })
}
