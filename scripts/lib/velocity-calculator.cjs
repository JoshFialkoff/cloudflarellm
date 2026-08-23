/**
 * Velocity Calculator — Historical Review Delta Computation
 * Version: 2026-08-23-v1
 *
 * Reads prior JSON snapshots from public/data/review-snapshots/
 * and public/data/intelligence-snapshots/ to compute per-platform
 * review velocity (reviews/week) and trend direction.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_SNAPSHOT_DIRS = [
  path.join(__dirname, "../../public/data/review-snapshots"),
  path.join(__dirname, "../../public/data/intelligence-snapshots"),
];

function loadPreviousSnapshots(facilityName, snapshotDirs = DEFAULT_SNAPSHOT_DIRS) {
  const matches = [];
  const normalizedName = normalizeName(facilityName);

  for (const dir of snapshotDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        name: f,
        path: path.join(dir, f),
        mtime: fs.statSync(path.join(dir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(file.path, "utf-8"));
        const found = findFacilityInSnapshot(normalizedName, data);
        if (found) {
          matches.push({
            snapshot_path: file.path,
            snapshot_date: data.generatedAt || data.snapshot_at || file.name.replace(/\.json$/, ""),
            facility_data: found,
          });
        }
      } catch (e) {
        // Skip corrupted snapshot
      }
    }
  }

  // Sort by date descending, return unique most-recent
  matches.sort((a, b) => new Date(b.snapshot_date) - new Date(a.snapshot_date));
  return matches;
}

function findFacilityInSnapshot(normalizedName, data) {
  const facilities = data.data || data.facilities || [];
  for (const fac of facilities) {
    if (normalizeName(fac.facility_name) === normalizedName) {
      return fac;
    }
  }
  return null;
}

function computePlatformVelocities(current, previous) {
  if (!previous || !previous.snapshot_at) {
    return {
      prior_snapshot_date: null,
      days_since_prior: null,
      platform_velocities: [],
      overall_velocity_per_week: null,
      trend: "new_data",
    };
  }

  const currentDate = new Date(current.snapshot_at || current.generatedAt || Date.now());
  const priorDate = new Date(previous.snapshot_at);
  const timeDeltaMs = currentDate.getTime() - priorDate.getTime();
  const timeDeltaDays = Math.max(1, Math.round(timeDeltaMs / (1000 * 60 * 60 * 24)));

  const currentPlatforms = current.platforms || current.listings || [];
  const previousPlatforms = previous.platforms || previous.listings || [];

  const platformMap = {};
  for (const p of previousPlatforms) {
    platformMap[p.platform] = p;
  }

  const velocities = [];
  let totalDelta = 0;

  for (const cp of currentPlatforms) {
    const pp = platformMap[cp.platform];
    const currCount = cp.review_count ?? cp.total_reviews_on_page ?? 0;
    const prevCount = pp ? (pp.review_count ?? pp.total_reviews_on_page ?? 0) : 0;
    const delta = currCount - prevCount;
    const velocity = (delta / timeDeltaDays) * 7;

    totalDelta += delta;

    velocities.push({
      platform: cp.platform,
      current_count: currCount,
      previous_count: prevCount,
      delta_reviews: delta,
      velocity_per_week: Math.round(velocity * 100) / 100,
      time_window_days: timeDeltaDays,
    });
  }

  const overallVelocity = (totalDelta / timeDeltaDays) * 7;

  // Trend classification
  const priorVelocity = previous.velocity?.overall_velocity_per_week ?? null;
  let trend = "stable";
  if (priorVelocity !== null && overallVelocity !== null) {
    const ratio = overallVelocity / (priorVelocity || 0.1);
    if (ratio > 1.5) trend = "accelerating";
    else if (ratio < 0.5) trend = "decelerating";
    else trend = "stable";
  }
  // If no prior velocity but we have a delta
  if (priorVelocity === null && totalDelta > 0) trend = "new_data";

  return {
    prior_snapshot_date: previous.snapshot_at || previous.generatedAt,
    days_since_prior: timeDeltaDays,
    platform_velocities: velocities,
    overall_velocity_per_week: Math.round(overallVelocity * 100) / 100,
    trend,
  };
}

function saveVelocityToSnapshot(velocities, outPath) {
  fs.writeFileSync(outPath, JSON.stringify(velocities, null, 2));
}

function normalizeName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Convenience wrapper for the orchestrator
function computeVelocity(currentPlatforms, facilityName, previousSnapshots) {
  if (!previousSnapshots || previousSnapshots.length === 0) {
    return {
      facility_name: facilityName,
      computed_at: new Date().toISOString(),
      prior_snapshot_date: null,
      days_since_prior: null,
      platform_velocities: currentPlatforms.map((p) => ({
        platform: p.platform,
        current_count: p.review_count ?? p.total_reviews_on_page ?? 0,
        previous_count: 0,
        delta_reviews: 0,
        velocity_per_week: 0,
        time_window_days: null,
      })),
      overall_velocity_per_week: 0,
      trend: "new_data",
    };
  }

  const previous = previousSnapshots[0].facility_data;
  const velocities = computePlatformVelocities(
    { platforms: currentPlatforms, snapshot_at: new Date().toISOString() },
    previous,
  );

  return {
    facility_name: facilityName,
    computed_at: new Date().toISOString(),
    ...velocities,
  };
}

module.exports = {
  loadPreviousSnapshots,
  computePlatformVelocities,
  saveVelocityToSnapshot,
  computeVelocity,
};
