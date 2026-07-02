/**
 * matchingScore.js — Transparent weighted scoring engine for facility matching.
 *
 * Scores facilities against user intake responses and generates human-readable
 * "Why this matches" explanations.
 *
 * All weights are configurable via the SCORING_WEIGHTS constant. No magic numbers.
 */

// ---------------------------------------------------------------------------
// Configurable weights
// ---------------------------------------------------------------------------
export const SCORING_WEIGHTS = {
  /** Maximum possible score for a perfect match. Used for normalization. */
  MAX_SCORE: 100,

  /** Weight for care-type alignment (most important signal). */
  CARE_TYPE: 40,

  /** Weight for location proximity / region match. */
  LOCATION: 25,

  /** Weight for budget compatibility. */
  BUDGET: 20,

  /** Weight for amenity preferences (equally divided across matched amenities). */
  PREFERENCES: 10,

  /** Bonus when a facility has an availability/accepting-new-residents signal. */
  AVAILABILITY_BONUS: 5,

  /**
   * Specialization bonus — if a facility's care types exactly match the user's
   * selection (e.g. user picks "Memory Care" and facility only does Memory Care).
   */
  SPECIALIZATION_BONUS: 5,
};

/**
 * Minimum score a facility needs to appear in results.
 * Helps degrade gracefully when few matches exist.
 */
export const MINIMUM_DISPLAY_SCORE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fuzzy-match a user's care-type string against a facility's care types array.
 * Returns 1 (exact), 0.5 (partial), or 0 (none).
 */
function scoreCareType(careTypes, userCareType) {
  if (!userCareType || !careTypes || careTypes.length === 0) return 0;

  const uct = userCareType.toLowerCase().trim();

  // Exact match
  if (careTypes.some((ct) => ct.toLowerCase().trim() === uct)) return 1;

  // Partial match — e.g. "assisted" matches "Assisted Living"
  if (careTypes.some((ct) => ct.toLowerCase().includes(uct) || uct.includes(ct.toLowerCase()))) {
    return 0.5;
  }

  return 0;
}

/**
 * Score location match. Compares user-provided location string (town name, region, or ZIP)
 * against facility address.
 * Returns 1 (exact town match), 0.7 (regional match via keyword), 0.3 (same state), or 0.
 */
function scoreLocation(facilityAddress, userLocation) {
  if (!userLocation || !facilityAddress) return 0;

  const ul = userLocation.toLowerCase().trim();
  const address = facilityAddress.toLowerCase();

  // User entered a town name that appears in the facility address
  if (address.includes(ul)) return 1;

  // Check if facility is in Massachusetts (both are in MA)
  if (address.includes('ma') && (ul.includes('ma') || ul.includes('massachusetts'))) {
    return 0.3;
  }

  // Check for regional keywords (e.g. "greater boston", "western mass")
  const userRegion = ul.replace(/^(greater|western|eastern|northern|southern|central)\s*/i, '').trim();
  if (userRegion && address.includes(userRegion)) return 0.7;

  return 0;
}

/**
 * Score budget compatibility.
 * Returns 1 (within range), 0.7 (slightly above max), 0.3 (well above), 0 (too expensive),
 * or 0.5 (no user budget or facility price info — graceful degradation).
 */
function scoreBudget(facilityMonthlyMin, facilityMonthlyMax, userBudget) {
  if (userBudget == null || isNaN(userBudget)) return 0.5; // no user budget → neutral
  if (facilityMonthlyMin == null && facilityMonthlyMax == null) return 0.5; // no price info → neutral

  const effectiveMin = facilityMonthlyMin || 0;
  const effectiveMax = facilityMonthlyMax || Infinity;

  if (userBudget >= effectiveMin && userBudget <= effectiveMax) return 1;

  // Slightly over max (within 30%)
  if (userBudget > effectiveMax) {
    const ratio = (userBudget - effectiveMax) / effectiveMax;
    if (ratio <= 0.3) return 0.7;
    return 0.3;
  }

  // Below min — unlikely to be affordable
  return 0;
}

/**
 * Score amenity preferences.
 * Returns ratio of matched preferences to total preferences (0–1).
 * If no preferences or no facility amenities, returns 0.5 (neutral).
 */
function scoreAmenities(facilityAmenities, userPreferences) {
  if (!userPreferences || userPreferences.length === 0) return 0.5; // neutral
  if (!facilityAmenities || facilityAmenities.length === 0) return 0.3; // facility has no info

  const facilityAmenityNames = facilityAmenities.map((a) =>
    (a.name || a || '').toLowerCase().trim()
  );

  const matches = userPreferences.filter((pref) => {
    const p = pref.toLowerCase().trim();
    return facilityAmenityNames.some((name) => name.includes(p) || p.includes(name));
  });

  return matches.length / userPreferences.length;
}

/**
 * Deterministic tie-breaker: uses facility ID and rating to produce a stable ordering.
 * Higher rating wins; if equal, lower ID wins (older facility record).
 */
function tieBreaker(a, b) {
  const ratingA = a.rating || 0;
  const ratingB = b.rating || 0;
  if (ratingA !== ratingB) return ratingB - ratingA; // higher rating first
  return (a.id || 0) - (b.id || 0); // lower ID first (more established)
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Score a single facility against user intake criteria.
 *
 * @param {object} facility — Facility object from MASSACHUSETTS_FACILITIES
 * @param {object} intake   — User intake responses
 * @param {string} intake.careType         — e.g. "Assisted Living", "Memory Care", etc.
 * @param {number} intake.budget           — Monthly budget in dollars
 * @param {string} intake.location         — City, region, or ZIP string
 * @param {string[]} intake.preferences    — Amenity preference keywords
 * @param {boolean} intake.availability    — Whether availability is important
 * @returns {{ score: number, breakdown: object, explanation: string }}
 */
export function scoreFacility(facility, intake) {
  const w = SCORING_WEIGHTS;

  // 1. Care type match (highest weight)
  const careTypeScore = scoreCareType(facility.careTypes, intake.careType);
  const careTypePoints = careTypeScore * w.CARE_TYPE;

  // Specialization bonus: facility focuses ONLY on what user wants
  let specializationPoints = 0;
  if (
    careTypeScore >= 0.5 &&
    intake.careType &&
    facility.careTypes &&
    facility.careTypes.length === 1 &&
    facility.careTypes[0].toLowerCase().includes(intake.careType.toLowerCase())
  ) {
    specializationPoints = w.SPECIALIZATION_BONUS;
  }

  // 2. Location match
  const locationScore = scoreLocation(facility.address, intake.location);
  const locationPoints = locationScore * w.LOCATION;

  // 3. Budget compatibility
  const budgetScore = scoreBudget(facility.monthlyMin, facility.monthlyMax, intake.budget);
  const budgetPoints = budgetScore * w.BUDGET;

  // 4. Amenity preferences
  const preferencesScore = scoreAmenities(facility.amenities, intake.preferences);
  const preferencesPoints = preferencesScore * w.PREFERENCES;

  // 5. Availability bonus
  const availabilityPoints = intake.availability ? w.AVAILABILITY_BONUS : 0;

  // Total
  const rawScore =
    careTypePoints + specializationPoints + locationPoints + budgetPoints + preferencesPoints + availabilityPoints;

  // Normalize to 0–100
  const maxPossible = w.CARE_TYPE + w.SPECIALIZATION_BONUS + w.LOCATION + w.BUDGET + w.PREFERENCES + w.AVAILABILITY_BONUS;
  const score = Math.round((rawScore / maxPossible) * w.MAX_SCORE);

  // Build breakdown for explanation
  const breakdown = {
    careType: { score: careTypeScore, points: Math.round(careTypePoints), weight: w.CARE_TYPE },
    specialization: { points: Math.round(specializationPoints), weight: w.SPECIALIZATION_BONUS },
    location: { score: locationScore, points: Math.round(locationPoints), weight: w.LOCATION },
    budget: { score: budgetScore, points: Math.round(budgetPoints), weight: w.BUDGET },
    preferences: { score: preferencesScore, points: Math.round(preferencesPoints), weight: w.PREFERENCES },
    availability: { points: Math.round(availabilityPoints), weight: w.AVAILABILITY_BONUS },
  };

  // Build explanation
  const explanation = buildExplanation(facility, intake, breakdown, score);

  return { score, breakdown, explanation };
}

// ---------------------------------------------------------------------------
// Explanation generation
// ---------------------------------------------------------------------------

function buildExplanation(facility, intake, breakdown, totalScore) {
  const parts = [];

  // Care type
  if (breakdown.careType.score >= 0.5) {
    const matchedTypes = facility.careTypes.filter((ct) => {
      const uct = (intake.careType || '').toLowerCase().trim();
      return ct.toLowerCase().includes(uct) || uct.includes(ct.toLowerCase());
    });
    if (matchedTypes.length > 0) {
      parts.push(`Offers ${matchedTypes.join(' & ')}`);
    } else {
      parts.push(`Care type aligns with your needs`);
    }
  } else {
    parts.push(`Does not specifically list ${intake.careType || 'your care type'}`);
  }

  // Location
  if (breakdown.location.score >= 1) {
    parts.push(`Located in ${intake.location}`);
  } else if (breakdown.location.score >= 0.5) {
    parts.push(`Serves the ${intake.location} area`);
  } else if (breakdown.location.score > 0) {
    parts.push('In Massachusetts');
  } else {
    parts.push('Location information not specified');
  }

  // Budget
  if (breakdown.budget.score >= 1) {
    parts.push('Within your budget range');
  } else if (breakdown.budget.score >= 0.5) {
    const max = facility.monthlyMax;
    if (max) {
      parts.push(`Slightly above your budget at ~$${max.toLocaleString()}/mo max`);
    } else {
      parts.push('Budget information not confirmed');
    }
  } else if (breakdown.budget.score === 0.5) {
    parts.push('Price information not available for comparison');
  } else {
    parts.push('May be outside your budget range');
  }

  // Preferences
  if (intake.preferences && intake.preferences.length > 0 && breakdown.preferences.score > 0) {
    const matched = (intake.preferences || []).filter((pref) => {
      const p = pref.toLowerCase().trim();
      return (facility.amenities || []).some((a) =>
        (a.name || '').toLowerCase().includes(p)
      );
    });
    if (matched.length > 0) {
      parts.push(`Matches ${matched.length} of your preferences`);
    }
  }

  // Availability
  if (breakdown.availability.points > 0) {
    parts.push('Availability confirmed');
  }

  // Rating signal (bonus info, not scored explicitly)
  if (facility.rating && facility.rating >= 4.5) {
    parts.push('Top-rated community');
  } else if (facility.rating && facility.rating >= 4.0) {
    parts.push('Well-rated community');
  }

  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score and rank all facilities against user intake.
 *
 * @param {object[]} facilities — Array of facility objects
 * @param {object} intake       — User intake criteria (same shape as scoreFacility intake param)
 * @returns {object[]} Ranked array of { facility, score, breakdown, explanation, rank }
 */
export function rankFacilities(facilities, intake) {
  if (!facilities || facilities.length === 0) return [];
  if (!intake) {
    // No intake → return all facilities with neutral scores
    return facilities.map((f, i) => ({
      facility: f,
      score: 50,
      breakdown: null,
      explanation: 'No matching criteria provided',
      rank: i + 1,
    }));
  }

  const scored = facilities
    .map((facility) => {
      const result = scoreFacility(facility, intake);
      return { facility, ...result };
    })
    .filter((item) => item.score >= MINIMUM_DISPLAY_SCORE);

  // Sort by score descending, then tie-breaker
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return tieBreaker(a.facility, b.facility);
  });

  // Assign rank
  return scored.map((item, index) => ({ ...item, rank: index + 1 }));
}

/**
 * Normalize a care-type label from the intake form into a matchable string.
 */
export function normalizeCareType(label) {
  const map = {
    'independent living': 'Independent Living',
    independent: 'Independent Living',
    'assisted living': 'Assisted Living',
    assisted: 'Assisted Living',
    'memory care': 'Memory Care',
    memory: 'Memory Care',
    'skilled nursing': 'Skilled Nursing',
    skilled: 'Skilled Nursing',
  };
  return map[(label || '').toLowerCase().trim()] || label;
}
