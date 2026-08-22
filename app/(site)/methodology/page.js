import TrustCenterPage from "../../../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../../../lib/trustCenterPages";

export const metadata = {
  title: "Methodology | Assistedly.ai",
  description: "Understand how Assistedly.ai summarizes pricing, staffing, occupancy, and compliance signals for Massachusetts families.",
};

export default function Page() {
  return <TrustCenterPage slug="methodology" page={TRUST_CENTER_PAGES["methodology"]} />;
}
