import { fetchFacilityKbInsight } from '../../lib/facilityKbInsight'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const facilityName =
    typeof req.body?.facilityName === 'string'
      ? req.body.facilityName.trim()
      : typeof req.body?.facility_name === 'string'
        ? req.body.facility_name.trim()
        : ''

  if (!facilityName) {
    return res.status(400).json({ error: 'facilityName is required' })
  }

  const result = await fetchFacilityKbInsight({
    facilityName,
    slug: typeof req.body?.slug === 'string' ? req.body.slug : '',
    careType: typeof req.body?.careType === 'string' ? req.body.careType : '',
    location: typeof req.body?.location === 'string' ? req.body.location : '',
    zipCode: typeof req.body?.zipCode === 'string' ? req.body.zipCode : '',
    town: typeof req.body?.town === 'string' ? req.body.town : '',
  })

  if (!result.configured) {
    return res.status(503).json({
      configured: false,
      insight: '',
      error: 'Facility KB insight is not configured on this server.',
    })
  }

  res.setHeader('Cache-Control', 'private, max-age=300')
  return res.status(200).json({
    configured: true,
    insight: result.insight || '',
    metroArea: result.metroArea || '',
    cached: Boolean(result.cached),
    error: result.error || null,
  })
}
