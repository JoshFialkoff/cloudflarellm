const fs = require('fs');
const Papa = require('papaparse');

const csvPath = './public/data/alr-annual-report-2024.csv';
const outputPath = './public/data/trends.json';

const csvText = fs.readFileSync(csvPath, 'utf8');

const { data } = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false,
});

function toNum(v) {
  if (v === '' || v === undefined || v === null) return 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const trends = {
  residentsByMonth: [],
  unitsOccupiedByMonth: [],
  contractedStaffHoursByMonth: [],
  lmaByMonth: [],
  skilledCareByMonth: [],
  moveOutReasons: [],
  durationOfResidency: [],
  adlAssistance: [],
};

// Aggregate numeric values across all facilities
for (let i = 0; i < months.length; i++) {
  const m = months[i];
  let residents = 0;
  let unitsOccupied = 0;
  let staffHours = 0;
  let lma = 0;
  let skilledCare = 0;

  for (const row of data) {
    residents += toNum(row[`Total Number of Residents ${m}`]);
    unitsOccupied += toNum(row[`Total Units Occupied ${m}`]);
    staffHours += toNum(row[`Contracted Staff Hours ${m}`]);
    lma += toNum(row[`Total Number of Residents that received LMA in ${m}`] || row[`Total Number of residents that received LMA in ${m}`] || row[`Total Number of residents that receied LMA in ${m}`]);
    skilledCare += toNum(row[`Residents received skilled care ${m}`]);
  }

  trends.residentsByMonth.push({ month: m, monthShort: m.slice(0, 3), total: residents });
  trends.unitsOccupiedByMonth.push({ month: m, monthShort: m.slice(0, 3), total: unitsOccupied });
  trends.contractedStaffHoursByMonth.push({ month: m, monthShort: m.slice(0, 3), total: staffHours });
  trends.lmaByMonth.push({ month: m, monthShort: m.slice(0, 3), total: lma });
  trends.skilledCareByMonth.push({ month: m, monthShort: m.slice(0, 3), total: skilledCare });
}

// Move-out reasons aggregation
const moveOutFields = [
  { label: 'Death', key: 'Residents that moved out due to death' },
  { label: 'Higher Level of Care', key: 'Residents that moved to skilled nursing facility other higher level of care' },
  { label: 'Financial / Non-payment', key: 'Residents that moved out due to financial/non-payment' },
  { label: 'Respite Stay Concluded', key: 'Residents that had respite stay concluded' },
  { label: 'Moved to Another MA ALR', key: 'Residents that moved to another ALR in MA' },
  { label: 'Moved Out of State', key: 'Residents that moved out of state' },
  { label: 'Returned Home / Independent', key: 'Residents that returned home or to other independent living' },
  { label: 'Behavioral / Aggressive', key: 'Residents that moved out due to behavioral/aggressive' },
  { label: 'Other Reason 1', key: 'Residents that moved out due to other reason 1' },
  { label: 'Other Reason 2', key: 'Residents that moved out for other reason 2' },
];

for (const field of moveOutFields) {
  let total = 0;
  for (const row of data) {
    total += toNum(row[field.key]);
  }
  if (total > 0) {
    trends.moveOutReasons.push({ reason: field.label, count: total });
  }
}

// Duration of residency
const durationFields = [
  { label: '< 3 months', key: 'Duration of residency less than 3 months' },
  { label: '3–5 months', key: 'Duration of residency 3-5 months' },
  { label: '6–8 months', key: 'Duration of residency 6-8 months' },
  { label: '9–11 months', key: 'Duration of residency 9-11 months' },
  { label: '1–2 years', key: 'Duration of residency 1 year-1 year 11 months' },
  { label: '2–3 years', key: 'Duration of residency 2 years - 2 years 11 months' },
  { label: '3–4 years', key: 'Duration of residency 3 years-3 years 11 months' },
  { label: '4–5 years', key: 'Duration of residency 4 years - 4 years 11 months' },
  { label: '5–6 years', key: 'Duration of residency 5 years-5 years 11 months' },
  { label: '6–7 years', key: 'Duration of residency 6 years - 6 years 11 months' },
  { label: '7–8 years', key: 'Duration of residency 7 years-7 years 11 months' },
  { label: '8–9 years', key: 'Duration of residency 8 years-8 years 11 months' },
  { label: '9–10 years', key: 'Duration of residency 9 years-9 years 11 months' },
  { label: '10–15 years', key: 'Duration of residency 10 years-14 years 11 months' },
  { label: '15+ years', key: 'Duration of residency 15+ years' },
];

for (const field of durationFields) {
  let total = 0;
  for (const row of data) {
    total += toNum(row[field.key]);
  }
  if (total > 0) {
    trends.durationOfResidency.push({ duration: field.label, count: total });
  }
}

// ADL assistance
const adlFields = [
  { label: 'Bathing', key: 'Residents receiving assistance with bathing' },
  { label: 'Dressing/Undressing', key: 'Residents receiving assistance with dressing/undressing' },
  { label: 'Grooming/Hygiene', key: 'Residents receiving assistance with grooming/hygiene' },
  { label: 'Ambulation', key: 'Residents receiving assistance with ambulation' },
  { label: 'Eating', key: 'Residents receiving assistance with eating' },
  { label: 'Toileting', key: 'Residents receiving assistance with toileting' },
];

for (const field of adlFields) {
  let total = 0;
  for (const row of data) {
    total += toNum(row[field.key]);
  }
  if (total > 0) {
    trends.adlAssistance.push({ adl: field.label, count: total });
  }
}

// Facility count summary
trends.facilityCount = data.length;
trends.reportYear = 2024;

fs.writeFileSync(outputPath, JSON.stringify(trends, null, 2));
console.log(`Wrote trends JSON to ${outputPath}`);
console.log(`Facilities: ${data.length}`);
console.log(`Residents Jan total: ${trends.residentsByMonth[0].total}`);
console.log(`Move-out reasons: ${trends.moveOutReasons.length} categories`);
