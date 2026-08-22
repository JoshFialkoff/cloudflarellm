"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import styles from "../../styles/facility-charts/Dashboard.module.css";

const RADIUS_OPTIONS = [5, 10, 20, 50];
const DEFAULT_RADIUS = 20;

function RadiusBadge({ radius, onChange }) {
  return (
    <span className={styles.radiusBadge}>
      <select
        className={styles.radiusSelect}
        value={radius}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Radius"
      >
        {RADIUS_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r} mi
          </option>
        ))}
      </select>
    </span>
  );
}

/* ── Elegant hover-reveal dropdown ── */
function HoverDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);

  const current = options.find((o) => o.key === value) || options[0];

  const handleEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  /* Close on outside click */
  useEffect(() => {
    function handleDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={styles.hoverDropdown}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        className={`${styles.hoverDropdownTrigger} ${open ? styles.hoverDropdownTriggerOpen : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.hoverDropdownValue}>{current.label}</span>
        <span className={styles.hoverDropdownChevron}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <div className={styles.hoverDropdownMenu} role="listbox">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`${styles.hoverDropdownItem} ${opt.key === value ? styles.hoverDropdownItemActive : ""}`}
              role="option"
              aria-selected={opt.key === value}
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
              onMouseEnter={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
              }}
            >
              {opt.key === value && (
                <span className={styles.hoverDropdownCheck}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
              <span className={styles.hoverDropdownItemLabel}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FacilityFilterBar({ filters, setFilters, cities, cityCoordsMap = {}, facilities = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    function handleDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [open]);

  /* Derive selected map { city -> radius } from filters */
  const selectedMap = filters.cityRadiusMap || {};
  const selectedCities = Object.keys(selectedMap);

  function toggleCity(city) {
    setFilters((prev) => {
      const next = { ...prev, cityRadiusMap: { ...prev.cityRadiusMap } };
      if (next.cityRadiusMap[city]) {
        delete next.cityRadiusMap[city];
      } else {
        next.cityRadiusMap[city] = DEFAULT_RADIUS;
      }
      return next;
    });
  }

  function setCityRadius(city, radius) {
    setFilters((prev) => ({
      ...prev,
      cityRadiusMap: { ...prev.cityRadiusMap, [city]: radius },
    }));
  }

  function removeCity(city) {
    setFilters((prev) => {
      const next = { ...prev, cityRadiusMap: { ...prev.cityRadiusMap } };
      delete next.cityRadiusMap[city];
      return next;
    });
  }

  function selectAllVisible() {
    setFilters((prev) => {
      const next = { ...prev, cityRadiusMap: { ...prev.cityRadiusMap } };
      visible.forEach((c) => {
        if (!next.cityRadiusMap[c]) next.cityRadiusMap[c] = DEFAULT_RADIUS;
      });
      return next;
    });
  }

  function clearAll() {
    setFilters((prev) => ({ ...prev, cityRadiusMap: {} }));
  }

  // Build a zip-to-city map from facilities data
  const zipToCityMap = useMemo(() => {
    const map = {};
    facilities.forEach((f) => {
      if (f.zipCode) {
        const zip = String(f.zipCode).padStart(5, '0');
        if (!map[zip]) {
          const cityName = f.cityClean || f.city;
          if (cityName) map[zip] = cityName;
        }
      }
    });
    return map;
  }, [facilities]);

  const visible = useMemo(() => {
    if (!query.trim()) return cities;
    const q = query.trim().toLowerCase();
    const qZips = q.match(/\b\d{5}\b/g) || [];
    const zipCities = new Set();
    qZips.forEach((z) => {
      const city = zipToCityMap[z];
      if (city) zipCities.add(city);
    });

    return cities.filter((c) => {
      const cityLower = c.toLowerCase();
      // Match if city includes query or query includes city
      if (cityLower.includes(q) || q.includes(cityLower)) return true;
      // Match if any extracted zip maps to this city
      if (zipCities.has(c)) return true;
      return false;
    });
  }, [query, cities, zipToCityMap]);

  const hasRadiusSupport = Object.keys(cityCoordsMap).length > 0;

  return (
    <div className={styles.filterBar}>
      {/* ── City multi-select with radius ── */}
      <div className={styles.filterGroup} style={{ minWidth: 340, flex: 2 }}>
        <label className={styles.filterLabel}>City / Town</label>
        <div className={styles.multiSelectWrap} ref={containerRef}>
          {/* Trigger */}
          <button
            type="button"
            className={styles.multiSelectTrigger}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            {selectedCities.length === 0 ? (
              <span className={styles.multiSelectPlaceholder}>
                All Massachusetts
              </span>
            ) : (
              <span className={styles.multiSelectChips}>
                {selectedCities.map((city) => (
                  <span key={city} className={styles.cityChip}>
                    <span className={styles.cityChipName}>{city}</span>
                    <RadiusBadge
                      radius={selectedMap[city]}
                      onChange={(r) => setCityRadius(city, r)}
                    />
                    <button
                      type="button"
                      className={styles.cityChipRemove}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCity(city);
                      }}
                      aria-label={`Remove ${city}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </span>
            )}
            <span className={styles.multiSelectChevrons}>
              {selectedCities.length > 0 && (
                <span className={styles.multiSelectCountBadge}>
                  {selectedCities.length}
                </span>
              )}
              <span className={styles.multiSelectChevron}>
                {open ? "▲" : "▼"}
              </span>
            </span>
          </button>

          {/* Dropdown */}
          {open && (
            <div className={styles.multiSelectDropdown} role="listbox">
              <div className={styles.multiSelectSearchRow}>
                <svg
                  className={styles.searchIcon}
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.57 14 6 12.43 6 10.5S7.57 7 9.5 7 13 8.57 13 10.5 11.43 14 9.5 14z"
                  />
                </svg>
                <input
                  type="text"
                  className={styles.multiSelectSearch}
                  placeholder="Search cities, towns, or ZIP code…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.multiSelectActions}>
                <button type="button" onClick={selectAllVisible}>
                  Select all{query ? " matching" : ""}
                </button>
                <span className={styles.multiSelectDivider}>|</span>
                <button type="button" onClick={clearAll}>
                  Clear all
                </button>
              </div>
              <div className={styles.multiSelectList}>
                {visible.map((city) => {
                  const checked = !!selectedMap[city];
                  return (
                    <label
                      key={city}
                      className={styles.multiSelectItem}
                      data-checked={checked}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCity(city)}
                      />
                      <span className={styles.multiSelectItemName}>{city}</span>
                      {checked && (
                        <span className={styles.multiSelectItemMeta}>
                          <RadiusBadge
                            radius={selectedMap[city]}
                            onChange={(r) => setCityRadius(city, r)}
                          />
                        </span>
                      )}
                    </label>
                  );
                })}
                {visible.length === 0 && (
                  <div className={styles.multiSelectEmpty}>No matches found</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Radius explanation when selections exist */}
        {selectedCities.length > 0 && (
          <p className={styles.radiusHint}>
            {hasRadiusSupport
              ? "Showing facilities within the selected radius. Results include the chosen city and nearby communities based on geocoded coordinates."
              : "Showing facilities in selected cities only. Radius filtering requires geocoded coordinates — coming soon."}
          </p>
        )}
      </div>

      {/* ── Max Fee ── */}
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel}>Max Monthly Fee</label>
        <input
          type="range"
          className={styles.filterRange}
          min={3000}
          max={15000}
          step={500}
          value={filters.maxFee || 15000}
          onChange={(e) =>
            setFilters((f) => ({ ...f, maxFee: Number(e.target.value) }))
          }
        />
        <span className={styles.rangeValue}>
          ${filters.maxFee?.toLocaleString() || "15,000"}
        </span>
      </div>

      {/* ── Tax Status (hover dropdown) ── */}
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel}>Tax Status</label>
        <HoverDropdown
          label="Tax Status"
          value={filters.taxStatus || ""}
          onChange={(key) => setFilters((f) => ({ ...f, taxStatus: key }))}
          options={[
            { key: "", label: "Any" },
            { key: "Not-for-profit", label: "Non-Profit" },
            { key: "For-profit", label: "For-Profit" },
          ]}
        />
      </div>

      {/* ── Memory Care (hover dropdown) ── */}
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel}>Memory Care</label>
        <HoverDropdown
          label="Memory Care"
          value={filters.memoryCare || ""}
          onChange={(key) => setFilters((f) => ({ ...f, memoryCare: key }))}
          options={[
            { key: "", label: "Any" },
            { key: "yes", label: "Has SCR" },
            { key: "no", label: "Traditional" },
          ]}
        />
      </div>

      {/* ── Insurance (hover dropdown) ── */}
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel}>Insurance</label>
        <HoverDropdown
          label="Insurance"
          value={filters.insurance || ""}
          onChange={(key) => setFilters((f) => ({ ...f, insurance: key }))}
          options={[
            { key: "", label: "Any" },
            { key: "sco", label: "Accepts SCO" },
            { key: "pace", label: "Accepts PACE" },
            { key: "gafc", label: "Accepts GAFC" },
            { key: "section8", label: "Accepts Section 8" },
            { key: "mrvp", label: "Accepts MRVP" },
          ]}
        />
      </div>

      {/* ── Safety Score Range (hover dropdown) ── */}
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel}>Safety Score</label>
        <HoverDropdown
          label="Safety Score"
          value={
            filters.safetyScoreMin != null && filters.safetyScoreMax != null
              ? `${filters.safetyScoreMin}-${filters.safetyScoreMax}`
              : ""
          }
          onChange={(key) => {
            if (!key) {
              setFilters((f) => ({ ...f, safetyScoreMin: null, safetyScoreMax: null }));
            } else {
              const [min, max] = key.split("-").map(Number);
              setFilters((f) => ({ ...f, safetyScoreMin: min, safetyScoreMax: max }));
            }
          }}
          options={[
            { key: "", label: "Any" },
            { key: "0-20", label: "0 – 20" },
            { key: "21-40", label: "21 – 40" },
            { key: "41-60", label: "41 – 60" },
            { key: "61-80", label: "61 – 80" },
            { key: "81-100", label: "81 – 100" },
          ]}
        />
      </div>
    </div>
  );
}
