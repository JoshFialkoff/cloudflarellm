import FacilityDiscoveryDashboard from "../../components/facility-charts/FacilityDiscoveryDashboard";

export const metadata = {
  title: "Most Affordable Assisted Living in Massachusetts | SCO, PACE & Medicaid",
  description:
    "Compare licensed Massachusetts facilities by cost and insurance acceptance. Filter by SCO, PACE, GAFC, Section 8, and MRVP — state and federal programs that lower monthly out-of-pocket costs.",
  keywords: [
    "affordable assisted living Massachusetts",
    "assisted living that accepts MassHealth",
    "assisted living SCO Massachusetts",
    "assisted living PACE Massachusetts",
    "cheap assisted living near me Massachusetts",
    "assisted living Medicaid Massachusetts",
    "low income assisted living Massachusetts",
    "licensed assisted living facilities Massachusetts",
  ],
  alternates: { canonical: "/affordable" },
  openGraph: {
    title: "Most Affordable Assisted Living in Massachusetts | Official Pricing Data",
    description: "Compare licensed Massachusetts facilities by cost and insurance acceptance. Filter by SCO, PACE, GAFC, Section 8, and MRVP — programs that lower monthly costs.",
    url: "/affordable",
    type: "website",
  },
};

export default function AffordablePage() {
  return (
    <main style={{ background: "#f4f5f7", minHeight: "100vh" }}>
      <FacilityDiscoveryDashboard
        title="Most Affordable Assisted Living in Massachusetts"
        subtitle="Compare licensed facilities by cost and insurance acceptance. Filter by SCO, PACE, GAFC, Section 8, and MRVP — state and federal programs that lower monthly out-of-pocket costs for Massachusetts families."
        defaultMaxFee={6000}
        defaultTaxStatus=""
      />
    </main>
  );
}
