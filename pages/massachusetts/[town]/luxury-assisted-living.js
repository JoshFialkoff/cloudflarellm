import LuxuryLandingPage from "../../../components/LuxuryLandingPage";
import {
  LUXURY_ASSISTED_LIVING_PAGES,
  LUXURY_ASSISTED_LIVING_PAGES_BY_TOWN,
} from "../../../lib/luxuryAssistedLivingPages";

export default function LuxuryAssistedLivingTownPage({ page }) {
  return <LuxuryLandingPage page={page} />;
}

export async function getStaticPaths() {
  const paths = LUXURY_ASSISTED_LIVING_PAGES.map((page) => ({
    params: { town: page.town },
  }));

  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const page = LUXURY_ASSISTED_LIVING_PAGES_BY_TOWN[params.town];

  if (!page) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      page,
    },
  };
}
