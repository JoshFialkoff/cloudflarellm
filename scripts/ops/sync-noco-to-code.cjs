#!/usr/bin/env node
/**
 * Sync NocoDB facilities to lib/massachusettsFacilities.js
 * 
 * Usage:
 *   NOCODB_API_TOKEN=<token> node scripts/ops/sync-noco-to-code.cjs
 * 
 * Environment Variables:
 *   NOCODB_API_TOKEN          - Required: NocoDB API token (xc-token)
 *   NOCODB_DASHBOARD_BASE     - Optional: Default http://107.172.94.35:8080
 *   NOCODB_PROJECT_ID         - Optional: Default pfeipqmy5ybhs71
 *   NOCODB_DEFAULT_TABLE_ID   - Optional: Default mblraqkff0ml4qp
 *   DRY_RUN                   - Optional: Set to '1' to preview without writing
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const API_TOKEN = process.env.NOCODB_API_TOKEN;
const DASHBOARD_BASE = process.env.NOCODB_DASHBOARD_BASE || 'http://107.172.94.35:8080';
const PROJECT_ID = process.env.NOCODB_PROJECT_ID || 'pfeipqmy5ybhs71';
const TABLE_ID = process.env.NOCODB_DEFAULT_TABLE_ID || 'mblraqkff0ml4qp';
const DRY_RUN = process.env.DRY_RUN === '1';

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseMonthlyRange(costNotes) {
  if (!costNotes) return { monthlyMin: null, monthlyMax: null };
  
  // Example: "$4,500 - $7,500" or "$5000+"
  const match = costNotes.match(/\$?([\d,]+)\s*-\s*\$?([\d,]+)/);
  if (match) {
    return {
      monthlyMin: parseInt(match[1].replace(/,/g, '')),
      monthlyMax: parseInt(match[2].replace(/,/g, ''))
    };
  }
  
  const singleMatch = costNotes.match(/\$?([\d,]+)/);
  if (singleMatch) {
    const val = parseInt(singleMatch[1].replace(/,/g, ''));
    return { monthlyMin: val, monthlyMax: val };
  }
  
  return { monthlyMin: null, monthlyMax: null };
}

function transformRow(row, index) {
  const { monthlyMin, monthlyMax } = parseMonthlyRange(row.monthly_cost_notes || row.monthly_cost_range);
  
  const town = (row.city || '').toLowerCase().replace(/\s+/g, '-');
  
  // Build amenities array from available data
  const amenities = [];
  if (row.dementia_special_care_unit === 'Y') {
    amenities.push({ icon: '🧠', name: 'Memory Care' });
  }
  if (row.walk_score?.score || row['walk_score.score']) {
    amenities.push({ icon: '🚶', name: 'Walkable Location' });
  }
  if (row.bbb_accreditation?.is_accredited || row['bbb_accreditation.is_accredited']) {
    amenities.push({ icon: '✅', name: 'BBB Accredited' });
  }
  
  return {
    id: index + 1,
    slug: slugify(row.facility_name || row.name || `facility-${index + 1}`),
    name: row.facility_name || row.name || 'Unnamed Facility',
    address: `${row.address || ''}, ${row.city || ''}, MA ${row.zip || ''}`.trim(),
    phone: row.phone || '',
    email: '', // Not in NocoDB
    rating: null, // Can be computed later
    complianceRating: row.deficiencies_summary ? 
      (row.deficiencies_summary.includes('No deficiencies') ? 'Excellent' : 'Good') : 
      null,
    crimeRating: { facility: 'Unknown', community: 'Unknown' },
    culturalAffinity: [], // Not in NocoDB
    careTypes: row.dementia_special_care_unit === 'Y' ? 
      ['Assisted Living', 'Memory Care'] : 
      ['Assisted Living'],
    capacity: parseInt(row.capacity_or_units || row['unit_capacities.total_capacity'] || 0) || null,
    monthlyMin,
    monthlyMax,
    about: row.deficiencies_summary || 
      `${row.facility_name || row.name} is a certified assisted living residence in ${row.city}, Massachusetts.`,
    complianceHistory: row.inspections ? 
      (Array.isArray(row.inspections) ? row.inspections : []) : 
      [],
    amenities,
    town,
    // Store NocoDB metadata for traceability
    _nocoId: row.Id,
    _nocoSource: 'mblraqkff0ml4qp',
    _nocoUpdatedAt: row.UpdatedAt || row.CreatedAt,
  };
}

async function syncNocoToCode() {
  if (!API_TOKEN) {
    console.error('❌ Error: NOCODB_API_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('📥 Fetching facilities from NocoDB...');
  console.log(`   Base: ${DASHBOARD_BASE}`);
  console.log(`   Project: ${PROJECT_ID}`);
  console.log(`   Table: ${TABLE_ID}`);
  
  const url = `${DASHBOARD_BASE}/api/v1/db/data/noco/${PROJECT_ID}/${TABLE_ID}?limit=1000`;
  
  try {
    const { status, body } = await httpGet(url, { 'xc-token': API_TOKEN });
    
    if (status !== 200) {
      throw new Error(`API returned ${status}: ${body.slice(0, 200)}`);
    }
    
    const result = JSON.parse(body);
    const rows = result.list || [];
    
    console.log(`✅ Fetched ${rows.length} facilities`);
    
    // Transform rows to massachusettsFacilities format
    const facilitiesData = {};
    rows.forEach((row, index) => {
      const facility = transformRow(row, index);
      facilitiesData[facility.id] = facility;
    });
    
    // Generate the file content
    const content = `/**
 * Massachusetts Assisted Living Facilities
 * 
 * Auto-generated from NocoDB on ${new Date().toISOString()}
 * Source: Table ${TABLE_ID} in project ${PROJECT_ID}
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Run: node scripts/ops/sync-noco-to-code.cjs
 */

const facilitiesData = ${JSON.stringify(facilitiesData, null, 2)};

module.exports = facilitiesData;
`;
    
    const outputPath = path.join(__dirname, '../../lib/massachusettsFacilities.js');
    
    if (DRY_RUN) {
      console.log('🔍 DRY RUN - Would write to:', outputPath);
      console.log('Sample facility:', JSON.stringify(facilitiesData[1], null, 2));
      console.log(`\n📊 Total facilities: ${Object.keys(facilitiesData).length}`);
    } else {
      fs.writeFileSync(outputPath, content);
      console.log(`✅ Successfully updated ${outputPath}`);
      console.log(`📊 Total facilities: ${Object.keys(facilitiesData).length}`);
    }
    
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  syncNocoToCode();
}

module.exports = { syncNocoToCode };
