import TrustCenterPage from "../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../lib/trustCenterPages";

export default function HowWeWorkPage() {
  return <TrustCenterPage slug="how-we-work" page={TRUST_CENTER_PAGES["how-we-work"]} />;
}
