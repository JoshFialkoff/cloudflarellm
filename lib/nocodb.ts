const NOCODB_URL = process.env.NOCODB_URL || 'http://23.95.189.106:8080';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';

const BASE1 = 'py95wcp6hdidnbz'; // Original AI Assisted Living

export interface NocoRecord {
  [k: string]: unknown;
}

async function ncFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${NOCODB_URL}${path}`, {
    ...opts,
    headers: {
      'xc-token': NOCODB_TOKEN,
      Accept: 'application/json',
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`NocoDB ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/* ─── Facilities Master ─── */
const FACILITIES_TABLE = 'm27a78vd4i6c1bc';

export interface FacilityRecord {
  Id: number;
  Facility_name: string;
  Address: string;
  City: string;
  State: string;
  Zip: string;
  phone: string;
  Care_type: string;
  Data_Source: string;
  Rating: number | null;
  Monthly_cost_min: number | null;
  Monthly_cost_max: number | null;
  Availability: string;
}

export async function listFacilities(options?: {
  limit?: number;
  offset?: number;
  where?: string;
  sort?: string;
}): Promise<{ list: FacilityRecord[]; pageInfo: { totalRows: number } }> {
  const { limit = 100, offset = 0, where, sort } = options || {};
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (where) params.set('where', where);
  if (sort) params.set('sort', sort);
  return ncFetch(`/api/v2/tables/${FACILITIES_TABLE}/records?${params.toString()}`);
}

export async function getAverageCostByCity(limit = 100):
  Promise<{ city: string; avgMin: number; avgMax: number; count: number }[]> {
  const { list } = await listFacilities({ limit });
  const map = new Map<string, { mins: number[]; maxs: number[] }>();
  for (const f of list) {
    if (!f.City || f.Monthly_cost_min == null || f.Monthly_cost_max == null) continue;
    const entry = map.get(f.City) || { mins: [], maxs: [] };
    entry.mins.push(Number(f.Monthly_cost_min));
    entry.maxs.push(Number(f.Monthly_cost_max));
    map.set(f.City, entry);
  }
  return Array.from(map.entries())
    .map(([city, vals]) => ({
      city,
      avgMin: Math.round(vals.mins.reduce((a, b) => a + b, 0) / vals.mins.length),
      avgMax: Math.round(vals.maxs.reduce((a, b) => a + b, 0) / vals.maxs.length),
      count: vals.mins.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export async function getAverageCostByZip(limit = 500):
  Promise<{ zip: string; avgMin: number; avgMax: number; count: number }[]> {
  const { list } = await listFacilities({ limit });
  const map = new Map<string, { mins: number[]; maxs: number[] }>();
  for (const f of list) {
    if (!f.Zip || f.Monthly_cost_min == null || f.Monthly_cost_max == null) continue;
    const entry = map.get(f.Zip) || { mins: [], maxs: [] };
    entry.mins.push(Number(f.Monthly_cost_min));
    entry.maxs.push(Number(f.Monthly_cost_max));
    map.set(f.Zip, entry);
  }
  return Array.from(map.entries())
    .map(([zip, vals]) => ({
      zip,
      avgMin: Math.round(vals.mins.reduce((a, b) => a + b, 0) / vals.mins.length),
      avgMax: Math.round(vals.maxs.reduce((a, b) => a + b, 0) / vals.maxs.length),
      count: vals.mins.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

/* ─── Reviews table ─── */
const REVIEWS_TABLE = 'my7eegc8d0lge70';

export async function listReviews(options?: { limit?: number; offset?: number }) {
  const { limit = 50, offset = 0 } = options || {};
  return ncFetch(`/api/v2/tables/${REVIEWS_TABLE}/records?limit=${limit}&offset=${offset}`);
}
