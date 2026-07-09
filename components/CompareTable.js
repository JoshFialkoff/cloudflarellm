import React, { useMemo } from 'react';
import styles from './CompareTable.module.css';

/**
 * CompareTable — Side-by-side visual comparison of 2-4 facilities.
 *
 * Props:
 *   facilities   — array of facility profile objects (from buildFacilityProfile or raw)
 *   showSummary  — whether to show the summary bar (default: true)
 */
export default function CompareTable({ facilities, showSummary = true }) {
  const comparisonData = useMemo(() => buildComparisonData(facilities), [facilities]);

  if (!facilities || facilities.length < 2) {
    return (
      <div className={styles.tableWrapper}>
        <div className={styles.emptyState}>
          <h3>Select facilities to compare</h3>
          <p>Choose at least 2 facilities from the sidebar to see a side-by-side comparison.</p>
        </div>
      </div>
    );
  }

  // Find the index of the facility with the lowest min price for highlighting
  const lowestPriceIndex = facilities.reduce(
    (best, f, i) => (f.monthlyMin < facilities[best].monthlyMin ? i : best),
    0,
  );

  // Find the index of the facility with the highest rating
  const highestRatingIndex = facilities.reduce(
    (best, f, i) => ((f.rating || 0) > (facilities[best].rating || 0) ? i : best),
    0,
  );

  return (
    <div className={styles.tableWrapper}>
      {/* Summary bar */}
      {showSummary && (
        <div className={styles.summaryBar}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryIcon}>🏠</span>
            <span>
              Comparing <strong>{facilities.length}</strong> facilities
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryIcon}>💰</span>
            <span>
              Range: <strong>${Number(facilities[lowestPriceIndex].monthlyMin || 0).toLocaleString()}</strong> –{' '}
              <strong>${Math.max(...facilities.map(f => Number(f.monthlyMax || 0))).toLocaleString()}/mo</strong>
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryIcon}>⭐</span>
            <span>
              Best rated: <strong>{facilities[highestRatingIndex].name}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Grid header */}
      <div className={styles.comparisonGrid}>
        {/* Header row */}
        <div className={styles.headerRow}>
          <div className={styles.headerCell}>Feature</div>
          {facilities.map((facility, idx) => (
            <div key={facility.slug} className={styles.headerCell}>
              <div className={styles.headerFacilityName}>{facility.name}</div>
              {idx === lowestPriceIndex && (
                <span className={styles.facilityBadge}>Best Value</span>
              )}
            </div>
          ))}
        </div>

        {/* Price row */}
        <div className={styles.dataRow}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>💰</span>
            Monthly Cost
            <span className={styles.rowDescription}>Published range</span>
          </div>
          {facilities.map((facility, idx) => {
            const isBest = idx === lowestPriceIndex;
            const maxPrice = Math.max(...facilities.map(f => f.monthlyMax));
            const barWidth = Math.max(10, (1 - facility.monthlyMin / maxPrice) * 100);
            return (
              <div key={facility.slug} className={`${styles.dataCell} ${isBest ? styles.bestCell : ''}`}>
                <div className={styles.priceBarContainer}>
                  <div
                    className={styles.priceBar}
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className={styles.priceBarLabel}>
                    ${Number(facility.monthlyMin || 0).toLocaleString()}–${Number(facility.monthlyMax || 0).toLocaleString()}
                  </span>
                </div>
                {isBest && <span className={styles.bestBadge}>Best Value</span>}
              </div>
            );
          })}
        </div>

        {/* Rating row */}
        <div className={styles.dataRow}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>⭐</span>
            Rating
            <span className={styles.rowDescription}>User & compliance score</span>
          </div>
          {facilities.map((facility, idx) => {
            const isBest = idx === highestRatingIndex;
            const rating = facility.rating || 0;
            const fullStars = Math.floor(rating);
            const hasHalf = rating - fullStars >= 0.25;
            return (
              <div key={facility.slug} className={`${styles.dataCell} ${isBest ? styles.bestCell : ''}`}>
                <div className={styles.starRating}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span
                      key={star}
                      className={`${styles.star} ${star <= fullStars ? styles.starFilled : styles.starEmpty}`}
                    >
                      {star <= fullStars ? '★' : '☆'}
                    </span>
                  ))}
                  <span className={styles.ratingNumber}>{rating}</span>
                </div>
                {isBest && <span className={styles.bestBadge}>Top Rated</span>}
              </div>
            );
          })}
        </div>

        {/* Care types row */}
        <div className={styles.dataRow}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>🏥</span>
            Care Types
            <span className={styles.rowDescription}>Services offered</span>
          </div>
          {facilities.map(facility => (
            <div key={facility.slug} className={styles.dataCell}>
              <div className={styles.careTypePills}>
                {(facility.careTypes || []).map(type => (
                  <span key={type} className={styles.careTypePill}>{type}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Memory care row */}
        <div className={styles.dataRow}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>🧠</span>
            Memory Care
            <span className={styles.rowDescription}>Dedicated support</span>
          </div>
          {facilities.map(facility => {
            const hasMemoryCare = (facility.careTypes || []).includes('Memory Care');
            return (
              <div key={facility.slug} className={styles.dataCell}>
                <span className={`${styles.featureCheck} ${hasMemoryCare ? styles.featureYes : styles.featureNo}`}>
                  {hasMemoryCare ? '✓' : '—'}
                </span>
                {hasMemoryCare && <span style={{ fontSize: '0.75rem', marginLeft: 4, color: 'var(--primary)' }}>Available</span>}
              </div>
            );
          })}
        </div>

        {/* Compliance row */}
        <div className={styles.dataRow}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>🛡️</span>
            Compliance
            <span className={styles.rowDescription}>Inspection rating</span>
          </div>
          {facilities.map(facility => {
            const rating = facility.complianceRating || 'Unknown';
            const badgeClass =
              rating === 'Excellent'
                ? styles.complianceExcellent
                : rating === 'Good'
                  ? styles.complianceGood
                  : styles.complianceNeedsImprovement;

            // Find best compliance
            const bestCompliance = facilities.reduce((best, f) => {
              const score = { Excellent: 3, Good: 2, 'Needs Improvement': 1, Unknown: 0 };
              return score[f.complianceRating || 'Unknown'] > score[best] ? f.complianceRating || 'Unknown' : best;
            }, 'Unknown');

            const isBest = rating === bestCompliance && rating !== 'Unknown';

            return (
              <div key={facility.slug} className={`${styles.dataCell} ${isBest && rating === 'Excellent' ? styles.bestCell : ''}`}>
                <span className={`${styles.complianceBadge} ${badgeClass}`}>
                  {rating === 'Excellent' ? '✓' : rating === 'Good' ? '~' : '!'} {rating}
                </span>
                {isBest && rating === 'Excellent' && <span className={styles.bestBadge}>Best</span>}
              </div>
            );
          })}
        </div>

        {/* Capacity row */}
        <div className={styles.dataRow}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>🏘️</span>
            Capacity
            <span className={styles.rowDescription}>Resident capacity</span>
          </div>
          {facilities.map(facility => (
            <div key={facility.slug} className={styles.dataCell}>
              {facility.capacity ? `${facility.capacity} residents` : '—'}
            </div>
          ))}
        </div>

        {/* Phone row */}
        <div className={styles.dataRow}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>📞</span>
            Contact
            <span className={styles.rowDescription}>Phone number</span>
          </div>
          {facilities.map(facility => (
            <div key={facility.slug} className={styles.dataCell}>
              {facility.phone || '—'}
            </div>
          ))}
        </div>

        {/* About/preview row */}
        <div className={styles.dataRow}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>📋</span>
            About
            <span className={styles.rowDescription}>Quick summary</span>
          </div>
          {facilities.map(facility => (
            <div key={facility.slug} className={styles.dataCell} style={{ fontSize: '0.8rem', lineHeight: 1.4, textAlign: 'left' }}>
              {(facility.about || '').slice(0, 150)}
              {(facility.about || '').length > 150 ? '...' : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Build comparison metadata.
 */
function buildComparisonData(facilities) {
  return {
    count: facilities.length,
    priceRange: {
      min: Math.min(...facilities.map(f => f.monthlyMin)),
      max: Math.max(...facilities.map(f => f.monthlyMax)),
    },
    bestRated: facilities.reduce((best, f) => ((f.rating || 0) > (best.rating || 0) ? f : best), facilities[0]),
    bestValue: facilities.reduce((best, f) => (f.monthlyMin < best.monthlyMin ? f : best), facilities[0]),
  };
}
