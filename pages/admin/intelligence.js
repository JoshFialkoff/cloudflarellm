import { useEffect, useState } from "react";

export default function IntelligenceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/data/review-snapshots/latest.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((snapshot) => {
        setData(snapshot);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading intelligence data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  const facilities = data?.data || [];
  const totalFacilities = 273; // Known from chart-facilities.json
  const totalReviews = facilities.reduce(
    (sum, r) => sum + (r.total_review_count || 0),
    0
  );
  const avgRating =
    facilities.length > 0
      ? (
          facilities
            .filter((r) => r.highest_rating != null)
            .reduce((sum, r) => sum + (r.highest_rating || 0), 0) /
          facilities.filter((r) => r.highest_rating != null).length
        ).toFixed(2)
      : "—";

  const platformMap = aggregatePlatforms(facilities);
  const conf = confidenceCounts(facilities);
  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString()
    : "No snapshot found";

  const scannedCount = facilities.length;
  const coveragePct = totalFacilities
    ? ((scannedCount / totalFacilities) * 100).toFixed(0)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Facility Intelligence Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last run: {generatedAt} · Batch size: {data?.batchSize || 0}{" "}
            · NocoDB table: {data?.nocoTable || "—"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Facilities Scanned"
            value={`${scannedCount} / ${totalFacilities}`}
            sub={`${coveragePct}% coverage`}
          />
          <StatCard label="Total Reviews Found" value={totalReviews} />
          <StatCard label="Avg Highest Rating" value={avgRating} sub="/ 5.0" />
          <StatCard
            label="Platforms Covered"
            value={Object.keys(platformMap).length}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Extraction Confidence
            </h2>
            <div className="space-y-3">
              <ConfidenceBar label="High" count={conf.high} total={conf.high + conf.medium + conf.low} color="bg-green-500" />
              <ConfidenceBar label="Medium" count={conf.medium} total={conf.high + conf.medium + conf.low} color="bg-yellow-400" />
              <ConfidenceBar label="Low" count={conf.low} total={conf.high + conf.medium + conf.low} color="bg-red-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Reviews by Platform
            </h2>
            <div className="space-y-3">
              {Object.entries(platformMap)
                .sort((a, b) => b[1].reviews - a[1].reviews)
                .map(([name, stats]) => (
                  <div key={name} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      {name}
                    </span>
                    <div className="text-right">
                      <span className="text-sm text-gray-900">
                        {stats.reviews.toLocaleString()} reviews
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        ({stats.count} snapshots)
                      </span>
                    </div>
                  </div>
                ))}
              {Object.keys(platformMap).length === 0 && (
                <p className="text-sm text-gray-400">No platform data yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Facility Snapshots
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Facility
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platforms
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Reviews
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Highest
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lowest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {facilities.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.facility_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.city}, {row.state}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {row.platform_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                      {row.total_review_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {row.highest_rating ?? "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {row.lowest_rating ?? "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">
                      {row.source_page_url ? (
                        <a
                          href={row.source_page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {(() => {
                            try {
                              return new URL(row.source_page_url).hostname;
                            } catch {
                              return "link";
                            }
                          })()}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {facilities.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-sm text-gray-400"
                    >
                      No review snapshots available. Run{" "}
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">
                        npm run sync:reviews
                      </code>{" "}
                      to populate data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function aggregatePlatforms(data) {
  const map = {};
  for (const r of data) {
    for (const p of r.platforms || []) {
      const name = p.platform || "Unknown";
      if (!map[name]) map[name] = { count: 0, reviews: 0, ratings: [] };
      map[name].count += 1;
      if (p.review_count) map[name].reviews += p.review_count;
      if (p.average_rating) map[name].ratings.push(p.average_rating);
    }
  }
  return map;
}

function confidenceCounts(data) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const r of data) {
    for (const p of r.platforms || []) {
      const c = p.extraction_confidence || "low";
      if (counts[c] !== undefined) counts[c]++;
    }
  }
  return counts;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function ConfidenceBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">
          {count} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
