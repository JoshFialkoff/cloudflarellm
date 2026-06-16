import { notFound } from "next/navigation";
import MassachusettsTownIntentPage from "../../../../components/MassachusettsTownIntentPage";
import { getTownSeoPage, MVP_TOWNS } from "../../../../lib/massachusettsTownSeo";

export function generateStaticParams() {
  return MVP_TOWNS.map((town) => ({ town }));
}

export async function generateMetadata({ params }) {
  const { town } = await params;
  const page = getTownSeoPage(town, "costs");
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.canonicalPath },
  };
}

export default async function CostsTownPage({ params }) {
  const { town } = await params;
  const page = getTownSeoPage(town, "costs");
  if (!page) notFound();
  return <MassachusettsTownIntentPage page={page} />;
}
