import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  MASSACHUSETTS_FACILITIES,
  MASSACHUSETTS_FACILITIES_BY_SLUG,
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
        <link rel="canonical" href={`https://aiassistliving.com${destination}`} />
      </Head>
      <p>Redirecting to updated Massachusetts facility page...</p>
    </>
  );
}

export async function getStaticPaths() {
  return {
    paths: MASSACHUSETTS_FACILITIES.map((facility) => ({
      params: { slug: facility.slug },
    })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const facility = MASSACHUSETTS_FACILITIES_BY_SLUG[params.slug];

  if (!facility) {
    return { notFound: true };
  }

  return {
    props: {
      destination: `/massachusetts/${facility.town}/${facility.slug}`,
    },
  };
}
