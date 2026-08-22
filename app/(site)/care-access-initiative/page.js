import TrustCenterPage from "../../../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../../../lib/trustCenterPages";

export const metadata = {
  title: "Care Access Initiative | Assistedly.ai",
  description: "Assistedly.ai supports care access programs in Massachusetts. See how the platform contributes to assisted living and memory care access through community partnerships.",
};

export default function Page() {
  return <TrustCenterPage slug="care-access-initiative" page={TRUST_CENTER_PAGES["care-access-initiative"]} />;
}
