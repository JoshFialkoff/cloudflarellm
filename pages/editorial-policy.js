import TrustCenterPage from "../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../lib/trustCenterPages";

export default function EditorialPolicyPage() {
  return (
    <TrustCenterPage
      slug="editorial-policy"
      page={TRUST_CENTER_PAGES["editorial-policy"]}
    />
  );
}
