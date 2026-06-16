import TrustCenterPage from "../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../lib/trustCenterPages";

export default function PrivacyPage() {
  return <TrustCenterPage slug="privacy" page={TRUST_CENTER_PAGES.privacy} />;
}
