import TrustCenterPage from "../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../lib/trustCenterPages";

export default function HowWeMakeMoneyPage() {
  return (
    <TrustCenterPage
      slug="how-we-make-money"
      page={TRUST_CENTER_PAGES["how-we-make-money"]}
    />
  );
}
