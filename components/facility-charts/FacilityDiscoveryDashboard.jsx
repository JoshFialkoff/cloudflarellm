"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import posthog from "../../lib/posthogClient";
import FacilityFilterBar from "./FacilityFilterBar";
import PriceCareScatter from "./PriceCareScatter";
import SafetyScoreChart from "./SafetyScoreChart";
import InsuranceBreakdown from "./InsuranceBreakdown";
import OccupancyBarChart from "./OccupancyBarChart";
import InteractiveTable from "./InteractiveTable";
import styles from "../../styles/facility-charts/Dashboard.module.css";

/** Haversine distance in miles between two lat/lng points */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeTopRatedScore(f) {
  const safety = f.safetyScore || 0;
  const careDepth = f.careDepthScore || 0;
  const stability = f.stabilityScore || 0;
  const occupancy = f.occupancyRate || 0;
  const insurance = (f.insuranceCount || 0) * 20; // 0-100 (max 5 programs)
  const fee = f.avgFee || f.feeLow || 8000;
  const feeScore = Math.max(0, Math.min(100, 100 - fee / 100));
  return (
    safety * 0.25 +
    careDepth * 0.25 +
    stability * 0.15 +
    occupancy * 0.10 +
    insurance * 0.10 +
    feeScore * 0.15
  );
}

export default function FacilityDiscoveryDashboard({
  title = "Find the Best Assisted Living in Massachusetts",
  subtitle = "Explore every licensed facility with official state data you won't find anywhere else — pricing, safety, care depth, and insurance acceptance.",
  dataUrl = "/data/chart-facilities.json",
  defaultMaxFee = 15000,
  defaultTaxStatus = "",
  source = "facility_dashboard",
  defaultSortKey,
  defaultSortDir,
  extraSorts = [],
}) {
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchSessionTracked, setSearchSessionTracked] = useState(false);
  const [filters, setFilters] = useState({
    cityRadiusMap: {},
    maxFee: defaultMaxFee,
    taxStatus: defaultTaxStatus,
    memoryCare: "",
    insurance: "",
    safetyScoreMin: null,
    safetyScoreMax: null,
  });

  useEffect(() => {
    fetch(dataUrl)
      .then((r) => r.json())
      .then((json) => {
        if (defaultSortKey === "topRatedScore" && json?.facilities) {
          json.facilities = json.facilities.map((f) => ({
            ...f,
            topRatedScore: computeTopRatedScore(f),
          }));
        }
        setRawData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [dataUrl, defaultSortKey]);

  const cities = useMemo(() => {
    if (!rawData) return [];
    const displayMap = new Map();
    rawData.facilities.forEach((f) => {
      if (!f.city) return;
      const lower = f.city.toLowerCase().trim();
      if (!displayMap.has(lower)) {
        const titleCased = f.city
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
        displayMap.set(lower, titleCased);
      }
    });
    return Array.from(displayMap.values()).sort((a, b) => a.localeCompare(b));
  }, [rawData]);

  const cityCoordsMap = useMemo(() => {
    if (!rawData) return {};
    const map = {};
    rawData.facilities.forEach((f) => {
      if (f.lat != null && f.lng != null) {
        const key = f.cityClean || f.city;
        if (key && !map[key]) {
          map[key] = { lat: f.lat, lng: f.lng };
        }
      }
    });
    return map;
  }, [rawData]);

  const filteredData = useMemo(() => {
    if (!rawData) return [];
    return rawData.facilities.filter((f) => {
      const selectedCities = Object.keys(filters.cityRadiusMap || {});
      if (selectedCities.length > 0) {
        const cityKey = (f.cityClean || f.city || "").toLowerCase().trim();
        const cityMatch = selectedCities.some(
          (sc) => sc.toLowerCase() === cityKey
        );
        if (cityMatch) return true;

        // Radius filtering using haversine
        const hasCoords = f.lat != null && f.lng != null;
        if (hasCoords) {
          const inRadius = selectedCities.some((sc) => {
            const coords = cityCoordsMap[sc];
            if (!coords || coords.lat == null) return false;
            const radius = filters.cityRadiusMap[sc];
            if (!radius || radius <= 0) return false;
            const dist = haversine(coords.lat, coords.lng, f.lat, f.lng);
            return dist <= radius;
          });
          if (inRadius) return true;
        }
        return false;
      }
      if (filters.maxFee && f.avgFee && f.avgFee > filters.maxFee) return false;
      if (filters.taxStatus && f.taxStatus !== filters.taxStatus) return false;
      if (filters.memoryCare === "yes" && !f.scrUnits) return false;
      if (filters.memoryCare === "no" && f.scrUnits) return false;
      if (filters.insurance && !f.insurance?.[filters.insurance]) return false;
      if (filters.safetyScoreMin != null && (f.safetyScore || 0) < filters.safetyScoreMin) return false;
      if (filters.safetyScoreMax != null && (f.safetyScore || 0) > filters.safetyScoreMax) return false;
      return true;
    });
  }, [rawData, filters, cityCoordsMap]);

  // Track facility search context (debounced, once per city+radius+risk change)
  useEffect(() => {
    if (!rawData || loading) return;
    const selectedCities = Object.keys(filters.cityRadiusMap || {});
    const hasSearch = selectedCities.length > 0 && selectedCities.some(c => filters.cityRadiusMap[c] > 0);
    if (!hasSearch) return;

    const timeout = setTimeout(() => {
      const city = selectedCities[0];
      const radius = filters.cityRadiusMap[city];
      const coords = cityCoordsMap[city];
      posthog?.capture('facility_search', {
        city,
        radius,
        tax_status: filters.taxStatus || 'any',
        max_fee: filters.maxFee || 'any',
        memory_care: filters.memoryCare || 'any',
        insurance: filters.insurance || 'any',
        safety_score_min: filters.safetyScoreMin ?? 'any',
        safety_score_max: filters.safetyScoreMax ?? 'any',
        result_count: filteredData.length,
        has_coords: coords?.lat != null,
        chart_source: source,
      });
      setSearchSessionTracked(true);
    }, 800); // 800ms debounce

    return () => clearTimeout(timeout);
  }, [rawData, loading, filters.cityRadiusMap, filters.taxStatus, filters.maxFee, filters.safetyScoreMin, filters.safetyScoreMax, filteredData.length, cityCoordsMap, source]);

  const kpis = useMemo(() => {
    if (!filteredData.length) return null;
    const validFee = filteredData.filter((f) => f.avgFee);
    const validOcc = filteredData.filter((f) => f.occupancyRate);
    return {
      count: filteredData.length,
      avgFee: validFee.length
        ? Math.round(validFee.reduce((a, f) => a + f.avgFee, 0) / validFee.length)
        : null,
      avgOccupancy: validOcc.length
        ? Math.round(validOcc.reduce((a, f) => a + f.occupancyRate, 0) / validOcc.length)
        : null,
      avgSafety: Math.round(
        filteredData.reduce((a, f) => a + f.safetyScore, 0) / filteredData.length
      ),
      nonprofitCount: filteredData.filter(
        (f) => f.taxStatus === "Not-for-profit"
      ).length,
    };
  }, [filteredData]);

  if (loading) {
    return (
      <div className={styles.dashboardWrap}>
        <div className={styles.dashboardTitle}>{title}</div>
        <div style={{ color: "#888", marginTop: 20 }}>Loading official state data…</div>
      </div>
    );
  }

  if (!rawData) {
    return (
      <div className={styles.dashboardWrap}>
        <div className={styles.dashboardTitle}>{title}</div>
        <div style={{ color: "#c00" }}>Unable to load facility data.</div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardWrap}>
      <h1 className={styles.dashboardTitle}>{title}</h1>
      <p className={styles.dashboardSubtitle}>{subtitle}</p>

      <FacilityFilterBar
        filters={filters}
        setFilters={setFilters}
        cities={cities}
        cityCoordsMap={cityCoordsMap}
        facilities={rawData?.facilities || []}
      />

      {kpis && (
        <div className={styles.kpiRow}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Facilities Shown</div>
            <div className={styles.kpiValue}>{kpis.count}</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Avg Monthly Fee</div>
            <div className={styles.kpiValue}>
              {kpis.avgFee ? `$${kpis.avgFee.toLocaleString()}` : "N/A"}
            </div>
            <div className={styles.kpiSub}>Based on official EOEA filings</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Avg Occupancy</div>
            <div className={styles.kpiValue}>
              {kpis.avgOccupancy != null ? `${kpis.avgOccupancy}%` : "N/A"}
            </div>
            <div className={styles.kpiSub}>12-month state average</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Avg Safety Score</div>
            <div className={styles.kpiValue}>{kpis.avgSafety}/100</div>
            <div className={styles.kpiSub}>From surveillance, generators, EMR</div>
          </div>
        </div>
      )}

      <div className={styles.chartGrid}>
        <PriceCareScatter data={filteredData} />
        <SafetyScoreChart
          data={filteredData}
          activeRange={
            filters.safetyScoreMin != null && filters.safetyScoreMax != null
              ? { min: filters.safetyScoreMin, max: filters.safetyScoreMax }
              : null
          }
          onBarClick={(range) =>
            setFilters((f) => ({
              ...f,
              safetyScoreMin: range.min,
              safetyScoreMax: range.max,
            }))
          }
        />
      </div>

      <div className={styles.chartGrid}>
        <InsuranceBreakdown data={filteredData} />
        <OccupancyBarChart data={filteredData} />
      </div>

      <InteractiveTable
        data={filteredData}
        defaultSortKey={defaultSortKey ?? (title.includes("Affordable") ? "avgFee" : "safetyScore")}
        defaultSortDir={defaultSortDir ?? (title.includes("Affordable") ? "asc" : "desc")}
        extraSorts={extraSorts}
        onSortChange={(sortKey, sortDir) => {
          posthog?.capture('facility_sort', {
            sort_key: sortKey,
            sort_dir: sortDir,
            chart_source: source,
          });
        }}
        onFacilityClick={(facility) => {
          posthog?.capture('facility_click', {
            facility_id: facility.id,
            facility_name: facility.name,
            city: facility.city,
            safety_score: facility.safetyScore,
            chart_source: source,
          });
        }}
      />

      <div className={styles.ctaBar}>
        <span className={styles.ctaText}>
          Want a personalized shortlist based on your family&apos;s needs?
        </span>
        <a href="/search" className={styles.ctaBtn}>
          Start Free Match
        </a>
      </div>
    </div>
  );
}
