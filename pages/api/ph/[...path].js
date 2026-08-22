/**
 * PostHog proxy endpoint.
 * Routes /ph/* to https://us.i.posthog.com/* so PostHog events
 * bypass ad-blockers by travelling same-origin through assistedly.ai.
 */

export const config = {
  api: {
    bodyParser: false,
  },
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

export default async function handler(req, res) {
  const { path } = req.query
  const phPath = Array.isArray(path) ? path.join('/') : path || ''

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, v))
    } else {
      search.set(key, value)
    }
  }
  const qs = search.toString()
  const targetUrl = `https://us.i.posthog.com/${phPath}${qs ? '?' + qs : ''}`

  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() === 'host') continue
    headers[key] = value
  }

  let body
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await streamToBuffer(req)
    } catch {
      body = undefined
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    })

    res.status(response.status)
    response.headers.forEach((value, key) => {
      // Skip hop-by-hop headers that Node.js res shouldn't receive
      const lower = key.toLowerCase()
      if (['transfer-encoding', 'connection', 'keep-alive'].includes(lower)) return
      res.setHeader(key, value)
    })

    const text = await response.text()
    res.send(text)
  } catch (err) {
    console.error('[PostHog Proxy Error]', err)
    res.status(502).json({ error: 'Proxy failed' })
  }
}
