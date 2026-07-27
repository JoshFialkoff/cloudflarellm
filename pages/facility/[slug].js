import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  MASSACHUSETTS_FACILITIES,
  MASSACHUSETTS_FACILITIES_BY_SLUG,
  MASSACHUSETTS_FACILITIES_BY_ID,
} from "../../lib/massachusettsFacilities";

export default function LegacyFacilityRedirectPage({ destination }) {
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
        <link rel="canonical" href={`https://assistedly.ai${destination}`} />
      </Head>
      <p>Redirecting to updated Massachusetts facility page...</p>
    </>
  );
}

export async function getStaticPaths() {
  const slugPaths = MASSACHUSETTS_FACILITIES.map((facility) => ({
    params: { slug: facility.slug },
  }));
  const idPaths = MASSACHUSETTS_FACILITIES.map((facility) => ({
    params: { slug: String(facility.id) },
  }));
  return {
    paths: [...slugPaths, ...idPaths],
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  let facility = MASSACHUSETTS_FACILITIES_BY_SLUG[params.slug];

  if (!facility) {
    facility = MASSACHUSETTS_FACILITIES_BY_ID[params.slug];
  }

  if (!facility) {
    return { notFound: true };
  }

  return {
    props: {
      destination: `/facility/ma/${facility.slug}`,
    },
  };
}
