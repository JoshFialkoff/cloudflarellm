import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { LUXURY_ASSISTED_LIVING_PAGES } from "../../../lib/luxuryAssistedLivingPages";

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
  return {
    props: {
      destination: `/massachusetts/${params.town}/luxury-assisted-living`,
    },
  };
}

export default function LuxuryAssistedLivingTownRedirectPage({ destination }) {
  const router = useRouter();

  useEffect(() => {
    if (destination) {
      router.replace(destination);
    }
  }, [destination, router]);

  return (
    <>
      <Head>
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href={`https://aiassistliving.com${destination}`} />
      </Head>
      <p>Redirecting to town landing page...</p>
    </>
  );
}
