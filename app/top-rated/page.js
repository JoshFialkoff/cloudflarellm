import FacilityDiscoveryDashboard from "../../components/facility-charts/FacilityDiscoveryDashboard";

export const metadata = {
  title: "Top Rated Assisted Living Facilities in Massachusetts | Ranked by State Data",
  description:
    "See the highest-rated assisted living facilities in Massachusetts ranked by official state inspection data. Compare safety scores, staffing, emergency power, and care quality across all licensed communities.",
  keywords: [
    "top rated assisted living Massachusetts",
    "best assisted living facilities Massachusetts",
    "assisted living rankings Massachusetts",
    "highest rated senior living Massachusetts",
    "best assisted living safety Massachusetts",
    "assisted living inspection data Massachusetts",
    "licensed assisted living facilities Massachusetts",
    "official state data assisted living MA",
  ],
  alternates: { canonical: "/top-rated" },
  openGraph: {
    title: "Top Rated Assisted Living Facilities in Massachusetts | Ranked by State Data",
    description: "See the highest-rated assisted living facilities in Massachusetts ranked by official state inspection data. Compare safety, staffing, and care quality across all licensed communities.",
    url: "/top-rated",
    type: "website",
  },
};

export default function TopRatedPage() {
  return (
    <main style={{ background: "#f4f5f7", minHeight: "100vh" }}>
      <FacilityDiscoveryDashboard
        title="Top Rated Assisted Living Facilities in Massachusetts"
        subtitle="Ranked by official Massachusetts state inspection data. Explore the highest-rated communities by safety score, staffing ratios, emergency readiness, electronic records, and video monitoring — metrics no broker site publishes."
        defaultSortKey="safetyScore"
        defaultSortDir="desc"
        source="top_rated"
      />
    </main>
  );
}
