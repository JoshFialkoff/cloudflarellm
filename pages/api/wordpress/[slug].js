import { getPageBySlug } from '../../../lib/wordpress'

export default async function handler(req, res) {
  const { slug } = req.query

  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter' })
  }

  try {
    const page = await getPageBySlug(slug)
    if (page) {
      res.status(200).json(page)
    } else {
      res.status(404).json({ error: 'Page not found' })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
