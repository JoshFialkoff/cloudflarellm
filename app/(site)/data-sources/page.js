import TrustCenterPage from "../../../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../../../lib/trustCenterPages";

export const metadata = {
  title: "Data sources | Assistedly.ai",
  description: "Assistedly.ai relies on Massachusetts public data, facility-provided profile information, and family research inputs.",
};

export default function Page() {
  return <TrustCenterPage slug="data-sources" page={TRUST_CENTER_PAGES["data-sources"]} />;
}
