import TrustCenterPage from "../../../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../../../lib/trustCenterPages";

export const metadata = {
  title: "Editorial Policy | Assistedly.ai",
  description: "Assistedly.ai editorial standards: no pay-to-play rankings, transparent corrections, and clear sourcing for all facility data.",
};

export default function Page() {
  return <TrustCenterPage slug="editorial-policy" page={TRUST_CENTER_PAGES["editorial-policy"]} />;
}
