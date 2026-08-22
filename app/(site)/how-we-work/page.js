import TrustCenterPage from "../../../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../../../lib/trustCenterPages";

export const metadata = {
  title: "How Assistedly.ai works | Assistedly.ai",
  description: "See how Assistedly.ai organizes Massachusetts public data, family inputs, and AI explanations without selling placements.",
};

export default function Page() {
  return <TrustCenterPage slug="how-we-work" page={TRUST_CENTER_PAGES["how-we-work"]} />;
}
