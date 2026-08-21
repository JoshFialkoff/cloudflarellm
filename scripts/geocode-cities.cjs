const fs = require('fs');
const path = require('path');
const https = require('https');

const CSV_PATH = path.join(__dirname, '../public/data/alr-annual-report-2024.csv');
const OUT_PATH = path.join(__dirname, '../public/data/city-coordinates.json');

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = [];
    let cell = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        if (inQuotes && line[j + 1] === '"') { cell += '"'; j++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

function cleanCity(city) {
  return city
    .replace(/,?\s*ma\s*\d*$/i, '')
    .replace(/\s+\d{5}$/, '')
    .trim();
}

function geocodeCity(city, state = 'Massachusetts') {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(`${city}, ${state}, USA`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Assistedly.ai Facility Finder (dev@assistedly.ai)'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.length > 0) {
            resolve({
              lat: parseFloat(json[0].lat),
              lng: parseFloat(json[0].lon),
              display_name: json[0].display_name
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(raw);
  
  // Extract unique cities
  const citySet = new Set();
  rows.forEach(r => {
    const city = cleanCity(r['City'] || '');
    if (city) citySet.add(city);
  });
  
  const cities = Array.from(citySet).sort();
  console.log(`Geocoding ${cities.length} unique cities...`);
  
  const coordinates = {};
  const failed = [];
  
  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    console.log(`[${i + 1}/${cities.length}] ${city}...`);
    try {
      const result = await geocodeCity(city);
      await sleep(1100); // Nominatim rate limit: 1 req/sec
      if (result) {
        coordinates[city] = result;
        console.log(`  -> ${result.lat}, ${result.lng}`);
      } else {
        failed.push(city);
        console.log(`  -> NOT FOUND`);
      }
    } catch (e) {
      failed.push(city);
      console.log(`  -> ERROR: ${e.message}`);
    }
  }
  
  fs.writeFileSync(OUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'nominatim.openstreetmap.org',
    coordinates,
    failed,
    count: Object.keys(coordinates).length,
    total: cities.length
  }, null, 2));
  
  console.log(`\nDone! ${Object.keys(coordinates).length}/${cities.length} cities geocoded.`);
  if (failed.length) {
    console.log('Failed:', failed.join(', '));
  }
}

main().catch(console.error);
