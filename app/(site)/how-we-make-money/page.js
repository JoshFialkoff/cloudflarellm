import TrustCenterPage from "../../../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../../../lib/trustCenterPages";

export const metadata = {
  title: "How Assistedly.ai makes money | Assistedly.ai",
  description: "Transparent revenue model for Assistedly.ai: premium consumer memberships and guided decision support.",
};

export default function Page() {
  return <TrustCenterPage slug="how-we-make-money" page={TRUST_CENTER_PAGES["how-we-make-money"]} />;
}
