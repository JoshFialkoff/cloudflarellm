import LandingBanner from "../../components/LandingBanner";

export default function SiteLayout({ children }) {
  return (
    <>
      <LandingBanner />
      {children}
    </>
  );
}
