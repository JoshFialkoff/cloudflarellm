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

function mergeFacilityData(baseFacilities, foiaData, firecrawl1Data, firecrawl2Data, firecrawl3Data, reviewsData) {
  // Create a map by normalized slug for joining
  const slugMap = new Map();
  
  // Base map from ChatGPT consolidated data
  baseFacilities.forEach(row => {
    const slug = slugify(row.facility_name || row.name || `facility-${row.Id}`);
    slugMap.set(slug, { base: row });
  });

  // Helper to merge arrays/objects safely based on slug
  const mergeToMap = (data, key) => {
    (data || []).forEach(row => {
      const name = row.facility_name || row.Facility || row.Title || row.name;
      if (!name) return;
      const slug = slugify(name);
      
      // If we don't have this facility yet from base, we can either skip or add.
      // Usually, we want to augment existing facilities. 
      // Let's add it if it's missing just in case, or we can just augment if it exists.
      if (!slugMap.has(slug)) {
        slugMap.set(slug, { base: { facility_name: name } });
      }
      
      const record = slugMap.get(slug);
      record[key] = row;
    });
  };

  mergeToMap(foiaData, 'foia');
  mergeToMap(firecrawl1Data, 'fc1');
  mergeToMap(firecrawl2Data, 'fc2');
  mergeToMap(firecrawl3Data, 'fc3');
  mergeToMap(reviewsData, 'reviews');

  // Now, transform everything into the final array
  const finalFacilities = {};
  let index = 1;

  for (const [slug, records] of slugMap.entries()) {
    const { base, foia, fc1, fc2, fc3, reviews } = records;
    
    // Pick the best values across datasets
    
    // We can pull monthlyMin and monthlyMax from FOIA or Base or FC
    let monthlyMin = null, monthlyMax = null;
    
    // 1. Try to get from FOIA (most official for min/max fee)
    if (foia && (foia['Traditional Units with Lowest Monthly Fee'] || foia['SCR Units with Lowest Monthly Fee'])) {
      const tMin = parseInt(foia['Traditional Units with Lowest Monthly Fee']) || 0;
      const sMin = parseInt(foia['SCR Units with Lowest Monthly Fee']) || 0;
      const tMax = parseInt(foia['Traditional Units with Highest Montly Fee']) || 0;
      const sMax = parseInt(foia['SCR Units with Highest Monthly Fee']) || 0;
      
      const mins = [tMin, sMin].filter(v => v > 0);
      const maxs = [tMax, sMax].filter(v => v > 0);
      
      if (mins.length > 0) monthlyMin = Math.min(...mins);
      if (maxs.length > 0) monthlyMax = Math.max(...maxs);
    }
    
    // 2. Try Firecrawl base_monthly_rate if FOIA missing
    if (!monthlyMin) {
      const fcRate = (fc3 && fc3['pricing.base_monthly_rate']) || (fc1 && fc1['pricing.base_monthly_rate']);
      if (fcRate) {
        const rateMatch = String(fcRate).match(/\$?([\d,]+)/);
        if (rateMatch) {
          monthlyMin = parseInt(rateMatch[1].replace(/,/g, ''));
        }
      }
    }

    // 3. Fallback to base
    if (!monthlyMin) {
      const parsed = parseMonthlyRange(base.monthly_cost_notes || base.monthly_cost_range);
      monthlyMin = parsed.monthlyMin;
      monthlyMax = parsed.monthlyMax;
    }
    
    const city = base.city || (foia && foia.City) || 'Unknown';
    const town = city.toLowerCase().replace(/\s+/g, '-');
    
    const addressStr = base.address || (foia && foia['Street Address']) || (fc3 && fc3.address) || '';
    const zipStr = base.zip || (foia && foia['Zip Code']) || '';
    
    // Amenities logic
    const amenities = [];
    const isMemoryCare = base.dementia_special_care_unit === 'Y' || 
                         (foia && parseInt(foia['SCR Units Number of Certified SCR Units']) > 0);
                         
    if (isMemoryCare) {
      amenities.push({ icon: '🧠', name: 'Memory Care' });
    }
    
    if (base.walk_score?.score || base['walk_score.score']) {
      amenities.push({ icon: '🚶', name: 'Walkable Location' });
    }
    if (base.bbb_accreditation?.is_accredited || base['bbb_accreditation.is_accredited']) {
      amenities.push({ icon: '✅', name: 'BBB Accredited' });
    }

    // Extracted Fields from new tables
    const parentCompany = (fc3 && fc3.parent_company) || (fc1 && fc1.parent_company) || null;
    const edTenure = (fc3 && fc3.executive_director_tenure) || (fc1 && fc1.executive_director_tenure) || null;
    const has247Nursing = (fc3 && fc3.twenty_four_seven_nursing) || (fc1 && fc1.twenty_four_seven_nursing) ? true : false;
    
    let about = base.deficiencies_summary || 
      `${base.facility_name || base.name || foia?.Facility} is a certified assisted living residence in ${city}, Massachusetts.`;
      
    if (fc3 && fc3['pricing.hidden_fees']) {
       about += `\n\nPricing Notes: ${fc3['pricing.hidden_fees']}`;
    }

    finalFacilities[index] = {
      id: index,
      slug,
      name: base.facility_name || base.name || foia?.Facility || 'Unnamed Facility',
      address: `${addressStr}, ${city}, MA ${zipStr}`.trim().replace(/^,\s*/, '').replace(/,\s*,\s*/g, ', '),
      phone: base.phone || (foia && foia.Phone) || '',
      email: (foia && foia['ED Email']) || '',
      parentCompany: parentCompany,
      executiveDirectorTenure: edTenure,
      has247Nursing: has247Nursing,
      rating: null, // Can map from reviews if numerical rating exists
      complianceRating: base.deficiencies_summary ? 
        (base.deficiencies_summary.includes('No deficiencies') ? 'Excellent' : 'Good') : 
        null,
      crimeRating: { facility: 'Unknown', community: 'Unknown' },
      culturalAffinity: [], 
      careTypes: isMemoryCare ? ['Assisted Living', 'Memory Care'] : ['Assisted Living'],
      capacity: parseInt(base.capacity_or_units || base['unit_capacities.total_capacity']) || 
                (foia && (parseInt(foia['Total Number of Residents December']) || 0)) || null,
      monthlyMin,
      monthlyMax,
      about: about,
      complianceHistory: base.inspections ? (Array.isArray(base.inspections) ? base.inspections : []) : [],
      amenities,
      town,
      // Metadata traces
      _nocoId: base.Id || foia?.Id,
      _nocoSource: 'mblraqkff0ml4qp_and_merged',
      _nocoUpdatedAt: base.UpdatedAt || base.CreatedAt || new Date().toISOString()
    };
    
    index++;
  }

  return finalFacilities;
}

async function fetchAllRows(tableId) {
  let allRows = [];
  let page = 1;
  const limit = 1000;
  
  while (true) {
    const url = `${DASHBOARD_BASE}/api/v1/db/data/noco/${PROJECT_ID}/${tableId}?limit=${limit}&offset=${(page-1)*limit}`;
    const { status, body } = await httpGet(url, { 'xc-token': API_TOKEN });
    if (status !== 200) {
       console.warn(`⚠️ Warning: Failed to fetch table ${tableId}. Status ${status}`);
       break;
    }
    const result = JSON.parse(body);
    const rows = result.list || [];
    allRows = allRows.concat(rows);
    
    if (result.pageInfo && result.pageInfo.isLastPage) {
      break;
    }
    page++;
    
    // safety brake
    if (page > 10) break;
  }
  return allRows;
}

async function syncNocoToCode() {
  if (!API_TOKEN) {
    console.error('❌ Error: NOCODB_API_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('📥 Fetching all required tables from NocoDB...');
  console.log(`   Base: ${DASHBOARD_BASE}`);
  console.log(`   Project: ${PROJECT_ID}`);
  
  try {
    console.log('   -> Fetching base ChatGPT Consolidated Table (mblraqkff0ml4qp)...');
    const baseRows = await fetchAllRows('mblraqkff0ml4qp');
    console.log(`      Loaded ${baseRows.length} rows`);

    console.log('   -> Fetching FOIA State Data Table (mix4o0ymn0l2nhz)...');
    const foiaRows = await fetchAllRows('mix4o0ymn0l2nhz');
    console.log(`      Loaded ${foiaRows.length} rows`);

    console.log('   -> Fetching Firecrawl V2 Table (m0avaxw66ixs8i9)...');
    const fc1Rows = await fetchAllRows('m0avaxw66ixs8i9');
    console.log(`      Loaded ${fc1Rows.length} rows`);

    console.log('   -> Fetching Firecrawl 1-15-26 Table (m8fw6r2g4vs0pzy)...');
    const fc2Rows = await fetchAllRows('m8fw6r2g4vs0pzy');
    console.log(`      Loaded ${fc2Rows.length} rows`);

    console.log('   -> Fetching Firecrawl Extract Data 2 Table (mjoql4wd9qqjij2)...');
    const fc3Rows = await fetchAllRows('mjoql4wd9qqjij2');
    console.log(`      Loaded ${fc3Rows.length} rows`);

    console.log('   -> Fetching Reviews Table (mxabzhzvax0aopp)...');
    const reviewsRows = await fetchAllRows('mxabzhzvax0aopp');
    console.log(`      Loaded ${reviewsRows.length} rows`);

    console.log('🔄 Merging and superseding data...');
    const facilitiesData = mergeFacilityData(baseRows, foiaRows, fc1Rows, fc2Rows, fc3Rows, reviewsRows);
    
    // Generate the file content
    const content = `/**
 * Massachusetts Assisted Living Facilities
 * 
 * Auto-generated from NocoDB on ${new Date().toISOString()} (With merged official FOIA, Firecrawl, and Reviews datasets)
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Run: node scripts/ops/sync-noco-to-code.cjs
 */

const facilitiesData = ${JSON.stringify(facilitiesData, null, 2)};

module.exports = facilitiesData;
`;
    
    const outputPath = path.join(__dirname, '../../lib/massachusettsFacilities.js');
    
    if (DRY_RUN) {
      console.log('🔍 DRY RUN - Would write to:', outputPath);
      console.log('Sample facility:', JSON.stringify(facilitiesData[1] || facilitiesData[Object.keys(facilitiesData)[0]], null, 2));
      console.log(`\n📊 Total facilities: ${Object.keys(facilitiesData).length}`);
    } else {
      fs.writeFileSync(outputPath, content);
      console.log(`✅ Successfully updated ${outputPath}`);
      console.log(`📊 Total facilities: ${Object.keys(facilitiesData).length}`);
    }
    
  } catch (err) {
    console.error('❌ Sync failed:', err.message, err.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  syncNocoToCode();
}

module.exports = { syncNocoToCode };
