const facilities = [
  { id: 1, name: 'Sunrise Senior Living of Boston', city: 'Boston', address: '123 Commonwealth Ave, Boston, MA 02115', careTypes: ['Assisted Living', 'Memory Care'], complianceRating: 'Excellent', monthlyMin: 4500, monthlyMax: 7500 },
  { id: 2, name: 'Cambridge Care & Rehabilitation', city: 'Cambridge', address: '456 Massachusetts Ave, Cambridge, MA 02139', careTypes: ['Skilled Nursing', 'Assisted Living'], complianceRating: 'Good', monthlyMin: 5200, monthlyMax: 8500 },
  { id: 3, name: 'Newton Highlands Senior Community', city: 'Newton', address: '789 Chestnut St, Newton, MA 02461', careTypes: ['Independent Living', 'Assisted Living'], complianceRating: 'Excellent', monthlyMin: 3800, monthlyMax: 6200 },
  { id: 4, name: 'Worcester Memory Care Center', city: 'Worcester', address: '321 Park Ave, Worcester, MA 01609', careTypes: ['Memory Care', 'Skilled Nursing'], complianceRating: 'Good', monthlyMin: 4000, monthlyMax: 6800 },
  { id: 5, name: 'Springfield Elder Care Village', city: 'Springfield', address: '654 Main St, Springfield, MA 01103', careTypes: ['Independent Living', 'Assisted Living', 'Memory Care'], complianceRating: 'Needs Improvement', monthlyMin: 2800, monthlyMax: 5500 },
  { id: 6, name: 'Brookline Premier Assisted Living', city: 'Brookline', address: '987 Beacon St, Brookline, MA 02446', careTypes: ['Assisted Living', 'Memory Care'], complianceRating: 'Excellent', monthlyMin: 5500, monthlyMax: 9000 },
]

export default function handler(req, res) {
  res.status(200).json(facilities)
}
