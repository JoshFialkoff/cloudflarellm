import FacilityDiscoveryDashboard from "../../components/facility-charts/FacilityDiscoveryDashboard";

export const metadata = {
  title: "Best Memory Care Facilities in Massachusetts | SCR Units & State Data",
  description:
    "Find dementia-specialized care among all licensed Massachusetts facilities. Compare SCR-certified units, medication administration protocols, and staffing data from official state inspections.",
  keywords: [
    "memory care Massachusetts",
    "dementia care facilities Massachusetts",
    "assisted living with memory care",
    "SCR units Massachusetts",
    "best memory care near me Massachusetts",
    "Alzheimer's care Massachusetts state data",
    "licensed assisted living facilities Massachusetts",
  ],
  alternates: { canonical: "/memory-care" },
  openGraph: {
    title: "Best Memory Care Facilities in Massachusetts | SCR Units & State Data",
    description: "Find dementia-specialized care among all licensed Massachusetts facilities. Compare SCR-certified units, medication administration protocols, and staffing data.",
    url: "/memory-care",
    type: "website",
  },
};

export default function MemoryCarePage() {
  return (
    <main style={{ minHeight: "100vh" }}>
      <FacilityDiscoveryDashboard
        title="Best Memory Care Facilities in Massachusetts"
        subtitle="Find dementia-specialized care among all licensed Massachusetts facilities. Compare SCR-certified units, medication administration protocols, and staffing data from official state inspections."
      />
    </main>
  );
}
