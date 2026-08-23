/**
 * Occupancy Proxy — FOIA + Review Velocity Composite Model
 * Version: 2026-08-23-v1
 *
 * No ML model. Combines:
 *   - FOIA occupancyRate (most reliable)
 *   - Review velocity trend (proxy signal)
 *   - Listing pricing changes (proxy signal)
 */

function estimateOccupancy(foiaRate, foiaDateStr, reviewVelocityTrend, priceHistory) {
  const now = new Date();
  const foiaAgeDays = foiaDateStr ? Math.max(0, Math.round((now - new Date(foiaDateStr)) / (1000 * 60 * 60 * 24))) : null;

  const base = foiaRate ?? 75; // industry average fallback

  // Velocity factor: high velocity can mean either very active (high occupancy)
  // OR a crisis (negative reviews during turnover). We bias conservatively.
  let velocityFactor = 0;
  if (reviewVelocityTrend !== null && reviewVelocityTrend !== undefined) {
    if (reviewVelocityTrend > 3) velocityFactor = 3;    // unusually active
    else if (reviewVelocityTrend > 1.5) velocityFactor = 2;
    else if (reviewVelocityTrend < 0.2) velocityFactor = -3; // very quiet
    else if (reviewVelocityTrend < 0.5) velocityFactor = -2;
  }

  // Price factor: recent price drops suggest vacancies
  let priceFactor = 0;
  if (priceHistory && priceHistory.length >= 2) {
    const sorted = [...priceHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
    const latest = sorted[sorted.length - 1];
    const prior = sorted[sorted.length - 2];
    if (latest.price && prior.price) {
      const changePct = (latest.price - prior.price) / prior.price;
      if (changePct < -0.05) priceFactor = -4; // >5% drop
      else if (changePct < -0.02) priceFactor = -2;
      else if (changePct > 0.05) priceFactor = 1; // price rising, possibly filling up
    }
  }

  let estimated = Math.min(100, Math.max(0, base + velocityFactor + priceFactor));

  let confidence = "low";
  if (foiaRate !== null && foiaRate !== undefined && foiaAgeDays !== null && foiaAgeDays <= 90) {
    confidence = "medium";
    if (reviewVelocityTrend !== null) confidence = "medium-high";
    if (foiaAgeDays <= 30) confidence = "high";
  } else if (reviewVelocityTrend !== null) {
    confidence = "low";
  }

  // Override: if no data at all
  if (foiaRate === null && reviewVelocityTrend === null) {
    estimated = 75;
    confidence = "low";
  }

  return {
    foia_value: foiaRate,
    foia_age_days: foiaAgeDays,
    review_velocity_trend: reviewVelocityTrend,
    price_change_factor: priceFactor,
    velocity_factor: velocityFactor,
    estimated_occupancy: estimated,
    confidence,
    model_version: "proxy-v1-2026-08-23",
  };
}

module.exports = {
  estimateOccupancy,
};
