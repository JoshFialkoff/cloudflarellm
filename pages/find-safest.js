import Head from "next/head";
import FacilityDiscoveryDashboard from "../components/facility-charts/FacilityDiscoveryDashboard";

export default function FindSafestPage() {
  return (
    <>
      <Head>
        <title>Safest Assisted Living Facilities in Massachusetts | Ranked by State Data | Assistedly.ai</title>
        <meta
          name="description"
          content="Find the safest assisted living facilities in Massachusetts ranked by official state inspection data. Compare safety scores, staffing, emergency power, and video monitoring by city."
        />
        <meta
          name="keywords"
          content="safest assisted living Massachusetts, assisted living safety scores, Massachusetts senior living safety rankings, safest retirement communities MA, assisted living inspection results Massachusetts, nursing home safety scores Massachusetts"
        />
        <link rel="canonical" href="https://assistedly.ai/find-safest" />
        <meta property="og:title" content="Safest Assisted Living Facilities in Massachusetts | Ranked by State Data" />
        <meta
          property="og:description"
          content="Ranked by official MA state inspection data. Compare safety scores, staffing ratios, and emergency readiness across all licensed assisted living facilities."
        />
        <meta property="og:url" content="https://assistedly.ai/find-safest" />
        <meta property="og:type" content="website" />
      </Head>
      <main style={{ background: "#f4f5f7", minHeight: "100vh" }}>
        <FacilityDiscoveryDashboard
          title="Safest Assisted Living Facilities in Massachusetts"
          subtitle="Ranked by official Massachusetts state inspection data. Compare safety scores, staffing ratios, emergency power, electronic records, and video monitoring across all licensed facilities — metrics no broker site publishes."
        />
      </main>
    </>
  );
}
