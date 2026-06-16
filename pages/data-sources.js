import TrustCenterPage from "../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../lib/trustCenterPages";

export default function DataSourcesPage() {
  return <TrustCenterPage slug="data-sources" page={TRUST_CENTER_PAGES["data-sources"]} />;
}
