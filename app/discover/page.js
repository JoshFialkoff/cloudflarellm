import FacilityDiscoveryDashboard from "../../components/facility-charts/FacilityDiscoveryDashboard";

export const metadata = {
  title: "Discover Massachusetts Assisted Living | Official State Data & Safety Scores",
  description:
    "Every licensed assisted living facility in Massachusetts — with official state data on pricing, safety scores, care depth, and insurance programs that reduce your family's out-of-pocket costs.",
  keywords: [
    "Massachusetts assisted living comparison",
    "assisted living safety scores Massachusetts",
    "assisted living prices Massachusetts official data",
    "memory care Massachusetts state data",
    "assisted living insurance SCO PACE Massachusetts",
    "best assisted living Massachusetts data",
    "assisted living Medicaid Massachusetts",
    "licensed assisted living facilities Massachusetts",
  ],
  alternates: {
    canonical: "/discover",
  },
  openGraph: {
    title: "Discover Massachusetts Assisted Living | Official State Data & Safety Scores",
    description:
      "Every licensed assisted living facility in Massachusetts — with official state data on pricing, safety scores, care depth, and insurance acceptance.",
    url: "/discover",
    type: "website",
  },
};

export default function DiscoverPage() {
  return (
    <main style={{ minHeight: "100vh" }}>
      <FacilityDiscoveryDashboard
        title="Discover Massachusetts Assisted Living"
        subtitle="Every licensed assisted living facility in Massachusetts — with official state data on pricing, safety scores, care depth, and insurance programs that reduce your family's out-of-pocket costs."
      />
    </main>
  );
}
