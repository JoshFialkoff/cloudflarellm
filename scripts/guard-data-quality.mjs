#!/usr/bin/env node
/**
 * guard-data-quality.mjs
 *
 * Validates public/data/chart-facilities.json for impossible/outlier values.
 * Exits non-zero if the dataset fails sanity checks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(__dirname, '../public/data/chart-facilities.json');

function fail(msg) {
  console.error('❌ ' + msg);
  process.exitCode = 1;
}
function pass(msg) {
  console.log('✅ ' + msg);
}

function run() {
  if (!fs.existsSync(JSON_PATH)) {
    fail(`chart-facilities.json not found at ${JSON_PATH}`);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  } catch (e) {
    fail(`Invalid JSON in chart-facilities.json: ${e.message}`);
    return;
  }

  const facilities = payload.facilities || [];
  if (!Array.isArray(facilities) || facilities.length === 0) {
    fail('No facilities array found in chart-facilities.json');
    return;
  }

  const MA_BOUNDS = { latMin: 41.0, latMax: 43.0, lngMin: -73.5, lngMax: -69.9 };
  const errors = [];
  const warnings = [];

  for (const f of facilities) {
    const addErr = (msg) => errors.push(`[${f.name || '???'}] ${msg}`);
    const addWarn = (msg) => warnings.push(`[${f.name || '???'}] ${msg}`);

    if (!f.name || typeof f.name !== 'string') addErr('Missing or invalid name');
    if (!f.city || typeof f.city !== 'string') addWarn('Missing or invalid city');
    if (typeof f.id !== 'number') addErr('Missing or invalid id');
    if (!Array.isArray(f.sources) || f.sources.length === 0) addWarn('Missing sources (citations not generated)');

    if (f.avgFee != null) {
      if (f.avgFee < 500) addErr(`avgFee ${f.avgFee} impossible (< $500/month)`);
      if (f.avgFee > 25000) addErr(`avgFee ${f.avgFee} impossible (> $25,000/month)`);
      if (f.avgFee >= 500 && f.avgFee < 1500) addWarn(`avgFee ${f.avgFee} suspiciously low (possible unconverted daily rate)`);
    }

    if (f.feeLow != null && f.feeHigh != null && f.feeLow > f.feeHigh) {
      addErr(`feeLow (${f.feeLow}) > feeHigh (${f.feeHigh})`);
    }
    [f.feeLow, f.feeHigh].forEach((val, i) => {
      if (val != null && (val < 500 || val > 25000)) {
        addErr(`${i === 0 ? 'feeLow' : 'feeHigh'} ${val} outside plausible range`);
      }
    });

    ['safetyScore', 'careDepthScore', 'stabilityScore', 'adlSupportPct'].forEach((key) => {
      const val = f[key];
      if (val == null) return;
      if (typeof val !== 'number' || val < 0 || val > 100 || !Number.isFinite(val)) {
        addErr(`${key} = ${val} (must be 0–100)`);
      }
    });

    if (f.occupancyRate != null && (f.occupancyRate < 0 || f.occupancyRate > 130)) {
      addErr(`occupancyRate ${f.occupancyRate} outside 0–130% range`);
    }

    if (f.totalUnits != null && (!Number.isInteger(f.totalUnits) || f.totalUnits <= 0 || f.totalUnits > 500)) {
      addErr(`totalUnits ${f.totalUnits} not a plausible positive integer (1–500)`);
    }

    if (f.avgOccupied != null) {
      const maxOccupied = (f.totalUnits || 0) * 2.0;
      if (f.avgOccupied < 0 || f.avgOccupied > maxOccupied) {
        addErr(`avgOccupied ${f.avgOccupied} outside plausible range (max ${maxOccupied})`);
      }
    }

    if (f.lat == null || f.lng == null) {
      addWarn('Missing coordinates');
    } else {
      if (f.lat < MA_BOUNDS.latMin || f.lat > MA_BOUNDS.latMax) addErr(`lat ${f.lat} outside MA bounds`);
      if (f.lng < MA_BOUNDS.lngMin || f.lng > MA_BOUNDS.lngMax) addErr(`lng ${f.lng} outside MA bounds`);
    }

    if (f.insuranceCount != null && (!Number.isInteger(f.insuranceCount) || f.insuranceCount < 0 || f.insuranceCount > 5)) {
      addErr(`insuranceCount ${f.insuranceCount} invalid (0–5)`);
    }
  }

  // Aggregate checks
  if (facilities.length < 250) {
    errors.push(`Only ${facilities.length} facilities — expected at least 250`);
  }
  const geocoded = facilities.filter((f) => f.lat && f.lng).length;
  if (geocoded / facilities.length < 0.90) {
    errors.push(`Geocoding rate ${(geocoded / facilities.length * 100).toFixed(1)}% below 90% threshold`);
  }
  const feeFacilities = facilities.filter((f) => f.avgFee != null);
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

  if (warnings.length) {
    console.warn('\n⚠️ Data-quality warnings (' + warnings.length + '):');
    warnings.forEach((w) => console.warn('   ' + w));
  }
  if (errors.length) {
    console.error('\n❌ Data-quality ERRORS (' + errors.length + '):');
    errors.forEach((e) => console.error('   ' + e));
    fail('guard-data-quality FAILED');
    return;
  }

  pass(`guard-data-quality passed — ${facilities.length} facilities, ${geocoded} geocoded, avgFee $${Math.round(avgFeeAll || 0).toLocaleString()}, avgSafety ${avgSafety.toFixed(1)}`);
}

run();
