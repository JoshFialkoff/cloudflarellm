export default async function handler(req, res) {
  const raw = req.query.path
  const path = Array.isArray(raw) ? raw[0] : raw

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Path parameter is required' })
  }

  const filename = path.split('/').pop()
  const possiblePaths = [
    `https://aiassistliving.com/wp-content/uploads/${path}`,
    `https://aiassistliving.com/wp-content/uploads/2026/02/${filename}`,
    `https://aiassistliving.com/wp-content/uploads/2026/02/${filename.replace('.jpg', '-scaled.jpg')}`,
    `https://aiassistliving.com/wp-content/uploads/2026/02/${filename.replace('-683x1024.jpg', '-scaled-683x1024.jpg')}`,
    `https://aiassistliving.com/wp-content/uploads/2026/01/${filename}`,
    `https://aiassistliving.com/wp-content/uploads/2026/01/${filename.replace('.jpg', '-scaled.jpg')}`,
    `https://aiassistliving.com/wp-content/uploads/2026/01/${filename.replace('-683x1024.jpg', '-scaled-683x1024.jpg')}`,
  ]

  for (const url of possiblePaths) {
    try {
      const response = await fetch(url)

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const ct = response.headers.get('content-type') || 'application/octet-stream'
        res.setHeader('Content-Type', ct)
        res.setHeader('Cache-Control', 'public, max-age=31536000')
        return res.send(buffer)
      }
    } catch {
      continue
    }
  }

  return res.status(404).json({ error: 'Image not found' })
}
