
import { listFacilities, getAverageCostByCity } from '../../lib/nocodb';

export default async function handler(req, res) {
  try {
    const [{ list }, byCity] = await Promise.all([
      listFacilities({ limit: 100 }),
      getAverageCostByCity(),
    ]);
    return res.status(200).json({ list, byCity });
  } catch (e) {
    console.error('[api/answers-facilities]', e);
    return res.status(500).json({ error: 'Failed to load facility data' });
  }
}
