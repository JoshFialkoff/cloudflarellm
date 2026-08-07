import TrustCenterPage from "../components/TrustCenterPage";
import { TRUST_CENTER_PAGES } from "../lib/trustCenterPages";
import DefaultPageHead from "../components/Seo/DefaultPageHead";

export default function CareAccessInitiativePage() {
  const page = TRUST_CENTER_PAGES["care-access-initiative"];
  return (
    <>
      <DefaultPageHead
        title="Care Access Initiative | Assistedly.ai"
        description="Assistedly.ai supports care access programs in Massachusetts. See how the platform contributes to assisted living and memory care access through community partnerships."
        canonicalPath="/care-access-initiative"
        keywords={[
          "assisted living access initiative",
          "Massachusetts assisted living funding",
          "AI assisted living matching community impact",
          "affordable assisted living programs Massachusetts",
        ]}
      />
      <TrustCenterPage slug="care-access-initiative" page={page} />
    </>
  );
}
