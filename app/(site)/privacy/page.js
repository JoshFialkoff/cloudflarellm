import TrustCenterPage from "../../../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../../../lib/trustCenterPages";

export const metadata = {
  title: "Privacy & Security | Assistedly.ai",
  description: "How Assistedly.ai keeps your family's information private, secure, and out of the wrong hands—including AI vendors.",
};

export default function Page() {
  return <TrustCenterPage slug="privacy" page={TRUST_CENTER_PAGES["privacy"]} />;
}
