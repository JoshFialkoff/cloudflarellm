import FacilityDiscoveryDashboard from "../../components/facility-charts/FacilityDiscoveryDashboard";

export const metadata = {
  title: "Safest Assisted Living Facilities in Massachusetts | Ranked by State Data | Assistedly.ai",
  description:
    "Find the safest assisted living facilities in Massachusetts ranked by official state inspection data. Compare safety scores, staffing, emergency power, and video monitoring by city.",
  keywords: [
    "safest assisted living Massachusetts",
    "assisted living safety scores",
    "Massachusetts senior living safety rankings",
    "safest retirement communities MA",
    "assisted living inspection results Massachusetts",
    "nursing home safety scores Massachusetts",
  ],
  alternates: { canonical: "/find-safest" },
  openGraph: {
    title: "Safest Assisted Living Facilities in Massachusetts | Ranked by State Data",
    description:
      "Ranked by official MA state inspection data. Compare safety scores, staffing ratios, and emergency readiness across all licensed assisted living facilities.",
    url: "/find-safest",
    type: "website",
  },
};

export default function FindSafestPage() {
  return (
    <main style={{ background: "#f4f5f7", minHeight: "100vh" }}>
      <FacilityDiscoveryDashboard
        title="Safest Assisted Living Facilities in Massachusetts"
        subtitle="Ranked by official Massachusetts state inspection data. Compare safety scores, staffing ratios, emergency power, electronic records, and video monitoring across all licensed facilities — metrics no broker site publishes."
      />
    </main>
  );
}
