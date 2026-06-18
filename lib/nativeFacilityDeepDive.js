function latestComplianceRows(facility, limit = 3) {
  return Array.isArray(facility.complianceHistory)
    ? facility.complianceHistory.slice(0, limit)
    : []
}

function amenityNames(facility, limit = 6) {
  if (!Array.isArray(facility.amenities)) return []
  return facility.amenities.slice(0, limit).map((item) => item.name)
}

export function buildNativeFacilityDeepDiveReport(facility) {
  const name = facility.name || 'This facility'
  const rating = Number(facility.rating || 0).toFixed(1)
  const compliance = facility.complianceRating || 'Unknown'
  const careTypes = Array.isArray(facility.careTypes) ? facility.careTypes.join(', ') : 'Assisted living'
  const costLow = Number(facility.monthlyMin || 0).toLocaleString('en-US')
  const costHigh = Number(facility.monthlyMax || 0).toLocaleString('en-US')
  const capacity = facility.capacity || 'N/A'
  const amenities = amenityNames(facility)
  const complianceRows = latestComplianceRows(facility)
  const latest = complianceRows[0]
  const redFlags =
    compliance === 'Needs Improvement'
      ? '- Recent inspection pattern suggests families should verify corrective actions before signing.'
      : 'None identified from the Massachusetts records shown here.'

  const tourQuestions = [
    `How does staffing on evenings and weekends compare with weekdays at ${name}?`,
    `Which care levels fall inside the $${costLow}–$${costHigh}/month range, and what triggers a rate increase?`,
    complianceRows.length
      ? `What changed after the ${latest.date} ${latest.type.toLowerCase()} (${latest.findings})?`
      : `Can you walk us through the most recent state inspection findings?`,
    facility.careTypes?.includes('Memory Care')
      ? 'How is memory-care supervision different from standard assisted living in this building?'
      : 'How do you assess when a resident needs a higher care level?',
  ]

  return [
    '1) Quick Decision Snapshot',
    `- Safety: ${rating}/5 rating with ${compliance} compliance standing and ${capacity} licensed capacity.`,
    `- Value: Published range $${costLow}–$${costHigh}/month with ${amenities.length ? amenities.join(', ') : 'standard senior-living services'}.`,
    `- Fit: Best starting point for families comparing ${careTypes.toLowerCase()} near ${facility.address || 'Massachusetts'}.`,
    '',
    '2) Safety & Quality Overview',
    `${name} shows a ${rating}/5 family-rating signal and ${compliance.toLowerCase()} compliance standing in Assistedly's Massachusetts dataset. Use the compliance tab for inspection dates and findings before you tour.`,
    '',
    '3) What the Compliance Record Tells Us',
    complianceRows.length
      ? complianceRows
          .map((row) => `${row.date} (${row.type}): ${row.findings} [${row.status}]`)
          .join(' ')
      : 'No recent Massachusetts inspection rows are listed for this profile yet.',
    '',
    '4) Value Assessment',
    `At $${costLow}–$${costHigh}/month, ${name} sits in a band families should compare against care intensity (${careTypes}) and included services such as ${amenities.slice(0, 3).join(', ') || 'meals and personal care'}.`,
    '',
    '5) Key Questions to Ask on Tour',
    ...tourQuestions.map((question) => `- ${question}`),
    '',
    '6) Best-Fit Resident Profile',
    `A strong match is often someone who needs ${careTypes.toLowerCase()} support, values ${compliance.toLowerCase()} compliance transparency, and can work within the published monthly range.`,
    '',
    '7) Concerns or Red Flags',
    redFlags.startsWith('-') ? redFlags : `- ${redFlags}`,
    '',
    '8) Overall Recommendation',
    `Use this report as a structured pre-tour checklist for ${name}. Confirm staffing, pricing, and any open compliance items on-site before making a decision.`,
    '',
    'Generated from Assistedly facility records (native MVP report).',
  ].join('\n')
}
