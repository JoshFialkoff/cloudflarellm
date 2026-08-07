import { listFacilities, getAverageCostByCity } from '../../lib/nocodb';

const FALLBACK_LIST = [
  { Id: 1, Facility_name: 'Sunrise of Newton', City: 'Newton', State: 'MA', Care_type: 'Assisted Living', Rating: 4.5, Monthly_cost_min: 6500, Monthly_cost_max: 8500, Zip: '02458', Address: '1 Sunrise Way', phone: '617-555-0101', Data_Source: 'Demo', Availability: 'Available' },
  { Id: 2, Facility_name: 'Brookdale Cambridge', City: 'Cambridge', State: 'MA', Care_type: 'Assisted Living', Rating: 4.2, Monthly_cost_min: 6800, Monthly_cost_max: 8800, Zip: '02140', Address: '2 Brookdale St', phone: '617-555-0102', Data_Source: 'Demo', Availability: 'Waitlist' },
  { Id: 3, Facility_name: 'Atria Worcester', City: 'Worcester', State: 'MA', Care_type: 'Memory Care', Rating: 4.0, Monthly_cost_min: 5200, Monthly_cost_max: 7200, Zip: '01608', Address: '3 Atria Blvd', phone: '508-555-0103', Data_Source: 'Demo', Availability: 'Available' },
  { Id: 4, Facility_name: 'Maplewood Springfield', City: 'Springfield', State: 'MA', Care_type: 'Assisted Living', Rating: 3.8, Monthly_cost_min: 4800, Monthly_cost_max: 6500, Zip: '01103', Address: '4 Maple Ave', phone: '413-555-0104', Data_Source: 'Demo', Availability: 'Available' },
  { Id: 5, Facility_name: 'Benchmark Lowell', City: 'Lowell', State: 'MA', Care_type: 'Assisted Living', Rating: 4.1, Monthly_cost_min: 5500, Monthly_cost_max: 7500, Zip: '01852', Address: '5 Benchmark Rd', phone: '978-555-0105', Data_Source: 'Demo', Availability: 'Limited' },
  { Id: 6, Facility_name: 'Brighton Gardens Boston', City: 'Boston', State: 'MA', Care_type: 'Assisted Living', Rating: 4.7, Monthly_cost_min: 7500, Monthly_cost_max: 9800, Zip: '02116', Address: '6 Brighton St', phone: '617-555-0106', Data_Source: 'Demo', Availability: 'Waitlist' },
  { Id: 7, Facility_name: 'Belmont Manor', City: 'Belmont', State: 'MA', Care_type: 'Memory Care', Rating: 4.3, Monthly_cost_min: 6200, Monthly_cost_max: 8200, Zip: '02478', Address: '7 Belmont Ln', phone: '617-555-0107', Data_Source: 'Demo', Availability: 'Available' },
  { Id: 8, Facility_name: 'Evergreen Framingham', City: 'Framingham', State: 'MA', Care_type: 'Assisted Living', Rating: 4.0, Monthly_cost_min: 5800, Monthly_cost_max: 7800, Zip: '01701', Address: '8 Evergreen Rd', phone: '508-555-0108', Data_Source: 'Demo', Availability: 'Available' },
];

const FALLBACK_BY_CITY = [
  { city: 'Boston', avgMin: 7200, avgMax: 9500, count: 12 },
  { city: 'Cambridge', avgMin: 6800, avgMax: 8800, count: 8 },
  { city: 'Worcester', avgMin: 5200, avgMax: 7200, count: 6 },
  { city: 'Springfield', avgMin: 4800, avgMax: 6500, count: 5 },
  { city: 'Lowell', avgMin: 5500, avgMax: 7500, count: 4 },
  { city: 'Newton', avgMin: 6500, avgMax: 8500, count: 3 },
];

export default async function handler(req, res) {
  try {
    const [{ list }, byCity] = await Promise.all([
      listFacilities({ limit: 100 }),
      getAverageCostByCity(),
    ]);
    return res.status(200).json({ list, byCity });
  } catch (e: any) {
    console.error('[api/answers-facilities]', e);
    if (!process.env.NOCODB_TOKEN) {
      console.warn('[api/answers-facilities] NOCODB_TOKEN missing; serving fallback demo data for staging.');
      return res.status(200).json({ list: FALLBACK_LIST, byCity: FALLBACK_BY_CITY });
    }
    return res.status(500).json({ error: 'Failed to load facility data' });
  }
}
