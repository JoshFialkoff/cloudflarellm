#!/usr/bin/env node
/**
 * Sync NocoDB FOIA data → public/data/chart-facilities.json
 *
 * Fetches the official EOEA ALR Annual Report table from NocoDB,
 * computes chart scores (safety, care depth, stability, etc.),
 * embeds geocoded coordinates, and writes the dashboard JSON.
 *
 * Usage:
 *   NOCODB_API_TOKEN=<token> node scripts/sync-noco-to-charts.cjs
 *
 * Environment Variables:
 *   NOCODB_API_TOKEN          - Required for NocoDB fetch (xc-token)
 *   NOCODB_DASHBOARD_BASE     - Optional: Default http://107.172.94.35:8080
 *   NOCODB_PROJECT_ID         - Optional: Default pfeipqmy5ybhs71
 *   NOCODB_FOIA_TABLE_ID      - Optional: Default mix4o0ymn0l2nhz
 *   ALLOW_CSV_FALLBACK        - Optional: Set to '1' to read local CSV if NocoDB unavailable
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── Paths ────────────────────────────────────────────────────────────────────
const CSV_PATH = path.join(__dirname, '../public/data/alr-annual-report-2024.csv');
const COORD_PATH = path.join(__dirname, '../public/data/city-coordinates.json');
const OUT_PATH = path.join(__dirname, '../public/data/chart-facilities.json');

// ── NocoDB Configuration ─────────────────────────────────────────────────────
const API_TOKEN = process.env.NOCODB_API_TOKEN;
const DASHBOARD_BASE = process.env.NOCODB_DASHBOARD_BASE || 'http://107.172.94.35:8080';
const PROJECT_ID = process.env.NOCODB_PROJECT_ID || 'pfeipqmy5ybhs71';
const FOIA_TABLE_ID = process.env.NOCODB_FOIA_TABLE_ID || 'mix4o0ymn0l2nhz';
const ALLOW_CSV_FALLBACK = process.env.ALLOW_CSV_FALLBACK === '1';

// ── Helpers ──────────────────────────────────────────────────────────────────
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { headers, timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')));
  });
}

async function fetchAllRows(tableId) {
  let allRows = [];
  let page = 1;
  const limit = 1000;

  while (true) {
    const url = `${DASHBOARD_BASE}/api/v1/db/data/noco/${PROJECT_ID}/${tableId}?limit=${limit}&offset=${(page - 1) * limit}`;
    const { status, body } = await httpGet(url, { 'xc-token': API_TOKEN });
    if (status !== 200) {
      throw new Error(`NocoDB fetch failed for table ${tableId}: HTTP ${status}`);
    }
    const result = JSON.parse(body);
    const rows = result.list || [];
    allRows = allRows.concat(rows);

    if (result.pageInfo && result.pageInfo.isLastPage) break;
    page++;
    if (page > 10) break; // safety brake
  }
  return allRows;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = [];
    let cell = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        if (inQuotes && line[j + 1] === '"') {
          cell += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] || '';
    });
    rows.push(obj);
  }
  return rows;
}

function toNum(v) {
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function avg(arr) {
  const nums = arr.filter((n) => n !== null && !Number.isNaN(n));
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}

function cleanCity(city) {
  return city
    .replace(/,?\s*ma\s*\d*$/i, '')
    .replace(/\s+\d{5}$/, '')
    .trim();
}

function transformRows(rows, cityCoords) {
  return rows
    .map((r, idx) => {
      const name = r['Facility'] || `Facility ${idx}`;
      const cityRaw = r['City'] || '';
      const city = cleanCity(cityRaw);
      const zipCode = r['Zip Code'] || '';
      const taxStatusRaw = String(r['ALR Tax Status'] || '').trim();
      const taxStatus = taxStatusRaw.toLowerCase().includes('not-for')
        ? 'Not-for-profit'
        : taxStatusRaw.toLowerCase().includes('for-profit')
          ? 'For-profit'
          : 'Unknown';

      const tradUnits = toNum(r['Traditional Units Number of Certified Traditional Units']);
      const scrUnits = toNum(r['SCR Units Number of Certified SCR Units']);
      const totalUnits = (tradUnits || 0) + (scrUnits || 0);

      const occMonths = Array.from({ length: 12 }, (_, i) => {
        const m = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ][i];
        return toNum(r[`Total Units Occupied ${m}`]);
      });
      const avgOccupied = avg(occMonths);
      const totalResidents = toNum(r['Total # of Residents']);

      let occupancyRate = null;
      let occupancyNote = null;
      if (totalUnits && avgOccupied) {
        const rawRate = (avgOccupied / totalUnits) * 100;
        if (rawRate > 120 && totalResidents && avgOccupied > totalResidents * 1.3) {
          occupancyRate = totalResidents
            ? Math.round((totalResidents / totalUnits) * 100)
            : 100;
          occupancyNote = 'Monthly occupied values appear inconsistent with total resident count; capped.';
        } else {
          occupancyRate = Math.round(Math.min(rawRate, 100));
          if (rawRate > 100) {
            occupancyNote = 'At or above unit capacity (shared rooms or near-full census).';
          }
        }
      }

      function normalizeFeePair(low, high) {
        if (low != null && low < 1000) low = Math.round(low * 30);
        if (high != null && high < 1000) high = Math.round(high * 30);
        if (low != null && high != null && low > high) {
          [low, high] = [high, low];
        }
        return { low, high };
      }

      const trad = normalizeFeePair(
        toNum(r['Traditional Units with Lowest Monthly Fee']),
        toNum(r['Traditional Units with Highest Montly Fee'])
      );
      const scr = normalizeFeePair(
        toNum(r['SCR Units with Lowest Monthly Fee']),
        toNum(r['SCR Units with Highest Monthly Fee'])
      );
      const lows = [trad.low, scr.low].filter((n) => n != null);
      const highs = [trad.high, scr.high].filter((n) => n != null);
      let overallLow = lows.length ? Math.min(...lows) : null;
      let overallHigh = highs.length ? Math.max(...highs) : null;
      let feeLow = overallLow;
      let feeHigh = overallHigh;
      if (feeLow != null && feeHigh != null && feeLow > feeHigh) {
        [feeLow, feeHigh] = [feeHigh, feeLow];
      }
      let avgFee =
        feeLow != null && feeHigh != null
          ? Math.round((feeLow + feeHigh) / 2)
          : feeLow != null
            ? feeLow
            : feeHigh != null
              ? feeHigh
              : null;

      if (overallLow != null && overallLow < 1000) {
        console.log(`  NOTE: ${name} fee appears daily (${overallLow}/day) → monthly conversion applied`);
      }

      const staffMonths = Array.from({ length: 12 }, (_, i) => {
        const m = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ][i];
        return toNum(r[`Contracted Staff Hours ${m}`]);
      });
      const avgStaffHours = avg(staffMonths);
      const staffPerResident =
        avgOccupied && avgStaffHours
          ? Math.round((avgStaffHours / avgOccupied) * 100) / 100
          : null;

      const hasLMA =
        String(r['Did ALR offer LMA (Limited Medication Assistance)'] || '').toLowerCase() === 'yes';
      const hasSkilled =
        String(r['Did ALR provide Skilled Care'] || '').toLowerCase() === 'yes';
      const sammOnly = toNum(r['Number of Traditional Residents receiving SAMM only']) || 0;
      const lmaOnly = toNum(r['Number of Traditional Residents receiving LMA (Limited Medication Administration) only']) || 0;
      const bothMeds = toNum(r['Number of Traditional Residents receiving both SAMM & LMA']) || 0;
      const careDepthScore = Math.min(
        100,
        Math.round(
          (hasLMA ? 25 : 0) +
            (sammOnly > 0 ? 15 : 0) +
            (lmaOnly > 0 ? 15 : 0) +
            (bothMeds > 0 ? 25 : 0) +
            (hasSkilled ? 20 : 0)
        )
      );

      const adlFields = [
        'Residents receiving assistance with bathing',
        'Residents receiving assistance with dressing/undressing',
        'Residents receiving assistance with grooming/hygiene',
        'Residents receiving assistance with ambulation',
        'Residents receiving assistance with eating',
        'Residents receiving assistance with toileting',
      ];
      const totalADLSupport = adlFields.reduce((sum, f) => sum + (toNum(r[f]) || 0), 0);
      const totalResidentsForADL = toNum(r['Total # of Residents']) || avgOccupied || 1;
      const adlSupportPct = totalResidentsForADL
        ? Math.min(100, Math.round((totalADLSupport / 6 / totalResidentsForADL) * 100))
        : 0;

      const safetyChecks = [
        ['Did ALR have video surveillance', 20],
        ['Was there video surveillance coverage for main entrances', 10],
        ['Was there video surveillance coverage for common areas', 10],
        ['Was there video surveillance coverage for hallways throughout the building', 10],
        ['Did ALR have backup generator in event of power outage', 20],
        ['"Was ALR using EMRs (electronic medial records) as of December 31, 2024"', 10],
        ['Did ALR offer residents transportation to routine medical appointments', 10],
      ];
      const safetyScore = Math.min(
        100,
        safetyChecks.reduce((score, [field, points]) => {
          return score + (String(r[field] || '').toLowerCase() === 'yes' ? points : 0);
        }, 0)
      );

      const insuranceFields = [
        ['Traditional Residents that participated in GAFC (Group Adult Foster Care)', 'gafc'],
        ['Traditional Residents that participated in SCO (Senior Care Options)', 'sco'],
        ['Traditional Residents that participated in PACE (Program for All-Inclusive Care for the Elderly)', 'pace'],
        ['Traditional Residents that received Section 8', 'section8'],
        ['Traditional Residents that received MRVP (MA Rental Voucher Program)', 'mrvp'],
      ];
      const insurance = {};
      let insuranceCount = 0;
      insuranceFields.forEach(([field, key]) => {
        const val = String(r[field] || '').toLowerCase();
        const has = val === 'yes' || toNum(r[field]) > 0;
        insurance[key] = has;
        if (has) insuranceCount++;
      });

      const moveOutFields = [
        'Residents that moved out due to death',
        'Residents that moved to skilled nursing facility or other higher level of care',
        'Residents that moved out due to financial/non-payment',
        'Residents that moved out due to behavioral/aggressive',
      ];
      const [moveOutDeath, moveOutSNF, moveOutFinancial, moveOutBehavioral] = moveOutFields.map(
        (f) => toNum(r[f]) || 0
      );
      const totalMoveOuts = moveOutDeath + moveOutSNF + moveOutFinancial + moveOutBehavioral;
      const stabilityScore =
        totalMoveOuts > 0
          ? Math.max(0, 100 - Math.round(((moveOutFinancial + moveOutBehavioral) / totalMoveOuts) * 100))
          : 85;

      const coords = cityCoords[city] || null;

      return {
        id: idx,
        name,
        city: cityRaw,
        cityClean: city,
        zipCode,
        taxStatus,
        totalUnits: totalUnits || null,
        tradUnits: tradUnits || null,
        scrUnits: scrUnits || null,
        occupancyRate,
        occupancyNote,
        avgOccupied,
        avgFee,
        feeLow,
        feeHigh,
        staffPerResident,
        careDepthScore,
        adlSupportPct,
        safetyScore,
        insurance,
        insuranceCount,
        stabilityScore,
        hasTransportMedical:
          String(
            r['Did ALR offer residents transportation to routine medical appointments'] || ''
          ).toLowerCase() === 'yes',
        hasTransportShopping:
          String(
            r['Did ALR offer residents transportation to shopping'] || ''
          ).toLowerCase() === 'yes',
        hasTransportSocial:
          String(
            r['Did ALR offer residents transportation to social events'] || ''
          ).toLowerCase() === 'yes',
        hasEMR:
          String(
            r['"Was ALR using EMRs (electronic medial records) as of December 31, 2024"'] || ''
          ).toLowerCase() === 'yes',
        hasVideoSurveillance:
          String(r['Did ALR have video surveillance'] || '').toLowerCase() === 'yes',
        hasGenerator:
          String(r['Did ALR have backup generator in event of power outage'] || '').toLowerCase() === 'yes',
        hasLMA:
          String(r['Did ALR offer LMA (Limited Medication Assistance)'] || '').toLowerCase() === 'yes',
        lat: coords ? coords.lat : null,
        lng: coords ? coords.lng : null,
      };
    })
    .filter((f) => f.name && f.name !== 'Facility');
}

function validateFacilities(facilities) {
  const errors = [];
  const warnings = [];
  const MA_BOUNDS = { latMin: 41.0, latMax: 43.0, lngMin: -73.5, lngMax: -69.9 };

  for (const f of facilities) {
    const addErr = (msg) => errors.push(`[${f.name || '???'}] ${msg}`);
    const addWarn = (msg) => warnings.push(`[${f.name || '???'}] ${msg}`);

    if (!f.name || typeof f.name !== 'string') addErr('Missing or invalid name');
    if (!f.city || typeof f.city !== 'string') addWarn('Missing or invalid city');
    if (typeof f.id !== 'number') addErr('Missing or invalid id');

    if (f.avgFee !== null && f.avgFee !== undefined) {
      if (f.avgFee < 500) addErr(`avgFee ${f.avgFee} seems impossible (< $500/month)`);
      if (f.avgFee > 25000) addErr(`avgFee ${f.avgFee} seems impossible (> $25,000/month)`);
      if (f.avgFee >= 500 && f.avgFee < 1500) addWarn(`avgFee ${f.avgFee} is suspiciously low (possible unconverted daily rate)`);
    }

    if (f.feeLow !== null && f.feeHigh !== null) {
      if (f.feeLow > f.feeHigh) addErr(`feeLow (${f.feeLow}) > feeHigh (${f.feeHigh})`);
    }
    [f.feeLow, f.feeHigh].forEach((val, i) => {
      if (val !== null && val !== undefined) {
        const label = i === 0 ? 'feeLow' : 'feeHigh';
        if (val < 500 || val > 25000) addErr(`${label} ${val} outside plausible range`);
      }
    });

    ['safetyScore', 'careDepthScore', 'stabilityScore', 'adlSupportPct'].forEach((key) => {
      const val = f[key];
      if (val === null || val === undefined) return;
      if (typeof val !== 'number' || val < 0 || val > 100 || !Number.isFinite(val)) {
        addErr(`${key} = ${val} (must be 0–100)`);
      }
    });

    if (f.occupancyRate !== null && f.occupancyRate !== undefined) {
      if (f.occupancyRate < 0 || f.occupancyRate > 130) {
        addErr(`occupancyRate ${f.occupancyRate} outside 0–130% range`);
      }
    }

    if (f.totalUnits !== null && f.totalUnits !== undefined) {
      if (!Number.isInteger(f.totalUnits) || f.totalUnits <= 0 || f.totalUnits > 500) {
        addErr(`totalUnits ${f.totalUnits} not a plausible positive integer (1–500)`);
      }
    }

    if (f.avgOccupied !== null && f.avgOccupied !== undefined) {
      const maxOccupied = (f.totalUnits || 0) * 2.0;
      if (f.avgOccupied < 0 || f.avgOccupied > maxOccupied) {
        addErr(`avgOccupied ${f.avgOccupied} outside plausible range (max ${maxOccupied})`);
      }
    }

    if (f.lat === null || f.lng === null) {
      addWarn('Missing coordinates');
    } else {
      if (f.lat < MA_BOUNDS.latMin || f.lat > MA_BOUNDS.latMax) addErr(`lat ${f.lat} outside MA bounds`);
      if (f.lng < MA_BOUNDS.lngMin || f.lng > MA_BOUNDS.lngMax) addErr(`lng ${f.lng} outside MA bounds`);
    }

    if (f.insuranceCount !== null && f.insuranceCount !== undefined) {
      if (!Number.isInteger(f.insuranceCount) || f.insuranceCount < 0 || f.insuranceCount > 5) {
        addErr(`insuranceCount ${f.insuranceCount} invalid (0–5)`);
      }
    }
  }

  // Aggregate checks
  if (facilities.length < 250) {
    errors.push(`Only ${facilities.length} facilities — expected at least 250 for Massachusetts ALR dataset`);
  }
  const geocoded = facilities.filter((f) => f.lat && f.lng).length;
  if (geocoded / facilities.length < 0.90) {
    errors.push(`Geocoding rate ${(geocoded / facilities.length * 100).toFixed(1)}% below 90% threshold`);
  }
  const feeFacilities = facilities.filter((f) => f.avgFee !== null && f.avgFee !== undefined);
  const lowFeePct = feeFacilities.length ? (feeFacilities.filter((f) => f.avgFee < 1500).length / feeFacilities.length * 100) : 0;
  if (lowFeePct > 5) {
    errors.push(`${lowFeePct.toFixed(1)}% of facilities have avgFee < $1,500 (daily-rate epidemic?)`);
  }
  const avgSafety = facilities.length ? (facilities.reduce((a, f) => a + (f.safetyScore || 0), 0) / facilities.length) : 0;
  if (avgSafety < 20 || avgSafety > 90) {
    errors.push(`Mean safetyScore ${avgSafety.toFixed(1)} outside plausible 20–90 range`);
  }
  const avgFeeAll = feeFacilities.length ? (feeFacilities.reduce((a, f) => a + f.avgFee, 0) / feeFacilities.length) : 0;
  if (avgFeeAll > 0 && (avgFeeAll < 2500 || avgFeeAll > 15000)) {
    errors.push(`Mean avgFee ${avgFeeAll.toFixed(0)} outside plausible $2,500–$15,000 range`);
  }

  return { errors, warnings };
}

function writeChartJson(facilities) {
  const { errors, warnings } = validateFacilities(facilities);
  if (warnings.length) {
    console.warn('\n⚠️ Data-quality warnings:');
    warnings.forEach((w) => console.warn('   ' + w));
  }
  if (errors.length) {
    console.error('\n❌ Data-quality ERRORS — sync aborted:');
    errors.forEach((e) => console.error('   ' + e));
    process.exit(1);
  }
  console.log('   ✓ Data-quality validation passed');

  const validOcc = facilities.filter((f) => f.occupancyRate);
  const validFee = facilities.filter((f) => f.avgFee);
  const coordsCount = facilities.filter((f) => f.lat && f.lng).length;

  const payload = {
    generatedAt: new Date().toISOString(),
    reportAsOf: 'December 31, 2024',
    source: 'NocoDB',
    count: facilities.length,
    geocodedCount: coordsCount,
    facilities,
    summary: {
      avgOccupancy: validOcc.length
        ? Math.round(validOcc.reduce((a, f) => a + f.occupancyRate, 0) / validOcc.length)
        : null,
      avgFee: validFee.length
        ? Math.round(validFee.reduce((a, f) => a + f.avgFee, 0) / validFee.length)
        : null,
      avgSafety: Math.round(facilities.reduce((a, f) => a + f.safetyScore, 0) / facilities.length),
      avgCareDepth: Math.round(
        facilities.reduce((a, f) => a + f.careDepthScore, 0) / facilities.length
      ),
      notForProfitCount: facilities.filter((f) => f.taxStatus === 'Not-for-profit').length,
      forProfitCount: facilities.filter((f) => f.taxStatus === 'For-profit').length,
      unknownTaxCount: facilities.filter((f) => f.taxStatus === 'Unknown').length,
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  return { coordsCount };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📊 Chart-facilities sync started');
  const cityCoords = JSON.parse(fs.readFileSync(COORD_PATH, 'utf8')).coordinates;

  let rows;
  let sourceLabel;

  if (API_TOKEN) {
    try {
      console.log(`   → Fetching from NocoDB (${DASHBOARD_BASE}) …`);
      rows = await fetchAllRows(FOIA_TABLE_ID);
      sourceLabel = `NocoDB table ${FOIA_TABLE_ID}`;
      console.log(`   ✓ Fetched ${rows.length} rows from ${sourceLabel}`);
    } catch (err) {
      console.error(`   ✗ NocoDB fetch failed: ${err.message}`);
      if (!ALLOW_CSV_FALLBACK) {
        console.error('\nSet ALLOW_CSV_FALLBACK=1 to read the local CSV instead, or fix the NocoDB connection.');
        process.exit(1);
      }
      console.log('   ⚠️ Falling back to local CSV (ALLOW_CSV_FALLBACK=1)');
      rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
      sourceLabel = 'local CSV fallback';
    }
  } else if (ALLOW_CSV_FALLBACK) {
    console.log('   ⚠️ NOCODB_API_TOKEN not set. Using local CSV fallback (ALLOW_CSV_FALLBACK=1).');
    rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
    sourceLabel = 'local CSV fallback';
  } else {
    console.error('❌ Error: NOCODB_API_TOKEN is required. Set it or use ALLOW_CSV_FALLBACK=1 for dev.');
    process.exit(1);
  }

  const facilities = transformRows(rows, cityCoords);

  // ── Add citation sources to each facility ──
  const citations = require('../lib/citations.js');
  facilities.forEach(f => {
    f.sources = citations.buildCitations(f).map(s => ({
      label: s.label,
      url: s.url,
    }));
  });

  const { coordsCount } = writeChartJson(facilities);

  console.log(`\n✅ Sync complete: ${facilities.length} facilities written to ${OUT_PATH}`);
  console.log(`   Source: ${sourceLabel}`);
  console.log(`   Geocoded: ${coordsCount} / ${facilities.length}`);
  console.log(`   Summary — Avg Safety: ${ Math.round(facilities.reduce((a,f)=>a+f.safetyScore,0)/facilities.length) }, Avg Care Depth: ${ Math.round(facilities.reduce((a,f)=>a+f.careDepthScore,0)/facilities.length) }`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Unhandled error:', err.message);
    process.exit(1);
  });
}

module.exports = { main, transformRows, fetchAllRows };
