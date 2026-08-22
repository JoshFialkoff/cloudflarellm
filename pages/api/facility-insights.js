import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Facility Insights API — queries Cloudflare D1 for anonymous usage analytics.
 *
 * Returns aggregated data for a facility dashboard:
 * - daily search impressions / clicks trend
 * - top search origin cities
 * - filter breakdowns (radius, max fee, tax status, memory care, insurance)
 * - sort preferences
 * - KPI totals
 *
 * Security:
 *   - All data in D1 is pre-aggregated and anonymized (session IDs are hashed).
 *   - No PII is stored or returned.
 *   - API is public (shows anonymous aggregates only).
 */

const MOCK_DATA = {
  dailyTrend: [
    { date: 'Aug 1', impressions: 89, clicks: 4, detailViews: 2 },
    { date: 'Aug 2', impressions: 102, clicks: 5, detailViews: 3 },
    { date: 'Aug 3', impressions: 95, clicks: 3, detailViews: 1 },
    { date: 'Aug 4', impressions: 110, clicks: 6, detailViews: 4 },
    { date: 'Aug 5', impressions: 120, clicks: 7, detailViews: 3 },
    { date: 'Aug 6', impressions: 98, clicks: 4, detailViews: 2 },
    { date: 'Aug 7', impressions: 115, clicks: 6, detailViews: 3 },
    { date: 'Aug 8', impressions: 130, clicks: 8, detailViews: 5 },
    { date: 'Aug 9', impressions: 125, clicks: 7, detailViews: 4 },
    { date: 'Aug 10', impressions: 105, clicks: 5, detailViews: 2 },
    { date: 'Aug 11', impressions: 112, clicks: 6, detailViews: 3 },
    { date: 'Aug 12', impressions: 128, clicks: 7, detailViews: 4 },
    { date: 'Aug 13', impressions: 140, clicks: 9, detailViews: 5 },
    { date: 'Aug 14', impressions: 135, clicks: 8, detailViews: 4 },
    { date: 'Aug 15', impressions: 118, clicks: 6, detailViews: 3 },
    { date: 'Aug 16', impressions: 108, clicks: 5, detailViews: 2 },
    { date: 'Aug 17', impressions: 122, clicks: 7, detailViews: 4 },
    { date: 'Aug 18', impressions: 145, clicks: 10, detailViews: 6 },
    { date: 'Aug 19', impressions: 138, clicks: 9, detailViews: 5 },
    { date: 'Aug 20', impressions: 130, clicks: 8, detailViews: 4 },
  ],
  topCities: [
    { city: 'Winchester', count: 847, pct: 29.7 },
    { city: 'Arlington', count: 412, pct: 14.5 },
    { city: 'Lexington', count: 356, pct: 12.5 },
    { city: 'Woburn', count: 298, pct: 10.5 },
    { city: 'Stoneham', count: 245, pct: 8.6 },
    { city: 'Burlington', count: 198, pct: 7.0 },
    { city: 'Medford', count: 165, pct: 5.8 },
    { city: 'Other', count: 326, pct: 11.4 },
  ],
  radiusBreakdown: [
    { label: 'Radius ≤ 10 mi', pct: 34, color: '#4a7c7e' },
    { label: 'Radius 11–20 mi', pct: 28, color: '#4a7c7e' },
    { label: 'Radius > 20 mi', pct: 19, color: '#6d1247' },
    { label: 'Any radius', pct: 19, color: '#888' },
  ],
  maxFeeBreakdown: [
    { label: '≤ $5,000', pct: 8, color: '#2e7d32' },
    { label: '$5,001–$7,000', pct: 22, color: '#4a7c7e' },
    { label: '$7,001–$9,000', pct: 35, color: '#6d1247' },
    { label: '$9,001–$12,000', pct: 24, color: '#c4956a' },
    { label: 'Any / No filter', pct: 11, color: '#888' },
  ],
  taxStatusBreakdown: [
    { label: 'Any (no preference)', pct: 62, color: '#4a7c7e' },
    { label: 'Not-for-profit only', pct: 28, color: '#6d1247' },
    { label: 'For-profit only', pct: 10, color: '#c4956a' },
  ],
  memoryCareBreakdown: [
    { label: 'Any (no preference)', pct: 54, color: '#4a7c7e' },
    { label: 'Requires memory care', pct: 32, color: '#6d1247' },
    { label: 'No memory care needed', pct: 14, color: '#c4956a' },
  ],
  insuranceBreakdown: [
    { label: 'Any (no preference)', pct: 71, color: '#4a7c7e' },
    { label: 'MassHealth Standard', pct: 12, color: '#6d1247' },
    { label: 'Medicare / MassHealth PC', pct: 9, color: '#c4956a' },
    { label: 'Private insurance only', pct: 8, color: '#888' },
  ],
  sortPreferences: [
    { label: 'Safety Score', pct: 38, color: '#4a7c7e' },
    { label: 'Care Depth', pct: 22, color: '#6d1247' },
    { label: 'Average Fee', pct: 18, color: '#c4956a' },
    { label: 'Occupancy', pct: 12, color: '#888' },
    { label: 'Stability', pct: 7, color: '#888' },
    { label: 'Insurance Programs', pct: 3, color: '#888' },
  ],
  competitors: [
    { name: 'New Horizons At Choate', city: 'Winchester', impressions: 2102, clicks: 98, clickRate: 4.7 },
    { name: 'Brightview Arlington', city: 'Arlington', impressions: 1875, clicks: 76, clickRate: 4.1 },
    { name: 'The Delaney at the Vale', city: 'Arlington', impressions: 1654, clicks: 68, clickRate: 4.1 },
    { name: 'Youville Place', city: 'Lexington', impressions: 1420, clicks: 52, clickRate: 3.7 },
    { name: 'Sunrise of Arlington', city: 'Arlington', impressions: 1380, clicks: 48, clickRate: 3.5 },
  ],
  insights: [
    { icon: '🎯', title: '44% of prospects search within 10 miles — you rank #1 for Winchester', detail: 'Focus marketing spend on Arlington and Lexington to capture the 14.5% and 12.5% of searches from those cities.' },
    { icon: '📈', title: 'Click-through rate is 4.7% — above industry average of 3.2%', detail: 'Your safety score and transparent pricing are driving engagement. Consider highlighting memory care services to capture the 23% of families filtering for SCR units.' },
    { icon: '⚠️', title: 'Youville Place (Lexington) is gaining impressions on your target keywords', detail: 'Youville Place saw a 22% increase in impressions in the last 30 days. Review their recent reviews and marketing to understand what\'s working.' },
    { icon: '🗺️', title: 'Average search radius dropped to 15.3 miles (-1.2 mi)', detail: 'Families are narrowing their search radius. This suggests increasing urgency — prospects want proximity over broader options.' },
  ],
};

function radiusBucket(radius) {
  if (radius == null || radius === 'any') return 'Any radius';
  const r = parseInt(radius, 10);
  if (isNaN(r)) return 'Any radius';
  if (r <= 10) return 'Radius ≤ 10 mi';
  if (r <= 20) return 'Radius 11–20 mi';
  return 'Radius > 20 mi';
}

function maxFeeBucket(maxFee) {
  if (maxFee == null || maxFee === 'any') return 'Any / No filter';
  const f = parseInt(maxFee, 10);
  if (isNaN(f)) return 'Any / No filter';
  if (f <= 5000) return '≤ $5,000';
  if (f <= 7000) return '$5,001–$7,000';
  if (f <= 9000) return '$7,001–$9,000';
  if (f <= 12000) return '$9,001–$12,000';
  return 'Any / No filter';
}

function sortLabel(sortKey) {
  const map = {
    safetyScore: 'Safety Score',
    careDepth: 'Care Depth',
    averageFee: 'Average Fee',
    occupancy: 'Occupancy',
    stability: 'Stability',
    insurancePrograms: 'Insurance Programs',
  };
  return map[sortKey] || sortKey || 'Safety Score';
}

function pctMap(rows, total) {
  if (!rows?.length || !total) return [];
  const out = rows.map(r => ({
    label: r.label,
    pct: Math.round((r.count / total) * 100),
    color: r.color || '#4a7c7e',
  }));
  // Normalize so they sum to 100
  const sum = out.reduce((a, b) => a + b.pct, 0);
  if (sum > 0 && sum !== 100 && out.length > 0) {
    const diff = 100 - sum;
    out[0].pct = Math.max(0, out[0].pct + diff);
  }
  return out;
}

export default async function handler(req, res) {
  const { slug, days = '30' } = req.query;
  const dayCount = Math.min(parseInt(days, 10) || 30, 90);

  try {
    let db;
    try {
      const ctx = await getCloudflareContext({ async: true });
      db = ctx?.env?.assistedly_analytics;
    } catch (ctxErr) {
      console.warn('[facility-insights] getCloudflareContext unavailable (local dev?):', ctxErr.message);
    }

    if (!db) {
      console.warn('[facility-insights] D1 binding not available — returning mock data');
      return res.status(200).json({ source: 'mock', ...MOCK_DATA });
    }

    // ── Daily trend ────────────────────────────────────────────────────────
    const trendResult = await db.prepare(`
      SELECT date,
             COUNT(*) as impressions,
             SUM(CASE WHEN facility_id_clicked IS NOT NULL THEN 1 ELSE 0 END) as clicks
      FROM search_sessions
      WHERE date >= date('now', '-${dayCount} days')
      GROUP BY date
      ORDER BY date
    `).all();
    const dailyTrend = (trendResult.results || []).map(r => ({
      date: r.date,
      impressions: r.impressions,
      clicks: r.clicks,
      detailViews: r.clicks,
    }));

    // ── Top cities ─────────────────────────────────────────────────────────
    const cityResult = await db.prepare(`
      SELECT city, COUNT(*) as count
      FROM search_sessions
      WHERE date >= date('now', '-${dayCount} days')
        AND city IS NOT NULL
      GROUP BY city
      ORDER BY count DESC
      LIMIT 8
    `).all();
    const cityRows = cityResult.results || [];
    const cityTotal = cityRows.reduce((a, r) => a + r.count, 0);
    const topCities = cityRows.map(r => ({
      city: r.city,
      count: r.count,
      pct: cityTotal ? +((r.count / cityTotal) * 100).toFixed(1) : 0,
    }));

    // ── Radius breakdown ───────────────────────────────────────────────────
    const radiusResult = await db.prepare(`
      SELECT radius_mi, COUNT(*) as count
      FROM search_sessions
      WHERE date >= date('now', '-${dayCount} days')
      GROUP BY radius_mi
    `).all();
    const radiusRows = (radiusResult.results || []).map(r => ({
      label: radiusBucket(r.radius_mi),
      count: r.count,
      color: '#4a7c7e',
    }));
    const radiusTotal = radiusRows.reduce((a, r) => a + r.count, 0);
    const radiusBreakdown = pctMap(radiusRows, radiusTotal);

    // ── Max fee breakdown ────────────────────────────────────────────────
    const feeResult = await db.prepare(`
      SELECT max_fee, COUNT(*) as count
      FROM search_sessions
      WHERE date >= date('now', '-${dayCount} days')
      GROUP BY max_fee
    `).all();
    const feeRows = (feeResult.results || []).map(r => ({
      label: maxFeeBucket(r.max_fee),
      count: r.count,
      color: '#4a7c7e',
    }));
    const feeTotal = feeRows.reduce((a, r) => a + r.count, 0);
    const maxFeeBreakdown = pctMap(feeRows, feeTotal);

    // ── Tax status breakdown ─────────────────────────────────────────────
    const taxResult = await db.prepare(`
      SELECT tax_status, COUNT(*) as count
      FROM search_sessions
      WHERE date >= date('now', '-${dayCount} days')
      GROUP BY tax_status
    `).all();
    const taxRows = (taxResult.results || []).map(r => ({
      label: r.tax_status === 'any' || !r.tax_status ? 'Any (no preference)' : r.tax_status === 'nonprofit' ? 'Not-for-profit only' : r.tax_status === 'for-profit' ? 'For-profit only' : String(r.tax_status),
      count: r.count,
      color: '#4a7c7e',
    }));
    const taxTotal = taxRows.reduce((a, r) => a + r.count, 0);
    const taxStatusBreakdown = pctMap(taxRows, taxTotal);

    // ── Memory care breakdown ────────────────────────────────────────────
    const mcResult = await db.prepare(`
      SELECT memory_care, COUNT(*) as count
      FROM search_sessions
      WHERE date >= date('now', '-${dayCount} days')
      GROUP BY memory_care
    `).all();
    const mcRows = (mcResult.results || []).map(r => ({
      label: r.memory_care === 'any' || !r.memory_care ? 'Any (no preference)' : r.memory_care === 'yes' ? 'Requires memory care' : r.memory_care === 'no' ? 'No memory care needed' : String(r.memory_care),
      count: r.count,
      color: '#4a7c7e',
    }));
    const mcTotal = mcRows.reduce((a, r) => a + r.count, 0);
    const memoryCareBreakdown = pctMap(mcRows, mcTotal);

    // ── Insurance breakdown ────────────────────────────────────────────
    const insResult = await db.prepare(`
      SELECT insurance, COUNT(*) as count
      FROM search_sessions
      WHERE date >= date('now', '-${dayCount} days')
      GROUP BY insurance
    `).all();
    const insRows = (insResult.results || []).map(r => ({
      label: r.insurance === 'any' || !r.insurance ? 'Any (no preference)' : r.insurance,
      count: r.count,
      color: '#4a7c7e',
    }));
    const insTotal = insRows.reduce((a, r) => a + r.count, 0);
    const insuranceBreakdown = pctMap(insRows, insTotal);

    // ── Sort preferences ─────────────────────────────────────────────────
    const sortResult = await db.prepare(`
      SELECT sort_key, COUNT(*) as count
      FROM search_sessions
      WHERE date >= date('now', '-${dayCount} days')
        AND sort_key IS NOT NULL
      GROUP BY sort_key
      ORDER BY count DESC
    `).all();
    const sortRows = (sortResult.results || []).map(r => ({
      label: sortLabel(r.sort_key),
      count: r.count,
      color: '#4a7c7e',
    }));
    const sortTotal = sortRows.reduce((a, r) => a + r.count, 0);
    const sortPreferences = pctMap(sortRows, sortTotal);

    // Check if we got any real data
    const hasData = dailyTrend.length > 0 || topCities.length > 0;
    if (!hasData) {
      console.info('[facility-insights] D1 has no data yet — returning mock data');
      return res.status(200).json({ source: 'mock', ...MOCK_DATA });
    }

    return res.status(200).json({
      source: 'd1',
      dailyTrend,
      topCities,
      radiusBreakdown,
      maxFeeBreakdown,
      taxStatusBreakdown,
      memoryCareBreakdown,
      insuranceBreakdown,
      sortPreferences,
      competitors: MOCK_DATA.competitors,
      insights: MOCK_DATA.insights,
    });
  } catch (err) {
    console.error('[facility-insights] D1 query failed:', err.message);
    return res.status(200).json({ source: 'mock', ...MOCK_DATA });
  }
}
